import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Offline queue for actions that need server sync (upvotes, etc.)
/// Items are persisted to SharedPreferences and processed when online.
class OfflineQueueService {
  static const String _queueKey = 'offline_queue';
  static const String _processedKey = 'offline_queue_processed';

  final Connectivity _connectivity;
  final Dio _dio;
  final String _token;
  final Future<SharedPreferences> Function() _preferencesProvider;
  final Future<bool> Function(OfflineAction action)? _actionProcessor;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Future<void> _operations = Future<void>.value();
  bool _isProcessing = false;

  OfflineQueueService({
    required Dio dio,
    required String token,
    Connectivity? connectivity,
    Future<SharedPreferences> Function()? preferencesProvider,
    Future<bool> Function(OfflineAction action)? actionProcessor,
  }) : _dio = dio,
       _token = token,
       _connectivity = connectivity ?? Connectivity(),
       _preferencesProvider =
           preferencesProvider ?? SharedPreferences.getInstance,
       _actionProcessor = actionProcessor;

  /// Initialize and start listening for connectivity changes
  Future<void> init() async {
    // Process any pending items immediately if online
    final results = await _connectivity.checkConnectivity();
    if (!_isOffline(results)) {
      await processQueue();
    }

    // Listen for connectivity changes
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((
      results,
    ) async {
      if (!_isOffline(results) && !_isProcessing) {
        await processQueue();
      }
    });
  }

  bool _isOffline(List<ConnectivityResult> results) {
    return results.any((r) => r == ConnectivityResult.none);
  }

