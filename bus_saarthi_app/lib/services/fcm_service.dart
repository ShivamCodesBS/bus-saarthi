import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'notification_preferences.dart';

import 'api_client.dart';

/// FCM push for the Android app.
///
/// The backend stores the FCM token in PushSubscription (deviceType
/// 'android') and delivers through firebase-admin. Firebase init fails
/// gracefully while `android/app/google-services.json` is still the
/// bundled placeholder — the app runs fine without push until the real
/// Firebase project is wired in.
class FcmService {
  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  static bool _localNotificationsReady = false;
  static String? _lastToken;
  static String? _currentJwt;
  static StreamSubscription<String>? _tokenRefreshSubscription;
  static void Function(RemoteMessage message)? onForegroundMessage;

  static bool _initialized = false;
  static bool _initFailed = false;
  static String? _lastError;

  /// Initialises Firebase + notification channel + token subscription.
  /// Safe to call multiple times; never throws.
  static Future<void> init(String? jwtToken) async {
    if (jwtToken == null) return;
    _currentJwt = jwtToken;
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('[FCM] Firebase init skipped (placeholder config?): $e');
      _initialized = false;
      _initFailed = true;
      _lastError = e.toString();
      return;
    }

    await _ensureLocalNotifications();

    // Ask the user once — like the web Notification.requestPermission().
    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    FirebaseMessaging.onMessage.listen((message) async {
      debugPrint('[FCM] foreground message: ${message.notification?.title}');
      if (await NotificationPreferences.pushNotificationsEnabled()) {
        await _showLocalFromFcm(message);
      }
      onForegroundMessage?.call(message);
    });

    if (_isAuthorized(permission.authorizationStatus)) {
      await _subscribeToken(jwtToken);
    }

    // Token can rotate — re-subscribe using the latest signed-in account.
    _tokenRefreshSubscription ??= FirebaseMessaging.instance.onTokenRefresh
        .listen((token) {
          _lastToken = token;
          final currentJwt = _currentJwt;
          if (currentJwt != null) _postSubscribe(token, currentJwt);
        });
  }

  static Future<void> _ensureLocalNotifications() async {
    if (_localNotificationsReady) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _local.initialize(
      settings: const InitializationSettings(android: android),
    );
    const channel = AndroidNotificationChannel(
      'bus_saarthi_general',
      'Bus Saarthi',
      description: 'Bus tracking, broadcasts and SOS alerts',
      importance: Importance.high,
    );
    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);
    _localNotificationsReady = true;
  }

  static Future<void> _subscribeToken(String jwtToken) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      _lastToken = token;
      await _postSubscribe(token, jwtToken);
    } catch (e) {
      debugPrint('[FCM] token fetch failed: $e');
    }
  }

  static Future<bool> _postSubscribe(String token, String jwtToken) async {
    try {
      await ApiClient.dio.post(
        '/api/push/subscribe',
        data: {
          'subscription': {'token': token},
          'device_type': 'android',
        },
        options: Options(headers: {'Authorization': 'Bearer $jwtToken'}),
      );
      debugPrint('[FCM] subscribed token to backend');
      return true;
    } catch (e) {
      debugPrint('[FCM] subscribe failed: $e');
      return false;
    }
  }

  static Future<void> _showLocalFromFcm(RemoteMessage message) async {
    if (!_localNotificationsReady) return;
    final n = message.notification;
    if (n == null) return;
    await _local.show(
      id: n.title?.hashCode ?? DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: n.title ?? 'Bus Saarthi',
      body: n.body ?? '',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'bus_saarthi_general',
          'Bus Saarthi',
          channelDescription: 'Bus tracking, broadcasts and SOS alerts',
          importance: Importance.high,
          priority: Priority.high,
          styleInformation: BigTextStyleInformation(''),
        ),
      ),
      payload: message.data.toString(),
    );
  }

  /// Re-subscribe after a fresh login (token may be reused across accounts).
  static Future<void> rebind(String jwtToken) async {
    _currentJwt = jwtToken;
    _initialized = false;
    _initFailed = false;
    _lastError = null;
    if (_lastToken != null) {
      await _postSubscribe(_lastToken!, jwtToken);
      _initialized = true;
      return;
    }
    await init(jwtToken);
  }

  /// Notification permission request surfaced for the Settings toggle.
  static Future<AuthorizationStatus?> permissionStatus() async {
    try {
      await Firebase.initializeApp();
      final settings = await FirebaseMessaging.instance
          .getNotificationSettings();
      return settings.authorizationStatus;
    } catch (e) {
      debugPrint('[FCM] permission check failed: $e');
      return null;
    }
  }

  static Future<bool> requestPermission() async {
    try {
      await Firebase.initializeApp();
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final granted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      return granted;
    } catch (e) {
      debugPrint('[FCM] permission request failed: $e');
      return false;
    }
  }

  /// Re-register an existing device token after the user re-enables notifications.
  static Future<void> enable(String jwtToken) async {
    try {
      await Firebase.initializeApp();
      await _ensureLocalNotifications();
      final token = _lastToken ?? await FirebaseMessaging.instance.getToken();
      if (token != null) {
        if (await _postSubscribe(token, jwtToken)) _lastToken = token;
      }
    } catch (e) {
      debugPrint('[FCM] re-enable failed: $e');
    }
  }

  /// Remove the local FCM registration. Backend delivery suppression requires
  /// a server unsubscribe endpoint; re-enable always re-registers the token.
  static Future<void> disable() async {
    _currentJwt = null;
    try {
      final settings = await FirebaseMessaging.instance
          .getNotificationSettings();
      if (_isAuthorized(settings.authorizationStatus)) {
        await FirebaseMessaging.instance.deleteToken();
      }
    } catch (e) {
      debugPrint('[FCM] token deletion failed: $e');
    } finally {
      _lastToken = null;
    }
  }

  static bool _isAuthorized(AuthorizationStatus? status) =>
      status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;

  static Future<bool> isPermissionGranted() async =>
      _isAuthorized(await permissionStatus());

  /// Check if FCM initialization failed (e.g., missing google-services.json)
  static bool get initFailed => _initFailed;

  /// Get the last initialization error message
  static String? get lastError => _lastError;

  /// Manually retry FCM initialization
  static Future<void> retryInit(String? jwtToken) async {
    _initialized = false;
    _initFailed = false;
    _lastError = null;
    await init(jwtToken);
  }
}
