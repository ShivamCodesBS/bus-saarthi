import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/foundation.dart';
import 'dart:async';

class SocketService extends ChangeNotifier {
  IO.Socket? _socket;
  
  // States
  Map<String, dynamic> _telemetry = {};
  Map<String, dynamic> _crowdStatus = {};
  List<dynamic> _sosAlerts = [];
  bool _isConnected = false;

  Map<String, dynamic> get telemetry => _telemetry;
  Map<String, dynamic> get crowdStatus => _crowdStatus;
  List<dynamic> get sosAlerts => _sosAlerts;
  bool get isConnected => _isConnected;

  void connect(String url, String token) {
    if (_socket != null) return;
    
    _socket = IO.io(url, <String, dynamic>{
      'transports': ['websocket', 'polling'],
      'autoConnect': true,
      'auth': {'token': token}
    });

    _socket!.onConnect((_) {
      _isConnected = true;
      notifyListeners();
      _socket!.emit('join_passenger', {'token': token});
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      notifyListeners();
    });

    _socket!.on('live_telemetry', (data) {
      if (data is Map) {
        _telemetry = Map<String, dynamic>.from(data);
        notifyListeners();
      }
    });

    _socket!.on('crowd_update', (data) {
      if (data is Map) {
        _crowdStatus = Map<String, dynamic>.from(data);
        notifyListeners();
      }
    });

    _socket!.on('sos_alert', (data) {
      if (data is Map) {
        _sosAlerts = [data, ..._sosAlerts];
        notifyListeners();
      }
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _isConnected = false;
    notifyListeners();
  }
}