  /// Add an action to the offline queue
  Future<T> _serialize<T>(Future<T> Function() operation) {
    final result = _operations.then((_) => operation());
    _operations = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  Future<void> enqueue(OfflineAction action) => _serialize(() async {
    final prefs = await _preferencesProvider();
    final queue = await _getQueue(prefs);
    if (!queue.any((item) => item is Map && item['id'] == action.id)) {
      queue.add(action.toJson());
      await prefs.setString(_queueKey, jsonEncode(queue));
    }
  });

  /// Coalesce queued upvotes to the latest intended vote state.
  Future<void> enqueueUpvoteToggle(OfflineAction action) =>
      _serialize(() async {
        final prefs = await _preferencesProvider();
        final queue = await _getQueue(prefs);
        final existingIndex = queue.indexWhere(
          (item) =>
              item is Map &&
              item['type'] == OfflineActionType.upvote.name &&
              item['targetId'] == action.targetId,
        );
        if (existingIndex >= 0) {
          final previous = _tryParseAction(queue[existingIndex]);
          final attempts =
              (int.tryParse('${previous?.data?['attempts'] ?? 0}') ?? 0) + 1;
          queue[existingIndex] = action
              .copyWith(
                id: previous?.id,
                data: {...?action.data, 'attempts': attempts},
              )
              .toJson();
        } else {
          queue.add(
            action.copyWith(data: {...?action.data, 'attempts': 1}).toJson(),
          );
        }
        await prefs.setString(_queueKey, jsonEncode(queue));
      });

  /// Get all valid queued actions; malformed entries are left for processing cleanup.
  Future<List<OfflineAction>> getQueue() async {
    final prefs = await _preferencesProvider();
    final queue = await _getQueue(prefs);
    return queue.map(_tryParseAction).whereType<OfflineAction>().toList();
  }

  Future<List<dynamic>> _getQueue(SharedPreferences prefs) async {
    final raw = prefs.getString(_queueKey);
    if (raw == null) return [];
    try {
      final decoded = jsonDecode(raw);
      return decoded is List ? decoded : <dynamic>[];
    } catch (_) {
      return [];
    }
  }

  OfflineAction? _tryParseAction(dynamic item) {
    if (item is! Map) return null;
    try {
      return OfflineAction.fromJson(Map<String, dynamic>.from(item));
    } catch (_) {
      return null;
    }
  }

  /// Process pending actions one by one. Enqueue and processing share a serial
  /// operation chain, so items added during a sync are never overwritten.
  Future<void> processQueue() => _serialize(() async {
    if (_isProcessing) return;
    _isProcessing = true;
    try {
      final prefs = await _preferencesProvider();
      final queue = await _getQueue(prefs);
      final processedIds = <String>{};
      final processedRaw = prefs.getString(_processedKey);
      if (processedRaw != null) {
        try {
          final decoded = jsonDecode(processedRaw);
          if (decoded is List) processedIds.addAll(decoded.whereType<String>());
        } catch (_) {}
      }

      final remaining = <dynamic>[];
      var changed = false;
      for (final item in queue) {
        final action = _tryParseAction(item);
        if (action == null || processedIds.contains(action.id)) {
          changed = true;
          continue;
        }
        try {
          if (await (_actionProcessor ?? _processAction)(action)) {
            processedIds.add(action.id);
            changed = true;
          } else {
            changed = true;
            remaining.add(_recordAttempt(item, action));
          }
        } catch (_) {
          // Network and per-item errors remain retryable without blocking later items.
          changed = true;
          remaining.add(_recordAttempt(item, action));
        }
      }
      if (changed) {
        await prefs.setString(_queueKey, jsonEncode(remaining));
        await prefs.setString(_processedKey, jsonEncode(processedIds.toList()));
      }
    } finally {
      _isProcessing = false;
    }
  });

  dynamic _recordAttempt(dynamic item, OfflineAction action) {
    final attempts =
        (int.tryParse('${action.data?['attempts'] ?? 0}') ?? 0) + 1;
    return action
        .copyWith(data: {...?action.data, 'attempts': attempts})
        .toJson();
  }

  /// Mark an action as no longer pending after server reconciliation.
  Future<void> removeAction(String id) => _serialize(() async {
    final prefs = await _preferencesProvider();
    final queue = await _getQueue(prefs);
    final filtered = queue
        .where((item) => item is! Map || item['id'] != id)
        .toList();
    await prefs.setString(_queueKey, jsonEncode(filtered));
  });

  /// Process a single action
  Future<bool> _processAction(OfflineAction action) async {
    switch (action.type) {
      case OfflineActionType.upvote:
        try {
          final desiredVote = action.data?['desiredVote'];
          if (desiredVote is bool) {
            // The backend endpoint toggles. Read the authenticated list first so
            // retries only toggle when the persisted vote differs from intent.
            final response = await _dio.get(
              '/api/grievances',
              options: Options(headers: {'Authorization': 'Bearer $_token'}),
            );
            final responseData = response.data;
            final dynamic entries = responseData is List
                ? responseData
                : (responseData is Map ? responseData['data'] : null);
            if (entries is! List) return false;
            Map? item;
            for (final entry in entries) {
              if (entry is Map &&
                  (entry['id'] ?? entry['_id']).toString() == action.targetId) {
                item = entry;
                break;
              }
            }
            if (item == null || item['hasUpvotedLocally'] is! bool) {
              return false;
            }
            if (item['hasUpvotedLocally'] == desiredVote) return true;
          }
          await _dio.post(
            '/api/grievance/${action.targetId}/upvote',
            data: {},
            options: Options(headers: {'Authorization': 'Bearer $_token'}),
          );
          return true;
        } catch (_) {
          return false;
        }
      case OfflineActionType.confirmFix:
        try {
          await _dio.patch(
            '/api/grievance/${action.targetId}/confirm',
            data: {},
            options: Options(headers: {'Authorization': 'Bearer $_token'}),
          );
          return true;
        } catch (_) {
          return false;
        }
      case OfflineActionType.reopen:
        try {
          await _dio.patch(
            '/api/grievance/${action.targetId}/reopen',
            data: action.data,
            options: Options(headers: {'Authorization': 'Bearer $_token'}),
          );
          return true;
        } catch (_) {
          return false;
        }
    }
  }

  /// Clear the queue (e.g., on logout)
  Future<void> clear() => _serialize(() async {
    final prefs = await _preferencesProvider();
    await prefs.remove(_queueKey);
    await prefs.remove(_processedKey);
  });

  void dispose() {
    _connectivitySubscription?.cancel();
  }
}

/// Types of offline actions
enum OfflineActionType { upvote, confirmFix, reopen }

/// An action that can be queued offline
class OfflineAction {
  final String id; // Unique ID for deduplication
  final OfflineActionType type;
  final String targetId; // Grievance ID
  final Map<String, dynamic>? data; // Extra data (e.g., reopen reason)
  final DateTime timestamp;

  OfflineAction({
    required this.id,
    required this.type,
    required this.targetId,
    this.data,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  OfflineAction copyWith({String? id, Map<String, dynamic>? data}) =>
      OfflineAction(
        id: id ?? this.id,
        type: type,
        targetId: targetId,
        data: data ?? this.data,
        timestamp: timestamp,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'targetId': targetId,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
  };

  factory OfflineAction.fromJson(Map<String, dynamic> json) => OfflineAction(
    id: json['id'] as String,
    type: OfflineActionType.values.byName(json['type'] as String),
    targetId: json['targetId'] as String,
    data: json['data'] as Map<String, dynamic>?,
    timestamp: DateTime.parse(json['timestamp'] as String),
  );

  static String generateId(
    OfflineActionType type,
    String targetId, {
    String? extra,
  }) {
    return '${type.name}_${targetId}_${extra ?? DateTime.now().millisecondsSinceEpoch}';
  }
}
