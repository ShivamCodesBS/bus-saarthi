import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants.dart';
import '../models/telemetry_model.dart';

class TelemetryProvider extends ChangeNotifier {
  IO.Socket? _socket;
  TelemetryData? _latestTelemetry;
  String? _currentRouteId;
  bool _isConnected = false;
  Timer? _staleTimer;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;

  TelemetryData? get latestTelemetry => _latestTelemetry;
  bool get isConnected => _isConnected;
  bool get hasValidTelemetry => _latestTelemetry != null && !_isTelemetryStale();
  String? get currentRouteId => _currentRouteId;

  /// Call this when driver logs in with their route
  void connect(String routeId) {
    if (_currentRouteId == routeId && _isConnected) return;

    _currentRouteId = routeId;
    _disconnect();
    _connect();
  }

  void _connect() {
    if (_currentRouteId == null) return;

    _socket = IO.io(AppConstants.socketUrl, IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .disableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(3)
        .setReconnectionDelay(2000)
        .build());

    _socket!.onConnect((_) {
      print('[TelemetryProvider] Connected to backend');
      _isConnected = true;
      _reconnectAttempts = 0;
      _socket!.emit('join_route', {'route_id': _currentRouteId});
      print('[TelemetryProvider] Joined route_$_currentRouteId');
      notifyListeners();
    });

    _socket!.onDisconnect((_) {
      print('[TelemetryProvider] Disconnected');
      _isConnected = false;
      notifyListeners();
      _scheduleReconnect();
    });

    _socket!.onConnectError((err) {
      print('[TelemetryProvider] Connection error: $err');
      _isConnected = false;
      notifyListeners();
    });

    _socket!.onError((err) {
      print('[TelemetryProvider] Error: $err');
    });

    // Listen for live telemetry from the bus device
    _socket!.on('live_telemetry', (data) {
      _handleLiveTelemetry(data);
    });

    _socket!.connect();
    print('[TelemetryProvider] Attempting connection to ${AppConstants.socketUrl}...');
  }

  void _handleLiveTelemetry(dynamic data) {
    if (data == null) return;

    try {
      final telemetry = TelemetryData.fromJson(Map<String, dynamic>.from(data));
      _latestTelemetry = telemetry;
      _resetStaleTimer();
      notifyListeners();
    } catch (e) {
      print('[TelemetryProvider] Failed to parse telemetry: $e');
    }
  }

  void _resetStaleTimer() {
    _staleTimer?.cancel();
    // Mark as stale after 10 seconds of no updates
    _staleTimer = Timer(const Duration(seconds: 10), () {
      notifyListeners(); // Trigger rebuild to show stale state
    });
  }

  bool _isTelemetryStale() {
    if (_latestTelemetry == null) return true;
    // Consider stale if no update for 10 seconds
    final age = DateTime.now().difference(_latestTelemetry!.receivedAt);
    return age.inSeconds > 10;
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      print('[TelemetryProvider] Max reconnect attempts reached');
      return;
    }

    _reconnectTimer?.cancel();
    final delay = Duration(seconds: 2 * (_reconnectAttempts + 1));
    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      print('[TelemetryProvider] Reconnect attempt $_reconnectAttempts');
      _connect();
    });
  }

  /// Directly emit driver phone's GPS location to the backend
  void emitLocation({
    required double latitude,
    required double longitude,
    required double speedKmh,
    double? heading,
    required String routeId,
  }) {
    if (_socket != null && _isConnected) {
      _socket!.emit('mobile_sensor_data', {
        'latitude': latitude,
        'longitude': longitude,
        'mpu_speed_kmh': speedKmh,
        'heading_deg': heading,
        'route_id': routeId,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      });
    }
  }

  void _disconnect() {
    _staleTimer?.cancel();
    _reconnectTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }

  void disconnect() {
    _disconnect();
    _currentRouteId = null;
    _latestTelemetry = null;
    _reconnectAttempts = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _disconnect();
    _reconnectTimer?.cancel();
    super.dispose();
  }
}