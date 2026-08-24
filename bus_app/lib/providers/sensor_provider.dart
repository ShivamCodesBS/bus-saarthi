import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import '../models/sensor_payload.dart';
import '../services/socket_service.dart';

class SensorProvider extends ChangeNotifier {
  final SocketService socketService;

  SensorPayload? _currentPayload;
  SensorPayload? get currentPayload => _currentPayload;

  bool _isRunning = false;
  bool get isRunning => _isRunning;

  StreamSubscription? _telemetrySub;

  SensorProvider(this.socketService) {
    _initServiceState();

    // Listen for telemetry updates forwarded from the background isolate
    _telemetrySub = FlutterBackgroundService()
        .on('onTelemetryUpdate')
        .listen((event) {
      if (event != null) {
        try {
          _currentPayload =
              SensorPayload.fromJson(Map<String, dynamic>.from(event));
          notifyListeners();
        } catch (e) {
          print('[SensorProvider] Failed to parse telemetry: $e');
        }
      }
    });
  }

  Future<void> _initServiceState() async {
    final service = FlutterBackgroundService();
    _isRunning = await service.isRunning();
    notifyListeners();
  }

  Future<void> startSensors(String routeId) async {
    final service = FlutterBackgroundService();

    if (!await service.isRunning()) {
      await service.startService();
      print('[SensorProvider] Background service started. Waiting for serviceReady...');

      // Wait for the background isolate to signal it is fully booted and
      // ready to receive events — replaces the unreliable blind 2s delay.
      try {
        await service
            .on('serviceReady')
            .first
            .timeout(const Duration(seconds: 12));
        print('[SensorProvider] serviceReady received.');
      } on TimeoutException {
        print('[SensorProvider] serviceReady timed out — sending startSensors anyway.');
      }
    }

    service.invoke('startSensors', {'routeId': routeId});
    print('[SensorProvider] startSensors invoked for route $routeId.');
    _isRunning = true;
    notifyListeners();
  }

  void stopSensors() {
    if (!_isRunning) return;
    FlutterBackgroundService().invoke('stopService');
    _isRunning = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _telemetrySub?.cancel();
    super.dispose();
  }
}
