import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/socket_service.dart'; // kept for API surface compatibility

class ConnectionProvider extends ChangeNotifier {
  // socketService is accepted in the constructor for backward-compatibility
  // with app.dart's provider setup, but connection state is tracked entirely
  // via background-service events — the UI-side socket is never connected.
  // ignore: unused_field
  final SocketService socketService;

  bool _isSocketConnected = false;
  bool _hasInternet = true;
  Timer? _internetCheckTimer;
  StreamSubscription? _connectivitySub;
  StreamSubscription? _bgSocketStatusSub;

  /// True only when both internet is available AND the socket is connected.
  bool get isConnected => _isSocketConnected && _hasInternet;

  ConnectionProvider(this.socketService) {
    _checkInitialConnectivity();
    _listenConnectivity();
    _listenBackgroundSocketStatus();
  }

  /// One-time check at startup
  Future<void> _checkInitialConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _hasInternet = !result.contains(ConnectivityResult.none);
    notifyListeners();
  }

  /// Listens to system connectivity changes (WiFi/mobile/none)
  void _listenConnectivity() {
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> result) {
      final hadInternet = _hasInternet;
      _hasInternet = !result.contains(ConnectivityResult.none);
      if (hadInternet != _hasInternet) notifyListeners();
    });

    // Periodic fallback check every 5 seconds to stay in sync
    _internetCheckTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      final result = await Connectivity().checkConnectivity();
      final nowHasInternet = !result.contains(ConnectivityResult.none);
      if (_hasInternet != nowHasInternet) {
        _hasInternet = nowHasInternet;
        notifyListeners();
      }
    });
  }

  /// Listens for socket connection events relayed from the background isolate.
  /// This is the fix for the duplicate-SocketService bug: the UI never owned
  /// the real socket (that lives in the background isolate), so we subscribe
  /// to the status events the background service broadcasts instead.
  void _listenBackgroundSocketStatus() {
    _bgSocketStatusSub =
        FlutterBackgroundService().on('socketStatus').listen((event) {
      if (event != null) {
        final connected = event['connected'] == true;
        if (_isSocketConnected != connected) {
          _isSocketConnected = connected;
          notifyListeners();
          print('[ConnectionProvider] Socket status from BG: $connected');
        }
      }
    });
  }

  @override
  void dispose() {
    _internetCheckTimer?.cancel();
    _connectivitySub?.cancel();
    _bgSocketStatusSub?.cancel();
    super.dispose();
  }
}
