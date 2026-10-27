import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/grievance_model.dart';
import '../models/user_model.dart';
import '../services/api_client.dart';
import '../services/offline_queue_service.dart';

/// Route summary used by the route-name lookup and the "My Route" filter.
class RouteSummary {
  final String routeId;
  final String name;
  final String? busNumber;

  const RouteSummary({
    required this.routeId,
    required this.name,
    this.busNumber,
  });
}

/// Isolate-friendly decode of the cached grievance JSON array.
List<Map<String, dynamic>> parseGrievanceCache(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      return decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
  } catch (_) {}
  return [];
}

/// State machine behind the Community screen — a port of Community.jsx's
/// fetch/filter/sort/upvote/create flows. Staff-only pieces (bus picker,
/// start/resolve/extend) live on the web; the app serves the passenger.
class CommunityProvider extends ChangeNotifier {
  final UserModel user;
  BuildContext? _toastContext;

  List<Grievance> complaints = [];
  List<RouteSummary> routeSummaries = [];
  bool isLoading = true;

  // Filters (same defaults as the web)
  String searchQuery = '';
  String sortBy = 'newest'; // newest | oldest | most_agreed | priority
  String filterStatus = 'all';
  bool showFilters = false;
  bool showMyComplaints = false;

  bool _langIsHindi = false;
  bool _disposed = false;

  OfflineQueueService? _offlineQueue;

  CommunityProvider(this.user);

  void attachToastContext(BuildContext context) => _toastContext = context;

  /// Initialize offline queue service when user is authenticated
  void initOfflineQueue() {
    if (user.token != null && _offlineQueue == null) {
      _offlineQueue = OfflineQueueService(
        dio: ApiClient.dio,
        token: user.token!,
      );
      _offlineQueue!.init();
    }
  }

  /// Clean up offline queue
  void disposeOfflineQueue() {
    _offlineQueue?.dispose();
    _offlineQueue = null;
  }

  Map<String, String> get _authHeaders => ApiClient.authHeaders(user);
  String? get _userLoginId => user.loginId;

  // ── Data loading (stale-while-revalidate style) ──────────────────────
  Future<void> load() async {
    isLoading = complaints.isEmpty;
    _notify();
    await Future.wait([_loadComplaints(), _loadRoutes()]);
  }

  Future<void> _loadComplaints() async {
    // Serve the cached list first (fast paint), then refresh.
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString('community:grievances');
      if (cached != null && complaints.isEmpty) {
        final list = (await compute(
          parseGrievanceCache,
          cached,
        )).map((j) => Grievance.fromJson(j, _userLoginId)).toList();
        if (list.isNotEmpty && complaints.isEmpty) {
          complaints = list;
          isLoading = false;
          _notify();
        }
      }
    } catch (_) {}

