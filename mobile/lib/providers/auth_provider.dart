import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  UserModel? get user => _authService.currentUser;
  bool get isAuthenticated => _authService.currentUser != null;

  /// The last login error message, or null if the last attempt succeeded.
  String? _lastError;
  String? get lastError => _lastError;

  Future<bool> init() async {
    final isLoggedIn = await _authService.checkLoginStatus();
    notifyListeners();
    return isLoggedIn;
  }

  /// Returns true on success. On failure, `lastError` is populated with
  /// the specific reason (wrong password, rate-limited, server down, etc).
  Future<bool> login(String loginId, String password, String role) async {
    _lastError = null;
    final error = await _authService.login(loginId, password, role);
    if (error == null) {
      notifyListeners();
      return true;
    }
    _lastError = error;
    notifyListeners();
    return false;
  }

  Future<void> logout() async {
    _lastError = null;
    await _authService.logout();
    notifyListeners();
  }
}
