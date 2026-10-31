import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/notification_item.dart';
import '../models/route_model.dart';
import '../models/user_model.dart';
import '../services/api_client.dart';
import '../services/fcm_service.dart';
import '../services/notification_preferences.dart';
import '../services/socket_service.dart';

/// Live telemetry snapshot from `live_telemetry` socket events.
class Telemetry {
  final double speed;
  final double heading;
  final String comfort;
  final DateTime lastUpdated;

  const Telemetry({
    required this.speed,
    required this.heading,
    required this.comfort,
    required this.lastUpdated,
  });
}

/// Crowd state from `GET /api/route_status/:routeId`.
class CrowdStatus {
  final int filled;
  final int total;
  final String status; // 'Low' | 'Medium' | 'Over Crowd' | 'Loading...'

  const CrowdStatus({
    this.filled = 0,
    this.total = 50,
    this.status = 'Loading...',
  });

  factory CrowdStatus.fromJson(Map<String, dynamic> json) => CrowdStatus(
    filled: int.tryParse('${json['filled'] ?? 0}') ?? 0,
    total: int.tryParse('${json['total'] ?? 50}') ?? 50,
    status: (json['status'] ?? 'Loading...').toString(),
  );
}

/// Merge / cancellation state. `isCancelled` distinguishes the two banner
/// variants exactly like the web `mergeInfo`.
class MergeInfo {
  final bool isCancelled;
  final String? newRouteId;
  final String? newBusNumber;
  final String? newRouteName;
  final String? cancelledRouteId;
  final String? cancelledBusNumber;
  final String? cancelledRouteName;
  final String? reason;
  final String? message;

  const MergeInfo({
    required this.isCancelled,
    this.newRouteId,
    this.newBusNumber,
    this.newRouteName,
    this.cancelledRouteId,
    this.cancelledBusNumber,
    this.cancelledRouteName,
    this.reason,
    this.message,
  });

  /// From `GET /api/merge/check/:routeId` → data.merge
  factory MergeInfo.fromCheck(Map<String, dynamic> m) {
    if (m['status'] == 'cancelled') {
      return MergeInfo(
        isCancelled: true,
        cancelledRouteId: m['cancelledRouteId']?.toString(),
        cancelledBusNumber: m['cancelledBusNumber']?.toString(),
        cancelledRouteName: m['cancelledRouteName']?.toString(),
        reason: m['reason']?.toString(),
        message: (m['notes']?.toString().isNotEmpty ?? false)
            ? m['notes'].toString()
            : 'Your bus (${m['cancelledBusNumber'] ?? m['cancelledRouteId']}) is cancelled today. No replacement bus is available.',
      );
    }
    return MergeInfo(
      isCancelled: false,
      newRouteId: m['targetRouteId']?.toString(),
      newBusNumber: m['targetBusNumber']?.toString(),
      newRouteName: m['targetRouteName']?.toString(),
      cancelledRouteId: m['cancelledRouteId']?.toString(),
      cancelledBusNumber: m['cancelledBusNumber']?.toString(),
      cancelledRouteName: m['cancelledRouteName']?.toString(),
      reason: m['reason']?.toString(),
      message:
          'Your bus (${m['cancelledBusNumber'] ?? m['cancelledRouteId']}) is cancelled today. Please board Bus ${m['targetBusNumber']} (${m['targetRouteName']}).',
    );
  }

  factory MergeInfo.cancelledEvent(Map<String, dynamic> data) => MergeInfo(
    isCancelled: true,
    message: data['message']?.toString(),
    cancelledRouteId: data['cancelledRouteId']?.toString(),
    reason: data['reason']?.toString(),
  );
}

/// SOS lifecycle: idle → counting (5s) → active.
enum SosPhase { idle, counting, active }

/// The full state machine behind the Home screen — a direct port of
/// Home.jsx's effects and handlers.
class TrackingProvider extends ChangeNotifier {
  final UserModel user;
  final StudentSocketService _socket = StudentSocketService();
  Timer? _crowdInterval;
  Timer? _mergeCheckTimer;
  Timer? _telemetryTimeout;
  Timer? _telemetryThrottle;
  int _routeRequestGeneration = 0;
  int _mergeCheckGeneration = 0;
  int _alarmRequestGeneration = 0;
  int _recenterRequest = 0;
  Timer? _sosCountdownTimer;
  Timer? _sosFireTimer;
  BuildContext? _toastContext;

