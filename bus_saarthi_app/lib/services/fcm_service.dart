import 'dart:async';
import 'dart:ui' as ui;

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

  // Vibration patterns as static constants
  static const List<int> _vibrationGeneral = [0, 300, 200, 300];
  static const List<int> _vibrationSos = [0, 500, 200, 500, 200, 500];
  static const List<int> _vibrationWakeAlarm = [0, 500, 200, 500];
  static const List<int> _vibrationGrievance = [0, 300, 200, 300];
  static const List<int> _vibrationRoute = [0, 400, 300, 400];
  static const List<int> _vibrationBroadcast = [0, 200, 100, 200];

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

    await ensureLocalNotifications();

    // Ask the user once — like the web Notification.requestPermission().
    final permission = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((message) async {
      debugPrint('[FCM] foreground message: ${message.notification?.title}');
      if (await NotificationPreferences.pushNotificationsEnabled()) {
        await showLocalFromFcm(message);
      }
      onForegroundMessage?.call(message);
    });

    // Handle background messages - top-level function
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

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

  static Future<void> ensureLocalNotifications() async {
    if (_localNotificationsReady) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _local.initialize(
      settings: const InitializationSettings(android: android),
    );

    final androidImpl = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      await androidImpl.requestNotificationsPermission();
    }

    await _createNotificationChannels();
    _localNotificationsReady = true;
  }

  static Future<void> _createNotificationChannels() async {
    final androidImpl = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl == null) return;

    // General notifications channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_general',
        'General Notifications',
        description: 'Bus tracking, route updates, and general notifications',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notification'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationGeneral),
        enableLights: true,
        ledColor: const ui.Color(0xFF0056B3),
      ),
    );

    // SOS Emergency channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_sos',
        'SOS Emergency',
        description: 'Emergency SOS alerts - highest priority',
        importance: Importance.max,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('alarm'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationSos),
        enableLights: true,
        ledColor: const ui.Color(0xFFCF1322),
      ),
    );

    // Wake Alarm channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_wake_alarm',
        'Wake Alarms',
        description: 'Bus arrival wake alarms',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('alarm'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationWakeAlarm),
        enableLights: true,
        ledColor: const ui.Color(0xFFFF6600),
      ),
    );

    // Grievance/Complaint channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_grievance',
        'Complaint Updates',
        description: 'Complaint status updates and responses',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notification'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationGrievance),
        enableLights: true,
        ledColor: const ui.Color(0xFF6366F1),
      ),
    );

    // Route/Merge Updates channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_route',
        'Route Updates',
        description: 'Route changes, merges, and cancellations',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notification'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationRoute),
        enableLights: true,
        ledColor: const ui.Color(0xFFF59E0B),
      ),
    );

    // Broadcast/Announcements channel
    await androidImpl.createNotificationChannel(
      AndroidNotificationChannel(
        'bus_saarthi_broadcast',
        'Announcements',
        description: 'Official announcements and broadcasts',
        importance: Importance.defaultImportance,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('notification'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList(_vibrationBroadcast),
        enableLights: true,
        ledColor: const ui.Color(0xFF0056B3),
      ),
    );
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

  static Future<void> showLocalFromFcm(RemoteMessage message) async {
    if (!_localNotificationsReady) return;

    // Extract title, body, and type from either notification payload or data payload
    String? title;
    String? body;
    String? type;

    if (message.notification != null) {
      // Foreground: notification payload exists
      title = message.notification!.title;
      body = message.notification!.body;
      type = message.data['type'];
    } else {
      // Background/terminated: data-only message
      title = message.data['title'];
      body = message.data['body'] ?? message.data['message'];
      type = message.data['type'];
    }

    // Fallback to data payload if notification is missing
    title ??= message.data['title'];
    body ??= message.data['body'] ?? message.data['message'];
    type ??= message.data['type'];

    if (title == null || body == null) {
      debugPrint('[FCM] No title/body in message, skipping');
      return;
    }

    // Determine channel based on message data type
    String channelId = 'bus_saarthi_general';
    final channelType = type ?? message.data['type'] ?? 'general';
    if (channelType == 'sos') {
      channelId = 'bus_saarthi_sos';
    } else if (channelType == 'wake_alarm' || channelType == 'wake_alarm_trigger') {
      channelId = 'bus_saarthi_wake_alarm';
    } else if (channelType.toString().startsWith('grievance')) {
      channelId = 'bus_saarthi_grievance';
    } else if (channelType == 'merge' || channelType == 'route_cancel') {
      channelId = 'bus_saarthi_route';
    } else if (channelType == 'broadcast') {
      channelId = 'bus_saarthi_broadcast';
    } else {
      channelId = 'bus_saarthi_general';
    }

    final soundResource =
        (channelId == 'bus_saarthi_wake_alarm' || channelId == 'bus_saarthi_sos')
            ? const RawResourceAndroidNotificationSound('alarm')
            : const RawResourceAndroidNotificationSound('notification');

    // Determine style based on message data
    final contentBody = body;
    NotificationDetails notificationDetails;

    if (contentBody.length > 200) {
      notificationDetails = NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          'Bus Saarthi',
          channelDescription: 'Bus Saarthi Notifications',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          sound: soundResource,
          styleInformation: BigTextStyleInformation(contentBody),
        ),
      );
    } else if (body.contains('\n') && body.split('\n').length > 2) {
      notificationDetails = NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          'Bus Saarthi',
          channelDescription: 'Bus Saarthi Notifications',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          sound: soundResource,
          styleInformation: InboxStyleInformation(
            body.split('\n').where((line) => line.isNotEmpty).toList(),
          ),
        ),
      );
    } else {
      notificationDetails = NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          'Bus Saarthi',
          channelDescription: 'Bus Saarthi Notifications',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          sound: soundResource,
          styleInformation: BigTextStyleInformation(body),
        ),
      );
    }

    await _local.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: notificationDetails,
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
      await ensureLocalNotifications();
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

// Background message handler - MUST be a top-level function (not a static method of a class)
// This is required for FCM to call it when the app is in background/terminated state
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
    debugPrint('[FCM] background message: ${message.data}');
    // If Android OS didn't show the notification automatically (e.g. data-only payload),
    // display local notification so user gets it in the notification shade.
    if (message.notification == null) {
      await FcmService.ensureLocalNotifications();
      if (await NotificationPreferences.pushNotificationsEnabled()) {
        await FcmService.showLocalFromFcm(message);
      }
    }
  } catch (e) {
    debugPrint('[FCM] Error in background handler: $e');
  }
}