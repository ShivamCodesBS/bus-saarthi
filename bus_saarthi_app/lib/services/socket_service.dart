import 'package:socket_io_client/socket_io_client.dart' as IO;

import '../core/constants.dart';

/// Student-side socket service — connects to the backend, joins the
/// effective route room, and relays every event to callbacks.
/// Event names/payloads mirror the web Home.jsx wiring.
class StudentSocketService {
  IO.Socket? _socket;
  String? _currentRouteId;
  String? _currentLoginId;

  // Callbacks — the TrackingProvider wires these.
  void Function()? onConnected;
  void Function(Map<String, dynamic> data)? onLiveTelemetry;
  void Function()? onLiveAttendance;
  void Function(Map<String, dynamic> data)? onRouteMerged;
  void Function()? onRouteRestored;
  void Function(Map<String, dynamic> data)? onRouteCancelled;
  void Function(Map<String, dynamic> data)? onGlobalBroadcast;
  void Function(Map<String, dynamic> data)? onWakeAlarmTrigger;
  void Function(Map<String, dynamic> data)? onSosCancelled;
  void Function(Map<String, dynamic> data)? onSosAlert;
  void Function(Map<String, dynamic> data)? onProfileUpdate;
  void Function(Map<String, dynamic> data)? onNotification;

  bool get isConnected => _socket?.connected ?? false;

  void connect(String routeId, String? loginId) {
    _currentRouteId = routeId;
    _currentLoginId = loginId;

    // Dispose the old transport first to avoid parallel sockets retaining rooms.
    _socket?.disconnect();
    _socket?.dispose();
    _socket = IO.io(
      AppConstants.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .disableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      // Re-join the latest route after every connection/reconnection.
      final routeId = _currentRouteId;
      if (routeId != null && _currentLoginId != null) {
        _socket!.emit('join_route', {
          'route_id': routeId,
          'login_id': _currentLoginId,
        });
      }
      onConnected?.call();
    });

    _socket!.on('live_telemetry', (data) {
      if (data is Map) onLiveTelemetry?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('live_attendance', (_) => onLiveAttendance?.call());
    _socket!.on('your_route_merged', (data) {
      if (data is Map) onRouteMerged?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('route_restored', (_) => onRouteRestored?.call());
    _socket!.on('your_route_cancelled', (data) {
      if (data is Map) onRouteCancelled?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('global_broadcast', (data) {
      if (data is Map) onGlobalBroadcast?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('wake_alarm_trigger', (data) {
      if (data is Map)
        onWakeAlarmTrigger?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('sos_cancelled', (data) {
      if (data is Map) onSosCancelled?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('sos_alert', (data) {
      if (data is Map) onSosAlert?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('profile_update', (data) {
      if (data is Map) onProfileUpdate?.call(Map<String, dynamic>.from(data));
    });
    _socket!.on('notification', (data) {
      if (data is Map) onNotification?.call(Map<String, dynamic>.from(data));
    });

    _socket!.connect();
  }

  /// Switch rooms when the route changes (merge/cancel/restore).
  void joinRoute(String routeId) {
    final previousRouteId = _currentRouteId;
    _currentRouteId = routeId;
    final socket = _socket;
    if (socket == null || !socket.connected || previousRouteId == routeId)
      return;

    // Backend rooms are additive, so leave the old room explicitly before
    // joining the replacement. A reconnect joins only _currentRouteId above.
    if (previousRouteId != null) {
      socket.emit('unsubscribe_route', {'route_id': previousRouteId});
    }
    socket.emit('join_route', {
      'route_id': routeId,
      'login_id': _currentLoginId,
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _currentRouteId = null;
    _currentLoginId = null;
  }
}