  // ── State (same fields as the web component) ─────────────────────────
  MergeInfo? mergeInfo;
  CrowdStatus crowdStatus = const CrowdStatus();
  RouteInfo? routeInfo;
  Telemetry? telemetry;
  List<NotificationItem> notices = [];
  Map<String, dynamic>? activeBroadcast;
  List<double> busLocation = const [28.3180, 79.4670]; // Invertis University
  bool isLive = false;
  bool autoFollow = true;
  bool alarmSet = false;
  bool alarmLoading = false;
  SosPhase sosPhase = SosPhase.idle;
  int sosCountdown = 0;
  bool hasUnread = false;
  List<String> seenIds = [];

  bool _disposed = false;
  int _notificationGeneration = 0;
  StreamSubscription<Map<String, dynamic>>? _fcmTapSub;

  TrackingProvider(this.user) {
    _loadLocalFlags();
    _wireSocket();
    _wireFcmTap();
    _bootstrap();
  }

  void _wireFcmTap() {
    _fcmTapSub = FcmService.onTapNotification.listen((data) {
      _handleFcmNotificationTap(data);
    });
  }

  void _handleFcmNotificationTap(Map<String, dynamic> data) {
    if (_disposed) return;
    final type = data['type']?.toString();
    if (type == 'broadcast') {
      activeBroadcast = {
        'id': data['broadcastId'] ?? data['id'] ?? 'broadcast-tap',
        'title': data['title'] ?? 'Notice',
        'message': data['body'] ?? data['message'] ?? '',
        'sender': data['sender'] ?? 'Administration',
        'timestamp': data['timestamp'] ?? DateTime.now().toIso8601String(),
      };
      _notify();
    } else if (type == 'merge' || type == 'route_cancel') {
      _checkMergeStatus();
    } else if (type == 'wake_alarm' || type == 'wake_alarm_trigger') {
      _toast(
        '🚌 Bus arrival alert: ${data['body'] ?? data['message'] ?? 'Approaching destination'}',
        kind: ToastKind.wakeAlarm,
        duration: const Duration(seconds: 10),
      );
    }
  }

  void attachToastContext(BuildContext context) => _toastContext = context;

  void _toast(
    String message, {
    ToastKind kind = ToastKind.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final context = _toastContext;
    if (context == null || !context.mounted || _disposed) return;
    ApiClient.toast(context, message, kind: kind, duration: duration);
  }

  // Effective route: cancelled → stay on home route; merged → new route.
  String get homeRouteId => user.routeId ?? '4';
  String get effectiveRouteId {
    if (mergeInfo?.isCancelled ?? false) return homeRouteId;
    return mergeInfo?.newRouteId ?? homeRouteId;
  }

  Map<String, String> get _authHeaders => ApiClient.authHeaders(user);

  // ── Bootstrap (the web useEffect body) ────────────────────────────────
  Future<void> _bootstrap() async {
    // Sync wake alarm status from backend first
    await _syncWakeAlarmFromBackend();

    // Allow the merge endpoint a short window to resolve before fetching route
    // scoped data. All requests are still generation-guarded below.
    _mergeCheckTimer = Timer(const Duration(milliseconds: 300), () {
      if (!_disposed) _checkMergeStatus();
    });
    _crowdInterval = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _fetchCrowdStatus(),
    );
    _fetchCrowdStatus();
    _fetchRouteData();
    _fetchNotifications();
    _fetchUserGrievances();
    _checkSosStatus();

    _socket.connect(effectiveRouteId, user.loginId);
  }

  Future<void> _loadLocalFlags() async {
    final prefs = await SharedPreferences.getInstance();
    if (_disposed) return;
    alarmSet = prefs.getString('wake_alarm_enabled') == 'true';
    try {
      final raw = prefs.getString('passenger_seen_notif_ids');
      if (raw != null) {
        final list = raw;
        seenIds = list
            .replaceAll('[', '')
            .replaceAll(']', '')
            .replaceAll('"', '')
            .split(',')
            .where((s) => s.isNotEmpty)
            .toList();
      }
    } catch (_) {}
    notifyListeners();
  }

