import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:workmanager/workmanager.dart';
import 'api_service.dart';
import 'offline_queue_service.dart';
import '../models/attendance_payload.dart';

class SyncService {
  final ApiService _apiService = ApiService();
  final OfflineQueueService _queueService = OfflineQueueService();

  Future<void> syncOfflineData() async {
    final connectivityResult = await (Connectivity().checkConnectivity());
    if (connectivityResult.contains(ConnectivityResult.none)) {
      return; // Still offline
    }

    final queue = await _queueService.getQueue();
    if (queue.isEmpty) return;

    print('Attempting to sync ${queue.length} offline records...');
    
    // Group by route_id (assuming we stored SyncAttendancePayload in queue)
    Map<String, List<Map<String, dynamic>>> groupedByRoute = {};
    
    for (var item in queue) {
      try {
        final payloadJson = jsonDecode(item['payload']);
        final payload = SyncAttendancePayload.fromJson(payloadJson);
        
        if (!groupedByRoute.containsKey(payload.routeId)) {
          groupedByRoute[payload.routeId] = [];
        }
        
        // Save the db row id and the record itself
        groupedByRoute[payload.routeId]!.add({
          'db_id': item['id'],
          'record': payload.records.first,
        });
      } catch (e) {
        print('Error parsing queue item ${item['id']}: $e');
        // Delete malformed items
        await _queueService.deleteItem(item['id']);
      }
    }

    // Send bulk request per route
    for (var entry in groupedByRoute.entries) {
      final routeId = entry.key;
      final items = entry.value;
      
      final bulkPayload = SyncAttendancePayload(
        routeId: routeId,
        records: items.map((e) => e['record'] as AttendanceRecord).toList(),
      );

      final success = await _apiService.postAttendance(bulkPayload);
      if (success) {
        // Delete all successful items from queue
        for (var item in items) {
          await _queueService.deleteItem(item['db_id']);
        }
        print('Successfully bulk synced ${items.length} records for route $routeId');
      } else {
        print('Failed to bulk sync route $routeId');
      }
    }
  }

  static void initializeWorkManager() {
    Workmanager().initialize(
      callbackDispatcher,
      isInDebugMode: false,
    );
    
    Workmanager().registerPeriodicTask(
      "offlineSyncTask",
      "syncOfflineData",
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
      ),
    );
  }
}

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task == "syncOfflineData") {
      final syncService = SyncService();
      await syncService.syncOfflineData();
    }
    return Future.value(true);
  });
}
