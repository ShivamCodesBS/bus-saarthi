import 'package:flutter/foundation.dart';

import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/fcm_service.dart';

/// Port of the web AuthContext: holds the session user, exposes
/// login/logout, and restores the session on app start.
class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  UserModel? _user;
  bool _initialized = false;
  bool _fcmInitFailed = false;
  String? _fcmError;

  UserModel? get user => _user;
  bool get initialized => _initialized;
  bool get isLoggedIn => _user != null;
  bool get isParent => _user?.role == 'parent';
  bool get fcmInitFailed => _fcmInitFailed;
  String? get fcmError => _fcmError;

  /// Restore persisted session on boot (Splash waits for this).
  Future<void> init() async {
    if (_initialized) return;
    _user = await _authService.restoreSession();
    _initialized = true;
    notifyListeners();
    if (_user?.token != null) {
      // Register the FCM token against the restored session.
      await FcmService.init(_user!.token);
      _fcmInitFailed = FcmService.initFailed;
      _fcmError = FcmService.lastError;
      notifyListeners();
    }
  }

  /// Retry FCM initialization (e.g., after user adds google-services.json)
  Future<void> retryFcmInit() async {
    if (_user?.token != null) {
      await FcmService.retryInit(_user!.token);
      _fcmInitFailed = FcmService.initFailed;
      _fcmError = FcmService.lastError;
      notifyListeners();
    }
  }

  /// Returns null on success, or a human-readable error string.
  /// [blockedUntil] is surfaced through the LoginResult by the caller.
  Future<LoginResult> login(String loginId, String password, String? role) async {
    final result = await _authService.login(loginId, password, role);
    if (result.success) {
      _user = result.user;
      notifyListeners();
      await FcmService.rebind(result.user!.token!);
      _fcmInitFailed = FcmService.initFailed;
      _fcmError = FcmService.lastError;
      notifyListeners();
    }
    return result;
  }

  /// Update the cached user (profile pic changes etc.).
  void updateUser(UserModel updated) {
    _user = updated;
    _authService.updateSession(updated);
    notifyListeners();
  }

  Future<void> logout() async {
    _user = null;
    _fcmInitFailed = false;
    _fcmError = null;
    await _authService.logout();
    notifyListeners();
  }
}