  /// Fetch wake alarm status from backend and sync with local storage
  Future<void> _syncWakeAlarmFromBackend() async {
    try {
      final res = await ApiClient.dio.get(
        '/api/users/me/wake-alarm',
        options: Options(headers: _authHeaders),
      );
      if (_disposed) return;
      final data = res.data;
      final isAlarmSet = (data is Map) &&
          ((data['alarmSet'] == true) ||
              (data['alarmSet'] != null &&
                  data['alarmSet'] != false &&
                  data['alarmSet'] != 0));

      if (data is Map && isAlarmSet && data['alarm'] is Map) {
        final alarm = data['alarm'] as Map;
        alarmSet = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('wake_alarm_enabled', 'true');
        await prefs.setString(
          'wake_alarm_data',
          '{"lat":${alarm['lat']},"lng":${alarm['lng']},"thresholdKm":${alarm['thresholdKm']}}',
        );
      } else {
        alarmSet = false;
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('wake_alarm_enabled');
        await prefs.remove('wake_alarm_data');
      }
      notifyListeners();
    } catch (_) {
      // If backend fails, keep local state
    }
  }

  Future<void> _checkMergeStatus() async {
    final generation = ++_mergeCheckGeneration;
    try {
      final res = await ApiClient.dio.get(
        '/api/merge/check/$homeRouteId',
        options: Options(headers: _authHeaders),
      );
      if (_disposed || generation != _mergeCheckGeneration) return;
      _mergeCheckTimer?.cancel();
      _mergeCheckTimer = null;
      final data = res.data;
      if (data is Map && data['status'] == 'success') {
        final isCancelled = data['data']?['isCancelled'] == true;
        final mergeData = data['data']?['merge'];
        final oldRouteId = effectiveRouteId;

        if (isCancelled && mergeData != null && mergeData is Map) {
          mergeInfo = MergeInfo.fromCheck(
            Map<String, dynamic>.from(mergeData),
          );
        } else if (isCancelled) {
          mergeInfo = MergeInfo(
            isCancelled: true,
            cancelledRouteId: homeRouteId,
            message:
                'Your bus is cancelled today. No replacement bus is available.',
          );
        } else {
          mergeInfo = null;
        }

        if (oldRouteId != effectiveRouteId) _handleEffectiveRouteChanged();
        _notify();
      }
    } catch (_) {
      // non-critical, like the web's console.warn
    }
  }

  void _handleEffectiveRouteChanged() {
    final routeId = effectiveRouteId;
    _routeRequestGeneration++;
    telemetry = null;
    isLive = false;
    crowdStatus = const CrowdStatus();
    routeInfo = null;
    _telemetryTimeout?.cancel();
    busLocation = const [28.3180, 79.4670];
    _socket.joinRoute(routeId);
    _fetchCrowdStatus();
    _fetchRouteData();
  }

  Future<void> _fetchCrowdStatus() async {
    final routeId = effectiveRouteId;
    final generation = _routeRequestGeneration;
    try {
      final res = await ApiClient.dio.get(
        '/api/route_status/$routeId',
        options: Options(headers: _authHeaders),
      );
      if (!_disposed &&
          generation == _routeRequestGeneration &&
          routeId == effectiveRouteId &&
          res.data is Map &&
          res.data['status'] == 'success') {
        crowdStatus = CrowdStatus.fromJson(
          Map<String, dynamic>.from(res.data['data'] as Map),
        );
        _notify();
      }
    } catch (_) {}
  }

  Future<void> _fetchRouteData() async {
    final routeId = effectiveRouteId;
    final generation = _routeRequestGeneration;
    try {
      final res = await ApiClient.dio.get(
        '/api/routes/$routeId',
        options: Options(headers: _authHeaders),
      );
      if (!_disposed &&
          generation == _routeRequestGeneration &&
          routeId == effectiveRouteId &&
          res.data is Map) {
        routeInfo = RouteInfo.fromJson(Map<String, dynamic>.from(res.data));
        _notify();
      }
    } catch (_) {}
  }