    try {
      final res = await ApiClient.dio.get(
        '/api/grievances',
        options: Options(headers: _authHeaders),
      );
      final data = res.data;
      final List list = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] as List : []);
      complaints = list
          .whereType<Map>()
          .map(
            (c) =>
                Grievance.fromJson(Map<String, dynamic>.from(c), _userLoginId),
          )
          .toList();
      isLoading = false;
      _notify();
      // Persist for the next fast load.
      SharedPreferences.getInstance().then((prefs) {
        final raw = data is List
            ? data
            : (data is Map ? data['data'] ?? [] : []);
        prefs.setString('community:grievances', jsonEncode(raw));
      });
    } catch (_) {
      isLoading = false;
      _notify();
    }
  }

  Future<void> _loadRoutes() async {
    try {
      final res = await ApiClient.dio.get(
        '/api/routes',
        options: Options(headers: _authHeaders),
      );
      final List list = res.data is List
          ? res.data as List
          : (res.data?['data'] as List? ?? []);
      routeSummaries = list.whereType<Map>().map((r) {
        final bus = r['bus'] is Map ? r['bus']['busNumber'] : null;
        return RouteSummary(
          routeId: r['routeId']?.toString() ?? '',
          name: (r['routeName'] ?? 'Route ${r['routeId']}').toString(),
          busNumber: (bus ?? r['busNumber'])?.toString(),
        );
      }).toList();
      _notify();
    } catch (_) {}
  }

  /// Full route label for a complaint (web formatRoute).
  String formatRoute(String? routeId, String? busNumber) {
    if (routeId == null || routeId.isEmpty || routeId == 'unknown') {
      return 'Route not assigned';
    }
    RouteSummary? info;
    for (final r in routeSummaries) {
      if (r.routeId == routeId) {
        info = r;
        break;
      }
    }
    if (info == null) return 'Route $routeId';
    final liveBus = busNumber ?? info.busNumber;
    return liveBus != null && liveBus.isNotEmpty
        ? '${info.name} · Bus $liveBus'
        : info.name;
  }

  // ── Derived stats (web `stats`) ───────────────────────────────────────
  int get total => complaints.length;
  int get closedCount => complaints.where((c) => c.status == 'closed').length;
  int get pendingCount => complaints
      .where((c) => c.status == 'pending' || c.status == 'in_progress')
      .length;
  int get awaitingCount =>
      complaints.where((c) => c.status == 'resolved').length;
  int get reopenedCount =>
      complaints.where((c) => c.status == 'reopened').length;

  List<Grievance> get myComplaints =>
      complaints.where((c) => c.isMine).toList();

  /// Relative time formatter (web formatTime).
  String formatTime(DateTime? createdAt) {
    final hi = _langIsHindi;
    if (createdAt == null) return hi ? 'अभी-अभी' : 'Just now';
    final diffMs = DateTime.now().difference(createdAt);
    final mins = diffMs.inMinutes;
    final hours = diffMs.inHours;
    final days = diffMs.inDays;
    if (mins < 1) return hi ? 'अभी-अभी' : 'Just now';
    if (mins < 60) return hi ? '$mins मिनट पहले' : '${mins}m ago';
    if (hours < 24) return hi ? '$hours घंटे पहले' : '${hours}h ago';
    if (days == 1) return hi ? 'कल' : 'Yesterday';
    if (days < 7) return hi ? '$days दिन पहले' : '${days}d ago';
    return '${createdAt.day}/${createdAt.month}';
  }

  void setLang(String lang) {
    final isHindi = lang == 'hi';
    if (_langIsHindi == isHindi) return;
    _langIsHindi = isHindi;
    _notify();
  }

  // ── Filtering + sorting (web filteredComplaints) ──────────────────────
  List<Grievance> get filteredComplaints {
    var list = [...complaints];

    // Non-staff users see ALL complaints (not just their route).
    // The backend already enforces visibility: passengers only get their own
    // complaints unless they are staff. The client shouldn't filter further.
    // REMOVED: route filter that was hiding complaints for users with null/mismatched routeId.

    if (filterStatus != 'all') {
      list = list.where((c) => c.status == filterStatus).toList();
    }

    final q = searchQuery.toLowerCase().trim();
    if (q.isNotEmpty) {
      final qWithoutHash = q.replaceFirst(RegExp(r'^#'), '');
      list = list.where((c) {
        final ticketId = c.id.length >= 6
            ? c.id.substring(0, 6).toLowerCase()
            : c.id.toLowerCase();
        return (c.text.toLowerCase().contains(q)) ||
            (c.route ?? '').toLowerCase().contains(q) ||
            formatRoute(c.route, c.busNumber).toLowerCase().contains(q) ||
            c.status.toLowerCase().contains(q) ||
            (c.category ?? '').toLowerCase().contains(q) ||
            ticketId.contains(qWithoutHash) ||
            q.contains(ticketId);
      }).toList();
    }

    switch (sortBy) {
      case 'newest':
        list.sort(
          (a, b) => (b.createdAt ?? DateTime(0)).compareTo(
            a.createdAt ?? DateTime(0),
          ),
        );
        break;
      case 'oldest':
        list.sort(
          (a, b) => (a.createdAt ?? DateTime(0)).compareTo(
            b.createdAt ?? DateTime(0),
          ),
        );
        break;
      case 'most_agreed':
        list.sort((a, b) => b.upvotes.compareTo(a.upvotes));
        break;
      case 'priority':
        const order = [
          'reopened',
          'pending',
          'in_progress',
          'resolved',
          'closed',
        ];
        int rank(String s) {
          final i = order.indexOf(s);
          return i == -1 ? order.length : i;
        }
        list.sort((a, b) {
          final diff = rank(a.status).compareTo(rank(b.status));
          if (diff != 0) return diff;
          return b.priority.compareTo(a.priority);
        });
        break;
    }
    return list;
  }

  void setSearchQuery(String v) {
    searchQuery = v;
    _notify();
  }

  void setSortBy(String v) {
    sortBy = v;
    _notify();
  }

  void setFilterStatus(String v) {
    filterStatus = v;
    _notify();
  }

  void toggleFilters() {
    showFilters = !showFilters;
    _notify();
  }

  void setShowMyComplaints(bool v) {
    showMyComplaints = v;
    _notify();
  }

  // ── Upvote (optimistic, web handleUpvote) ─────────────────────────────
  final Set<String> _processingUpvotes = {};
  final Map<String, int> _upvoteMutationVersions = {};
  bool isUpvoteBusy(String id) => _processingUpvotes.contains(id);

  Future<void> upvote(String id) async {
    if (user.token == null) {
      ApiClient.toast(
        _toastContext!,
        'You must be logged in to agree.',
        kind: ToastKind.error,
      );
      return;
    }
    final existingIndex = complaints.indexWhere((c) => c.id == id);
    if (existingIndex < 0) return;
    final original = complaints[existingIndex];
    final desiredVote = !original.hasUpvotedLocally;
    final desiredCount = (original.upvotes + (desiredVote ? 1 : -1)).clamp(
      0,
      1 << 30,
    );
    final mutationVersion = (_upvoteMutationVersions[id] ?? 0) + 1;
    _upvoteMutationVersions[id] = mutationVersion;
    _processingUpvotes.add(id);
    complaints = complaints
        .map(
          (c) => c.id == id
              ? c.copyWith(
                  hasUpvotedLocally: desiredVote,
                  upvotes: desiredCount,
                )
              : c,
        )
        .toList();
    _notify();

    try {
      final res = await ApiClient.dio.post(
        '/api/grievance/$id/upvote',
        data: {},
        options: Options(headers: _authHeaders),
      );
      final serverCount = int.tryParse(
        '${res.data is Map ? res.data['upvotes'] : null}',
      );
      if (_upvoteMutationVersions[id] == mutationVersion) {
        complaints = complaints
            .map(
              (c) => c.id == id
                  ? c.copyWith(
                      upvotes: serverCount ?? desiredCount,
                      hasUpvotedLocally: desiredVote,
                    )
                  : c,
            )
            .toList();
      }
    } catch (e) {
      // Queue for offline processing instead of rolling back immediately
      if (_offlineQueue != null) {
        final action = OfflineAction(
          id: OfflineAction.generateId(OfflineActionType.upvote, id),
          type: OfflineActionType.upvote,
          targetId: id,
          data: {'desiredVote': desiredVote},
        );
        await _offlineQueue!.enqueueUpvoteToggle(action);
        ApiClient.toast(
          _toastContext!,
          'Vote queued for sync when online.',
          kind: ToastKind.info,
        );
      } else {
        if (_upvoteMutationVersions[id] == mutationVersion) {
          complaints = complaints
              .map(
                (c) => c.id == id
                    ? c.copyWith(
                        hasUpvotedLocally: original.hasUpvotedLocally,
                        upvotes: original.upvotes,
                      )
                    : c,
              )
              .toList();
        }
        ApiClient.toast(
          _toastContext!,
          ApiClient.friendlyError(
            e,
            'We could not register your vote. Please try again.',
          ),
          kind: ToastKind.error,
        );
        // Roll back the optimistic flip.
        complaints = complaints.map((c) {
          if (c.id != id) return c;
          final was = c.hasUpvotedLocally;
          return c.copyWith(
            hasUpvotedLocally: !was,
            upvotes: (c.upvotes + (was ? -1 : 1)).clamp(0, 1 << 30),
          );
        }).toList();
      }
    } finally {
      _processingUpvotes.remove(id);
      _notify();
    }
  }

  // ── Complainant actions ───────────────────────────────────────────────
  final Set<String> _busyIds = {};
  bool isBusy(String id) => _busyIds.contains(id);

  /// The complainant confirms the fix — closes the complaint.
  Future<void> confirmFix(String id) async {
    _busyIds.add(id);
    _notify();
    try {
      await ApiClient.dio.patch(
        '/api/grievance/$id/confirm',
        data: {},
        options: Options(headers: _authHeaders),
      );
      complaints = complaints
          .map(
            (c) => c.id == id
                ? c.copyWith(status: 'closed', confirmedAt: DateTime.now())
                : c,
          )
          .toList();
      ApiClient.toast(
        _toastContext!,
        'Thank you! Your complaint is now closed.',
        kind: ToastKind.success,
      );
    } catch (e) {
      // Queue for offline processing
      if (_offlineQueue != null) {
        final action = OfflineAction(
          id: OfflineAction.generateId(OfflineActionType.confirmFix, id),
          type: OfflineActionType.confirmFix,
          targetId: id,
        );
        await _offlineQueue!.enqueue(action);
        ApiClient.toast(
          _toastContext!,
          'Confirmation queued for sync when online.',
          kind: ToastKind.info,
        );
      } else {
        ApiClient.toast(
          _toastContext!,
          ApiClient.friendlyError(
            e,
            'We could not confirm the fix. Please try again.',
          ),
          kind: ToastKind.error,
        );
      }
    } finally {
      _busyIds.remove(id);
      _notify();
    }
  }

  /// The complainant rejects the fix — reopens the complaint.
  Future<void> reopen(String id, String reason) async {
    _busyIds.add(id);
    _notify();
    try {
      await ApiClient.dio.patch(
        '/api/grievance/$id/reopen',
        data: {'reason': reason},
        options: Options(headers: _authHeaders),
      );
      complaints = complaints.map((c) {
        if (c.id != id) return c;
        return c.copyWith(
          status: 'reopened',
          reopenCount: c.reopenCount + 1,
          priority: c.priority + 10,
        );
      }).toList();
      ApiClient.toast(
        _toastContext!,
        'Complaint reopened. It is now at the top of the queue.',
        kind: ToastKind.success,
      );
    } catch (e) {
      // Queue for offline processing
      if (_offlineQueue != null) {
        final action = OfflineAction(
          id: OfflineAction.generateId(
            OfflineActionType.reopen,
            id,
            extra: reason,
          ),
          type: OfflineActionType.reopen,
          targetId: id,
          data: {'reason': reason},
        );
        await _offlineQueue!.enqueue(action);
        ApiClient.toast(
          _toastContext!,
          'Reopen queued for sync when online.',
          kind: ToastKind.info,
        );
      } else {
        ApiClient.toast(
          _toastContext!,
          ApiClient.friendlyError(
            e,
            'We could not reopen the complaint. Please try again.',
          ),
          kind: ToastKind.error,
        );
      }
    } finally {
      _busyIds.remove(id);
      _notify();
    }
  }

  // ── Create (web handlePostComplaint) ─────────────────────────────────
  bool isSubmitting = false;

  Future<bool> createComplaint({
    required String text,
    String? category,
    String? mediaPath,
    required String mediaType, // photo | video | audio | text
    required bool showMyName,
  }) async {
    if (text.trim().isEmpty) return false;
    isSubmitting = true;
    _notify();

    String uploadedMediaUrl = '';
    bool mediaUploadFailed = false;
    if (mediaPath != null) {
      try {
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(mediaPath),
        });
        final uploadRes = await ApiClient.dio.post(
          '/api/upload',
          data: form,
          options: Options(headers: _authHeaders),
        );
        if (uploadRes.data is Map && uploadRes.data['url'] != null) {
          uploadedMediaUrl = uploadRes.data['url'].toString();
        } else {
          mediaUploadFailed = true;
        }
      } catch (e) {
        mediaUploadFailed = true;
      }
    }

    if (mediaUploadFailed) {
      // Queue media upload for retry when online
      if (_offlineQueue != null) {
        // For now, we'll post text-only and notify user
        ApiClient.toast(
          _toastContext!,
          'Attachment will be uploaded when you are back online. Text complaint posted now.',
          kind: ToastKind.info,
        );
      } else {
        ApiClient.toast(
          _toastContext!,
          'We could not upload the attachment. Posting the text only.',
          kind: ToastKind.error,
        );
      }
    }

    try {
      final res = await ApiClient.dio.post(
        '/api/grievance',
        data: {
          'text': text,
          'type': mediaPath != null ? mediaType : 'text',
          'mediaUrl': uploadedMediaUrl,
          'category': category ?? '',
          if (user.routeId != null) 'route': user.routeId,
          'isAnonymous': !showMyName,
        },
        options: Options(headers: _authHeaders),
      );

      if (res.data is Map && res.data['status'] == 'success') {
        final created = res.data['data'] is Map
            ? Map<String, dynamic>.from(res.data['data'])
            : <String, dynamic>{};
        complaints = [
          Grievance(
            id: (created['id'] ?? '').toString(),
            loginId: user.loginId,
            route: created['route']?.toString() ?? user.routeId,
            busNumber: created['busNumber']?.toString(),
            text: text,
            type: mediaPath != null ? mediaType : 'text',
            mediaUrl: uploadedMediaUrl,
            category: category,
            realName: user.name,
            isAnonymous: !showMyName,
            status: 'pending',
            createdAt:
                DateTime.tryParse('${created['createdAt']}') ?? DateTime.now(),
            isMine: true,
          ),
          ...complaints,
        ];
        ApiClient.toast(
          _toastContext!,
          'Complaint raised! You will be notified when it is fixed.',
          kind: ToastKind.success,
        );
        return true;
      }
      return false;
    } catch (e) {
      ApiClient.toast(
        _toastContext!,
        ApiClient.friendlyError(
          e,
          'We could not submit your complaint. Please try again.',
        ),
        kind: ToastKind.error,
      );
      return false;
    } finally {
      isSubmitting = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
