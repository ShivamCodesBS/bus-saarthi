import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/grievance_model.dart';
import '../models/route_model.dart';
import '../models/user_model.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';

/// Child summary from `GET /api/parents/me`.
class ParentChild {
  final String loginId;
  final String name;
  final String? routeId;
  final String? feeStatus;
  final bool boardedToday;
  final DateTime? boardedAt;

  const ParentChild({
    required this.loginId,
    required this.name,
    this.routeId,
    this.feeStatus,
    this.boardedToday = false,
    this.boardedAt,
  });

  factory ParentChild.fromJson(Map<String, dynamic> json) {
    DateTime? boardedAt;
    final raw = json['boardedAt'];
    if (raw != null) boardedAt = DateTime.tryParse(raw.toString());
    return ParentChild(
      loginId: (json['loginId'] ?? json['login_id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      routeId: json['routeId']?.toString() ?? json['route_id']?.toString(),
      feeStatus:
          json['feeStatus']?.toString() ?? json['fee_status']?.toString(),
      boardedToday: json['boardedToday'] == true,
      boardedAt: boardedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'loginId': loginId,
    'name': name,
    'routeId': routeId,
    'feeStatus': feeStatus,
    'boardedToday': boardedToday,
    'boardedAt': boardedAt?.toIso8601String(),
  };
}

/// Merge banner state for the child's route.
class ChildMergeInfo {
  final String originalRouteId;
  final String activeRouteId;
  final String? targetBusNumber;
  final String? targetRouteName;

  const ChildMergeInfo({
    required this.originalRouteId,
    required this.activeRouteId,
    this.targetBusNumber,
    this.targetRouteName,
  });

  Map<String, dynamic> toJson() => {
    'originalRouteId': originalRouteId,
    'activeRouteId': activeRouteId,
    'targetBusNumber': targetBusNumber,
    'targetRouteName': targetRouteName,
  };

  factory ChildMergeInfo.fromJson(Map<String, dynamic> json) => ChildMergeInfo(
    originalRouteId: (json['originalRouteId'] ?? '').toString(),
    activeRouteId: (json['activeRouteId'] ?? '').toString(),
    targetBusNumber: json['targetBusNumber']?.toString(),
    targetRouteName: json['targetRouteName']?.toString(),
  );
}

/// Telemetry snapshot for the parent's tracking tab.
class ParentTelemetry {
  final double speed;
  final double heading;
  final String comfort;
  final DateTime lastUpdated;

  const ParentTelemetry({
    required this.speed,
    required this.heading,
    required this.comfort,
    required this.lastUpdated,
  });
}

/// State machine behind the parent dashboard — matching Web ParentDashboard.jsx.
class ParentProvider extends ChangeNotifier {
  final UserModel user;
  BuildContext? _toastContext;

  List<ParentChild> children = [];
  int _selectedChildIndex = 0;

  ParentChild? get child =>
      children.isNotEmpty && _selectedChildIndex < children.length
      ? children[_selectedChildIndex]
      : null;
  int get selectedChildIndex => _selectedChildIndex;
  int get childCount => children.length;

  RouteInfo? routeInfo;
  ChildMergeInfo? mergeInfo;
  List<Map<String, dynamic>> attendanceDays = [];
  int? attendancePercent;
  int? monthlyAttendance;
  int? workingDays;
  List<Map<String, dynamic>> broadcasts = [];
  List<Grievance> childGrievances = [];
  Map<String, dynamic>? speedData;

  // Live tracking
  List<double> busLocation = const [28.3180, 79.4670];
  ParentTelemetry? telemetry;
  bool telemetryStale = false;
  bool autoFollow = true;

  bool isLoading = true;
  bool isRefreshing = false;
  final Set<String> _grievanceBusy = {};

  final StudentSocketService _socket = StudentSocketService();
  Timer? _staleTimer;
  bool _disposed = false;
  int _childSelectionGeneration = 0;

  ParentProvider(this.user);

  void attachToastContext(BuildContext context) => _toastContext = context;

  Map<String, String> get _authHeaders => ApiClient.authHeaders(user);

  String get activeRouteId => mergeInfo?.activeRouteId ?? child?.routeId ?? '';

  String get _cacheKey => 'parent_dashboard_cache_${user.loginId}';

  /// Switch to a different child
  void selectChild(int index) {
    if (index >= 0 && index < children.length && index != _selectedChildIndex) {
      _selectedChildIndex = index;
      _childSelectionGeneration++;
      _resetSelectedChildData();
      _fetchAll();
      _fetchChildGrievances();
      _connectTelemetry();
      // Re-fetch speed analytics for current date
      final now = DateTime.now();
      final date =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      fetchSpeedAnalytics(date);
    }
  }

  void _resetSelectedChildData() {
    routeInfo = null;
    mergeInfo = null;
    attendanceDays = [];
    attendancePercent = null;
    monthlyAttendance = null;
    workingDays = null;
    speedData = null;
    telemetry = null;
    telemetryStale = false;
    busLocation = const [28.3180, 79.4670];
    _staleTimer?.cancel();
    _notify();
  }

  Future<void> load() async {
    // 1. SWR Cache load: Unblock UI in 0ms if previous session data exists
    await _loadFromCache();

    // 2. Fetch fresh data in background
    await Future.wait([
      _fetchAll(),
      _fetchBroadcasts(),
      _fetchChildGrievances(),
    ]);

    _connectTelemetry();
  }

  Future<void> refresh() async {
    isRefreshing = true;
    _notify();
    await Future.wait([
      _fetchAll(),
      _fetchBroadcasts(),
      _fetchChildGrievances(),
    ]);
    isRefreshing = false;
    _notify();
  }

  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null || raw.isEmpty) return;

      final data = jsonDecode(raw);
      if (data is! Map) return;

      if (data['children'] is List) {
        children = (data['children'] as List)
            .whereType<Map>()
            .map((e) => ParentChild.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }

      if (data['attendance'] is Map) {
        final att = Map<String, dynamic>.from(data['attendance'] as Map);
        attendancePercent = int.tryParse('${att['attendancePercent'] ?? 0}');
        monthlyAttendance = int.tryParse('${att['monthlyAttendance'] ?? 0}');
        workingDays = int.tryParse('${att['workingDays'] ?? 0}');
        if (att['days'] is List) {
          attendanceDays = (att['days'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
      }

      if (data['routeInfo'] is Map) {
        routeInfo = RouteInfo.fromJson(
          Map<String, dynamic>.from(data['routeInfo'] as Map),
        );
      }

      if (data['broadcasts'] is List) {
        broadcasts = (data['broadcasts'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }

      if (children.isNotEmpty) {
        isLoading = false;
        _notify();
      }
    } catch (_) {}
  }

  Future<void> _saveToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheData = {
        'children': children.map((c) => c.toJson()).toList(),
        'attendance': {
          'attendancePercent': attendancePercent,
          'monthlyAttendance': monthlyAttendance,
          'workingDays': workingDays,
          'days': attendanceDays,
        },
        'routeInfo': routeInfo?.toJson(),
        'broadcasts': broadcasts,
      };
      await prefs.setString(_cacheKey, jsonEncode(cacheData));
    } catch (_) {}
  }

  Future<void> _fetchAll() async {
    final generation = ++_childSelectionGeneration;
    try {
      final res = await ApiClient.dio.get(
        '/api/parents/me',
        options: Options(headers: _authHeaders),
      );
      if (generation != _childSelectionGeneration || _disposed) return;
      final data = res.data is Map ? Map<String, dynamic>.from(res.data) : {};
      final childrenList = data['children'];
      if (childrenList is List && childrenList.isNotEmpty) {
        children = childrenList
            .whereType<Map>()
            .map((e) => ParentChild.fromJson(Map<String, dynamic>.from(e)))
            .toList();

        if (_selectedChildIndex >= children.length) _selectedChildIndex = 0;
        await _fetchChildData(children[_selectedChildIndex], generation);
      }
      _saveToCache();
    } catch (_) {
    } finally {
      if (generation == _childSelectionGeneration) {
        isLoading = false;
        _notify();
      }
    }
  }

  bool _isCurrentChildRequest(int generation) =>
      generation == _childSelectionGeneration && !_disposed;

  /// Fetch data for a specific child, ignoring stale selection responses.
  Future<void> _fetchChildData(ParentChild child, int generation) async {
    // Attendance
    try {
      final attRes = await ApiClient.dio.get(
        '/api/parents/child/${child.loginId}/attendance',
        options: Options(headers: _authHeaders),
      );
      if (!_isCurrentChildRequest(generation)) return;
      final att = attRes.data is Map
          ? Map<String, dynamic>.from(attRes.data)
          : {};
      attendancePercent = int.tryParse(
        '${att['attendancePercent'] ?? att['percent'] ?? 0}',
      );
      monthlyAttendance = int.tryParse(
        '${att['monthlyAttendance'] ?? att['presentDays'] ?? 0}',
      );
      workingDays = int.tryParse(
        '${att['workingDays'] ?? att['totalDays'] ?? 0}',
      );
      final days = att['days'] ?? att['records'];
      if (days is List) {
        attendanceDays = days
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    } catch (_) {
      if (!_isCurrentChildRequest(generation)) return;
    }

    if (!_isCurrentChildRequest(generation)) return;

    // Merge check + route info
    if (child.routeId != null && child.routeId!.isNotEmpty) {
      String activeRoute = child.routeId!;
      try {
        final mRes = await ApiClient.dio.get(
          '/api/merge/check/${child.routeId}',
          options: Options(headers: _authHeaders),
        );
        if (!_isCurrentChildRequest(generation)) return;
        if (mRes.data is Map &&
            mRes.data['status'] == 'success' &&
            mRes.data['data']?['isCancelled'] == true &&
            mRes.data['data']?['merge'] != null) {
          final m = Map<String, dynamic>.from(
            mRes.data['data']['merge'] as Map,
          );
          activeRoute = m['targetRouteId']?.toString() ?? activeRoute;
          mergeInfo = ChildMergeInfo(
            originalRouteId: child.routeId!,
            activeRouteId: activeRoute,
            targetBusNumber: m['targetBusNumber']?.toString(),
            targetRouteName: m['targetRouteName']?.toString(),
          );
        } else {
          mergeInfo = null;
        }
      } catch (_) {}

      if (!_isCurrentChildRequest(generation)) return;
      try {
        final routeRes = await ApiClient.dio.get(
          '/api/routes/$activeRoute',
          options: Options(headers: _authHeaders),
        );
        if (!_isCurrentChildRequest(generation)) return;
        if (routeRes.data is Map) {
          routeInfo = RouteInfo.fromJson(
            Map<String, dynamic>.from(routeRes.data),
          );
        }
      } catch (_) {}
    }
  }

  Future<void> _fetchBroadcasts() async {
    try {
      final res = await ApiClient.dio.get(
        '/api/notifications',
        options: Options(headers: _authHeaders),
      );
      final data = res.data;
      final List list = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] as List : []);
      broadcasts = list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _notify();
    } catch (_) {}
  }

  Future<void> _fetchChildGrievances() async {
    final generation = _childSelectionGeneration;
    try {
      final res = await ApiClient.dio.get(
        '/api/parents/grievances',
        options: Options(headers: _authHeaders),
      );
      if (!_isCurrentChildRequest(generation)) return;
      final data = res.data;
      final List list = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] as List : []);
      childGrievances = list
          .whereType<Map>()
          .map(
            (g) =>
                Grievance.fromJson(Map<String, dynamic>.from(g), user.loginId),
          )
          .toList();
      _notify();
    } catch (_) {}
  }

  void _connectTelemetry() {
    final route = activeRouteId;
    if (route.isEmpty) return;
    _socket.onLiveTelemetry = (data) {
      final location = data['location'];
      if (location is Map &&
          location['lat'] != null &&
          location['lng'] != null) {
        busLocation = [
          double.tryParse('${location['lat']}') ?? busLocation[0],
          double.tryParse('${location['lng']}') ?? busLocation[1],
        ];
      }
      final rawSpeed = double.tryParse('${data['speed'] ?? 0}') ?? 0;
      telemetry = ParentTelemetry(
        speed: rawSpeed < 2.0 ? 0.0 : rawSpeed,
        heading: double.tryParse('${data['heading'] ?? 0}') ?? 0,
        comfort: (data['comfort'] ?? 'Smooth').toString(),
        lastUpdated: DateTime.now(),
      );
      telemetryStale = false;
      _staleTimer?.cancel();
      _staleTimer = Timer(const Duration(seconds: 5), () {
        telemetryStale = true;
        _notify();
      });
      _notify();
    };
    _socket.connect(route, user.loginId);
  }

  // ── Grievance actions (parent-side confirm/reopen/create) ────────────
  bool isGrievanceBusy(String id) => _grievanceBusy.contains(id);

  Future<void> confirmGrievance(String id) async {
    _grievanceBusy.add(id);
    _notify();
    try {
      await ApiClient.dio.patch(
        '/api/grievance/$id/confirm',
        data: {},
        options: Options(headers: _authHeaders),
      );
      childGrievances = childGrievances
          .map((g) => g.id == id ? g.copyWith(status: 'closed') : g)
          .toList();
      ApiClient.toast(
        _toastContext!,
        'Thank you! The complaint is now closed.',
        kind: ToastKind.success,
      );
    } catch (e) {
      ApiClient.toast(
        _toastContext!,
        ApiClient.friendlyError(
          e,
          'We could not confirm the fix. Please try again.',
        ),
        kind: ToastKind.error,
      );
    } finally {
      _grievanceBusy.remove(id);
      _notify();
    }
  }

  Future<void> reopenGrievance(String id, String reason) async {
    _grievanceBusy.add(id);
    _notify();
    try {
      await ApiClient.dio.patch(
        '/api/grievance/$id/reopen',
        data: {'reason': reason},
        options: Options(headers: _authHeaders),
      );
      childGrievances = childGrievances.map((g) {
        if (g.id != id) return g;
        return g.copyWith(
          status: 'reopened',
          reopenCount: g.reopenCount + 1,
          priority: g.priority + 10,
        );
      }).toList();
      ApiClient.toast(
        _toastContext!,
        'Complaint reopened. It is now at the top of the queue.',
        kind: ToastKind.success,
      );
    } catch (e) {
      ApiClient.toast(
        _toastContext!,
        ApiClient.friendlyError(
          e,
          'We could not reopen the complaint. Please try again.',
        ),
        kind: ToastKind.error,
      );
    } finally {
      _grievanceBusy.remove(id);
      _notify();
    }
  }

  Future<bool> createGrievance({required String text, String? category}) async {
    if (text.trim().isEmpty) return false;
    try {
      await ApiClient.dio.post(
        '/api/grievance',
        data: {
          'text': text.trim(),
          'type': 'text',
          'category': category ?? 'General',
          if (activeRouteId.isNotEmpty) 'route': activeRouteId,
          'isAnonymous': false,
        },
        options: Options(headers: _authHeaders),
      );
      ApiClient.toast(
        _toastContext!,
        'Complaint submitted successfully.',
        kind: ToastKind.success,
      );
      await _fetchChildGrievances();
      return true;
    } catch (e) {
      ApiClient.toast(
        _toastContext!,
        ApiClient.friendlyError(e, 'Could not submit complaint.'),
        kind: ToastKind.error,
      );
      return false;
    }
  }

  // ── Speed analytics ───────────────────────────────────────────────────
  Future<void> fetchSpeedAnalytics(String date) async {
    final generation = _childSelectionGeneration;
    final routeId = activeRouteId;
    if (routeId.isEmpty) return;
    try {
      final res = await ApiClient.dio.get(
        '/api/telemetry/history/$routeId?date=$date',
        options: Options(headers: _authHeaders),
      );
      if (!_isCurrentChildRequest(generation) || activeRouteId != routeId) {
        return;
      }
      speedData = res.data is Map ? Map<String, dynamic>.from(res.data) : null;
    } catch (_) {
      if (!_isCurrentChildRequest(generation) || activeRouteId != routeId) {
        return;
      }
      speedData = null;
    }
    _notify();
  }

  // ── Leave marking ─────────────────────────────────────────────────────
  Future<void> markLeave(
    String date, {
    String reason = 'Sick / Medical Leave',
  }) async {
    if (child == null) return;
    try {
      await ApiClient.dio.post(
        '/api/parents/child/${child!.loginId}/leave',
        data: {'date': date, 'reason': reason},
        options: Options(headers: _authHeaders),
      );
      ApiClient.toast(
        _toastContext!,
        'Leave marked for $date ($reason)',
        kind: ToastKind.success,
      );
    } catch (_) {
      ApiClient.toast(
        _toastContext!,
        'We could not mark the leave. Please try again.',
        kind: ToastKind.error,
      );
    }
  }

  void setAutoFollow(bool v) {
    autoFollow = v;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _staleTimer?.cancel();
    _socket.disconnect();
    super.dispose();
  }
}