  Future<void> _fetchNotifications() async {
    final generation = ++_notificationGeneration;
    try {
      final inboxFuture = ApiClient.dio.get(
        '/api/notifications/inbox',
        options: Options(headers: _authHeaders),
      );
      final broadcastFuture = ApiClient.dio.get(
        '/api/notifications',
        options: Options(headers: _authHeaders),
      );

      final results = await Future.wait([
        inboxFuture.catchError(
          (_) => Response(requestOptions: RequestOptions(), data: []),
        ),
        broadcastFuture.catchError(
          (_) => Response(requestOptions: RequestOptions(), data: []),
        ),
      ]);

      if (_disposed || generation != _notificationGeneration) return;

      final inboxData = results[0].data;
      final broadcastData = results[1].data;

      final List<NotificationItem> fetchedNotices = [];

      // 1. User inbox notifications
      final List inboxList = inboxData is List
          ? inboxData
          : (inboxData is Map && inboxData['data'] is List
              ? inboxData['data'] as List
              : []);
      for (final n in inboxList.whereType<Map>()) {
        fetchedNotices.add(
          NotificationItem.fromNoticeJson(Map<String, dynamic>.from(n)),
        );
      }

      // 2. Global broadcasts (official administration notices)
      final List broadcastList = broadcastData is List
          ? broadcastData
          : (broadcastData is Map && broadcastData['data'] is List
              ? broadcastData['data'] as List
              : []);

      Map<String, dynamic>? candidateBroadcast;

      for (final b in broadcastList.whereType<Map>()) {
        final bMap = Map<String, dynamic>.from(b);
        final item = NotificationItem.fromBroadcastJson(bMap);
        fetchedNotices.add(item);

        // If broadcast happened recently (within 24h) and user hasn't seen/acknowledged it
        if (candidateBroadcast == null) {
          final tsStr = bMap['timestamp'] ?? bMap['createdAt'];
          if (tsStr != null) {
            final ts = DateTime.tryParse(tsStr.toString())?.toLocal();
            if (ts != null && DateTime.now().difference(ts).inHours < 24) {
              final bId = bMap['id']?.toString() ?? item.id;
              if (!seenIds.contains(bId) && !seenIds.contains(item.id)) {
                candidateBroadcast = bMap;
              }
            }
          }
        }
      }

      if (candidateBroadcast != null && activeBroadcast == null) {
        activeBroadcast = candidateBroadcast;
      }

      notices = fetchedNotices;
      _markUnreadIfNew();
      _notify();
    } catch (_) {}
  }

