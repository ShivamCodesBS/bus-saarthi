import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants.dart';
import '../models/sensor_payload.dart';

class SocketService {
  IO.Socket? _socket;
  bool isConnected = false;
  String? _currentRouteId;

  /// Called whenever the socket connection state changes.
  /// Receives `true` when connected, `false` when disconnected.
  Function(bool)? onConnectionChanged;

  void connect(String routeId) {
    _currentRouteId = routeId;
    _connect();
  }

  void _connect() {
    // Dispose old socket cleanly before creating a new one
    _socket?.dispose();

    _socket = IO.io(AppConstants.socketUrl, IO.OptionBuilder()
        .setTransports(['websocket', 'polling']) // polling as fallback
        .disableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(99999)
        .setReconnectionDelay(2000)
        .setReconnectionDelayMax(30000) // cap at 30s between retries
        .build());

    _socket!.onConnect((_) {
      print('[Socket] Connected to backend!');
      isConnected = true;
      onConnectionChanged?.call(true); // relay to background service / UI
      if (_currentRouteId != null) {
        _socket!.emit('join_route', {'route_id': _currentRouteId});
        print('[Socket] Joined route_$_currentRouteId');
      }
    });

    _socket!.onDisconnect((_) {
      print('[Socket] Disconnected. Will auto-reconnect...');
      isConnected = false;
      onConnectionChanged?.call(false);
    });

    _socket!.onConnectError((err) {
      print('[Socket] Connection error: $err');
      isConnected = false;
      onConnectionChanged?.call(false);
    });

    _socket!.onError((err) {
      print('[Socket] Error: $err');
    });

    _socket!.connect();
    print('[Socket] Attempting connection to ${AppConstants.socketUrl}...');
  }

  void emitTelemetry(SensorPayload payload) {
    if (isConnected && _socket != null) {
      _socket!.emit('mobile_sensor_data', payload.toJson());
    } else {
      print('[Socket] Not connected — telemetry dropped. isConnected=$isConnected');
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null; // null after dispose so _connect() doesn't try to re-dispose it
    isConnected = false;
    onConnectionChanged?.call(false);
  }
}
