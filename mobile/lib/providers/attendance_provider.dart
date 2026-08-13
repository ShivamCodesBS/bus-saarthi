import 'package:flutter/foundation.dart';
import '../models/attendance_payload.dart';
import '../services/api_service.dart';
import '../services/offline_queue_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class AttendanceProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  final OfflineQueueService _queueService = OfflineQueueService();
  
  final List<AttendanceData> _recentCheckIns = [];
  List<AttendanceData> get recentCheckIns => _recentCheckIns;

  void addAttendance(AttendanceData data) async {
    // Keep only last 20 check-ins in memory for the UI log
    _recentCheckIns.insert(0, data);
    if (_recentCheckIns.length > 20) {
      _recentCheckIns.removeLast();
    }
    notifyListeners();

    // Post to backend or queue if offline
    final payload = AttendancePayload(data: data);
    
    final connectivityResult = await (Connectivity().checkConnectivity());
    if (!connectivityResult.contains(ConnectivityResult.none)) {
      final success = await _apiService.postAttendance(payload);
      if (!success) {
        await _queueService.enqueueAttendance(payload);
      }
    } else {
      await _queueService.enqueueAttendance(payload);
    }
  }
}
