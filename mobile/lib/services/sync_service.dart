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

    for (var item in queue) {
      try {
        final payloadJson = jsonDecode(item['payload']);
        // Reconstruct AttendancePayload (this assumes it's an attendance payload for now)
        final data = AttendanceData.fromJson(payloadJson['data']);
        final payload = AttendancePayload(data: data);

        final success = await _apiService.postAttendance(payload);
        if (success) {
          await _queueService.deleteItem(item['id']);
          print('Synced record ${item['id']}');
        }
      } catch (e) {
        print('Failed to sync record ${item['id']}: $e');
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