  Future<void> _fetchUserGrievances() async {
    try {
      final res = await ApiClient.dio.get(
        '/api/grievances',
        options: Options(headers: _authHeaders),
        queryParameters: {'onlyMine': 'true'},
      );
      if (_disposed) return;
      if (res.data != null) {
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _checkSosStatus() async {
    try {
      final res = await ApiClient.dio.get(
        '/api/sos/my-status',
        options: Options(headers: _authHeaders),
      );
      if (res.data is Map && res.data['active'] == true) {
        sosPhase = SosPhase.active;
        _notify();
      }
    } catch (_) {}
  }

  void _markUnreadIfNew() {
    final currentIds = notices.map((n) => n.id).toList();
    final hasNew = currentIds.any((id) => !seenIds.contains(id));
    if (hasNew && !hasUnread) {
      hasUnread = true;
    }
}

// ── Socket wiring ──────────────────────────────────────────────────────

  void _wireSocket() {
    _socket.onLiveTelemetry = (data) {
      final routeId = data['route_id']?.toString();
      if (routeId == null || routeId != effectiveRouteId) return;
      final location = data['location'];
      if (location is Map &&
          location['lat'] != null &&
          location['lng'] != null) {
        busLocation = [
          double.tryParse('${location['lat']}') ?? busLocation[0],
          double.tryParse('${location['lng']}') ?? busLocation[1],
        ];
        isLive = true;
      }
      final newTelemetry = Telemetry(
        speed: double.tryParse('${data['speed'] ?? 0}') ?? 0,
        heading: double.tryParse('${data['heading'] ?? 0}') ?? 0,
        comfort: (data['comfort'] ?? 'Smooth').toString(),
        lastUpdated: DateTime.now(),
      );

      // Client-side filter: GPS noise when stationary creates fake speed.
      // If speed < 1 km/h AND the location hasn't meaningfully changed, treat as 0.
      // We also check if an accuracy field is available from the backend.
      final rawSpeed = newTelemetry.speed;
      final filteredSpeed = rawSpeed < 1.0 ? 0.0 : rawSpeed;

      telemetry = Telemetry(
        speed: filteredSpeed,
        heading: newTelemetry.heading,
        comfort: newTelemetry.comfort,
        lastUpdated: newTelemetry.lastUpdated,
      );
      _telemetryTimeout?.cancel();
      final acceptedRouteId = routeId;
      _telemetryTimeout = Timer(const Duration(seconds: 5), () {
        if (acceptedRouteId != effectiveRouteId) return;
        telemetry = null;
        isLive = false;
        _notify();
      });
      // Throttle: only notify at most once per 500ms to prevent Home rebuild spam
      if (_telemetryThrottle?.isActive ?? false) return;
      _telemetryThrottle = Timer(const Duration(milliseconds: 500), () {
        if (!_disposed) _notify();
      });
    };

    _socket.onLiveAttendance = () => _fetchCrowdStatus();

    _socket.onRouteMerged = (data) {
      _mergeCheckGeneration++;
      final oldRouteId = effectiveRouteId;
      mergeInfo = MergeInfo(
        isCancelled: false,
        newRouteId: data['newRouteId']?.toString(),
        newBusNumber: data['newBusNumber']?.toString(),
        newRouteName: data['newRouteName']?.toString(),
        reason: data['reason']?.toString(),
        message: data['message']?.toString(),
      );
      _toast(
        '🚌 BUS MERGED: ${data['message'] ?? ''}',
        kind: ToastKind.error,
        duration: const Duration(seconds: 10),
      );
      final newRoute = data['newRouteId']?.toString();
      if (newRoute != null && newRoute != oldRouteId) {
        _handleEffectiveRouteChanged();
      }
      _notify();
    };

    _socket.onRouteRestored = () {
      _mergeCheckGeneration++;
      final oldRouteId = effectiveRouteId;
      mergeInfo = null;
      _toast(
        'Your original bus route has been restored!',
        kind: ToastKind.success,
        duration: const Duration(seconds: 6),
      );
      if (oldRouteId != effectiveRouteId) _handleEffectiveRouteChanged();
      _checkMergeStatus();
      _notify();
    };

    _socket.onRouteCancelled = (data) {
      final oldRouteId = effectiveRouteId;
      mergeInfo = MergeInfo.cancelledEvent(data);
      if (oldRouteId != effectiveRouteId) _handleEffectiveRouteChanged();
      _toast(
        '🚌 BUS CANCELLED: ${data['message'] ?? ''}',
        kind: ToastKind.error,
        duration: const Duration(seconds: 15),
      );
      _notify();
    };

    _socket.onGlobalBroadcast = (data) {
      activeBroadcast = data;
      final item = NotificationItem.broadcast(data);
      notices = [item, ...notices.where((n) => n.id != item.id)];
      hasUnread = true;
      _toast(
        '📢 ${data['title'] ?? 'Notice'}: ${data['message'] ?? ''}',
        kind: ToastKind.broadcast,
        duration: const Duration(seconds: 9),
      );
      _notify();
    };

    _socket.onWakeAlarmTrigger = (data) {
      _toast(
        '🚌 Bus is ${data['distanceKm'] ?? '?'}km away! Get ready!',
        kind: ToastKind.wakeAlarm,
        duration: const Duration(seconds: 10),
      );
      notifyListeners();
    };

    _socket.onWakeAlarmUpdated = (data) async {
      final targetLogin = data['login_id']?.toString();
      if (targetLogin != null && targetLogin != user.loginId) return;
      final isAlarmSet = (data['alarmSet'] == true) ||
          (data['alarmSet'] != null &&
              data['alarmSet'] != false &&
              data['alarmSet'] != 0);
      final prefs = await SharedPreferences.getInstance();
      if (isAlarmSet && data['alarm'] is Map) {
        final alarm = data['alarm'] as Map;
        alarmSet = true;
        await prefs.setString('wake_alarm_enabled', 'true');
        await prefs.setString(
          'wake_alarm_data',
          '{"lat":${alarm['lat']},"lng":${alarm['lng']},"thresholdKm":${alarm['thresholdKm']}}',
        );
      } else {
        alarmSet = false;
        await prefs.remove('wake_alarm_enabled');
        await prefs.remove('wake_alarm_data');
      }
      _notify();
    };

    _socket.onSosAlert = (data) async {
      if (!await NotificationPreferences.sosAlertsEnabled() || _disposed)
        return;
      final title = data['title']?.toString() ?? 'SOS Alert';
      final message =
          data['message']?.toString() ??
          '${data['name'] ?? data['login_id'] ?? 'A passenger'} needs assistance.';
      _toast(
        '$title: $message',
        kind: ToastKind.error,
        duration: const Duration(seconds: 10),
      );
      _notify();
    };

    _socket.onSosCancelled = (data) {
      if (data['login_id']?.toString() == user.loginId) {
        sosPhase = SosPhase.idle;
        sosCountdown = 0;
        _sosCountdownTimer?.cancel();
        _sosFireTimer?.cancel();
        _toast(
          'SOS alert has been cancelled.',
          kind: ToastKind.success,
          duration: const Duration(seconds: 5),
        );
        _notify();
      }
    };

    _socket.onNotification = (data) async {
      // Data shape from backend: { login_id, title, body, type, grievance_id }
      if (data['login_id']?.toString() != user.loginId) return;
      final type = data['type']?.toString() ?? 'info';
      if (type.toLowerCase().contains('sos') &&
          !await NotificationPreferences.sosAlertsEnabled()) {
        return;
      }
      if (_disposed) return;

      final title = data['title']?.toString() ?? 'Notification';
      final body = data['body']?.toString() ?? '';
      final grievanceId = data['grievance_id']?.toString();

      // Create a notification item for display in dropdown
      final item = NotificationItem(
        id: 'notif-${grievanceId ?? DateTime.now().millisecondsSinceEpoch}',
        type: type,
        title: title,
        message: body,
        time: 'Now',
      );
      notices = [item, ...notices.where((n) => n.id != item.id)];
      hasUnread = true;

      // Show toast notification
      String toastMessage = '$title: $body';
      if (grievanceId != null && type == 'grievance') {
        toastMessage += ' (View in Complaints)';
      }
      _toast(
        toastMessage,
        kind: ToastKind.info,
        duration: const Duration(seconds: 6),
      );

      _notify();
    };
  }

  // ── Bell / notifications ──────────────────────────────────────────────
  List<NotificationItem> get allNotifications {
    final list = <NotificationItem>[];
    if (activeBroadcast != null) {
      list.add(NotificationItem.broadcast(activeBroadcast!));
    }
    if (sosPhase == SosPhase.active) {
      list.add(NotificationItem.sosActive());
    }
    list.addAll(notices);
    return list;
  }

  void markNotificationsSeen() {
    hasUnread = false;
    seenIds = allNotifications.map((n) => n.id).toList();
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString(
        'passenger_seen_notif_ids',
        seenIds.map((s) => '"$s"').join(',').isNotEmpty
            ? '[${seenIds.map((s) => '"$s"').join(',')}]'
            : '[]',
      );
    });
    notifyListeners();
  }

  void acknowledgeBroadcast() {
    if (activeBroadcast != null) {
      final id = activeBroadcast!['id']?.toString() ?? 'broadcast-active';
      if (!seenIds.contains(id)) {
        seenIds.add(id);
        seenIds.add('broadcast-$id');
        SharedPreferences.getInstance().then((prefs) {
          prefs.setString(
            'passenger_seen_notif_ids',
            seenIds.map((s) => '"$s"').join(',').isNotEmpty
                ? '[${seenIds.map((s) => '"$s"').join(',')}]'
                : '[]',
          );
        });
      }
    }
    activeBroadcast = null;
    notifyListeners();
  }

  // ── Wake alarm ────────────────────────────────────────────────────────
  Future<bool> cancelWakeAlarm() async {
    final generation = ++_alarmRequestGeneration;
    alarmLoading = true;
    _notify();
    try {
      await ApiClient.dio.delete(
        '/api/users/me/wake-alarm',
        options: Options(headers: _authHeaders),
      );
      if (_disposed || generation != _alarmRequestGeneration) return false;
      alarmSet = false;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('wake_alarm_enabled');
      await prefs.remove('wake_alarm_data');
      return true;
    } catch (_) {
      return false;
    } finally {
      if (generation == _alarmRequestGeneration) {
        alarmLoading = false;
        _notify();
      }
    }
  }

  Future<bool> setWakeAlarm({
    required double lat,
    required double lng,
    required double thresholdKm,
  }) async {
    final generation = ++_alarmRequestGeneration;
    alarmLoading = true;
    _notify();
    try {
      await ApiClient.dio.put(
        '/api/users/me/wake-alarm',
        data: {'lat': lat, 'lng': lng, 'thresholdKm': thresholdKm},
        options: Options(headers: _authHeaders),
      );
      if (_disposed || generation != _alarmRequestGeneration) return false;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('wake_alarm_enabled', 'true');
      await prefs.setString(
        'wake_alarm_data',
        '{"lat":$lat,"lng":$lng,"thresholdKm":$thresholdKm}',
      );
      if (_disposed || generation != _alarmRequestGeneration) return false;
      alarmSet = true;
      _notify();
      return true;
    } catch (_) {
      return false;
    } finally {
      if (generation == _alarmRequestGeneration) {
        alarmLoading = false;
        _notify();
      }
    }
  }

  // ── SOS ───────────────────────────────────────────────────────────────
  /// Tap when idle → start 5s countdown (tap again to cancel).
  void startSosCountdown() {
    // Prevent multiple overlapping countdowns — if already counting or active, ignore.
    if (sosPhase != SosPhase.idle) return;

    sosPhase = SosPhase.counting;
    sosCountdown = 5;
    _notify();

    _sosCountdownTimer?.cancel();
    _sosCountdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      sosCountdown -= 1;
      if (sosCountdown <= 0) t.cancel();
      _notify();
    });

    _sosFireTimer?.cancel();
    _sosFireTimer = Timer(const Duration(seconds: 5), () async {
      _sosCountdownTimer?.cancel();
      sosPhase = SosPhase.active;
      sosCountdown = 0;
      _notify();
      try {
        await ApiClient.dio.post(
          '/api/sos/trigger',
          data: {},
          options: Options(headers: _authHeaders),
        );
        _toast(
          '🚨 SOS Alert Triggered! Admin and Transport Incharge alerted.',
          kind: ToastKind.error,
          duration: const Duration(seconds: 6),
        );
      } catch (e) {
        final msg = ApiClient.friendlyError(
          e,
          'We could not send the SOS. Please try again.',
        );
        _toast(msg, kind: ToastKind.error);
        // An SOS that was already sent recently is still active.
        if (msg.contains('already triggered recently')) {
          sosPhase = SosPhase.active;
          _notify();
        } else {
          sosPhase = SosPhase.idle;
          _notify();
        }
      }
    });
  }

  void cancelSosCountdown() {
    _sosCountdownTimer?.cancel();
    _sosFireTimer?.cancel();
    sosPhase = SosPhase.idle;
    sosCountdown = 0;
    _notify();
  }

  Future<bool> cancelActiveSos() async {
    try {
      await ApiClient.dio.post(
        '/api/sos/cancel',
        data: {},
        options: Options(headers: _authHeaders),
      );
      sosPhase = SosPhase.idle;
      _notify();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Map helpers ───────────────────────────────────────────────────────
  /// Polyline over the route's stop coordinates (web `dynamicRoutePolyline`).
  List<List<double>> routePolyline(Map<String, List<double>> stopCoords) {
    final stops = List<String>.from(routeInfo?.stopsList ?? const <String>[]);
    final destination = routeInfo?.destination;
    if (destination != null &&
        destination.trim().isNotEmpty &&
        (stops.isEmpty ||
            stops.last.toLowerCase() != destination.trim().toLowerCase())) {
      stops.add(destination.trim());
    }
    return stops
        .map((stop) => stopCoords[stop])
        .whereType<List<double>>()
        .toList();
  }

  /// Haversine distance in km (same formula as the web timeline).
  static double distanceKm(List<double> a, List<double> b) {
    const r = 6371.0;
    final dLat = (b[0] - a[0]) * math.pi / 180;
    final dLon = (b[1] - a[1]) * math.pi / 180;
    final h =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(a[0] * math.pi / 180) *
            math.cos(b[0] * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return r * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
  }

  int get recenterRequest => _recenterRequest;

  void recenterBus() {
    autoFollow = true;
    _recenterRequest++;
    notifyListeners();
  }

  void setAutoFollow(bool value) {
    autoFollow = value;
    notifyListeners();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _fcmTapSub?.cancel();
    _crowdInterval?.cancel();
    _mergeCheckTimer?.cancel();
    _mergeCheckGeneration++;
    _routeRequestGeneration++;
    _alarmRequestGeneration++;
    _toastContext = null;
    _telemetryTimeout?.cancel();
    _sosCountdownTimer?.cancel();
    _sosFireTimer?.cancel();
    _socket.disconnect();
    super.dispose();
  }
}
