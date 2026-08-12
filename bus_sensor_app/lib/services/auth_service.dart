import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants.dart';
import '../models/user_model.dart';

class AuthService {
  /// Dio with explicit timeouts so Render cold-start doesn't hang the UI.
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
  ));

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String? _token;
  UserModel? _currentUser;

  String? get token => _token;
  UserModel? get currentUser => _currentUser;

  /// Returns `null` on success, or a human-readable error string on failure.
  /// Never throws — all exceptions are converted to descriptive messages.
  Future<String?> login(String loginId, String password, String role) async {
    try {
      final response = await _dio.post(
        '${AppConstants.restApiUrl}/api/login',
        data: {
          'login_id': loginId,
          'password': password,
          'role': role,
        },
      );

      if (response.statusCode == 200 && response.data['status'] == 'success') {
        _token = response.data['token'];
        _currentUser = UserModel.fromJson(response.data['user']);
        await _storage.write(key: 'jwt_token', value: _token);
        await _storage.write(key: 'user_data', value: jsonEncode(response.data['user']));
        return null; // null = success
      }

      return response.data['detail'] ?? 'Login failed. Please try again.';
    } on DioException catch (e) {
      // ── Network / timeout errors ─────────────────────────────────────
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return 'Server is starting up. Please wait ~30 seconds and retry.';
      }
      if (e.type == DioExceptionType.receiveTimeout) {
        return 'Server took too long to respond. Please retry.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Cannot reach server. Check your internet connection.';
      }

      // ── HTTP error responses ─────────────────────────────────────────
      final statusCode = e.response?.statusCode;
      final detail = e.response?.data is Map
          ? (e.response!.data['detail'] as String?)
          : null;

      if (statusCode == 429) {
        return detail ?? 'Too many failed attempts. Please wait 15 minutes and retry.';
      }
      if (statusCode == 401) {
        return detail ?? 'Invalid credentials. Check your Login ID and password.';
      }
      if (statusCode == 400) {
        return detail ?? 'Please enter your Login ID and password.';
      }
      if (statusCode != null && statusCode >= 500) {
        return 'Server error ($statusCode). Please retry in a moment.';
      }

      return detail ?? 'Login failed (${statusCode ?? 'no response'}). Please retry.';
    } catch (e) {
      return 'Unexpected error during login. Please try again.';
    }
  }

  Future<void> logout() async {
    _token = null;
    _currentUser = null;
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'user_data');
  }

  Future<bool> checkLoginStatus() async {
    _token = await _storage.read(key: 'jwt_token');
    final userData = await _storage.read(key: 'user_data');

    if (_token == null || userData == null) return false;

    // ── Validate JWT expiry without any extra package ────────────────
    if (_isTokenExpired(_token!)) {
      print('[Auth] Stored JWT is expired. Clearing session.');
      await logout();
      return false;
    }

    try {
      _currentUser = UserModel.fromJson(jsonDecode(userData));
      return true;
    } catch (_) {
      await logout();
      return false;
    }
  }

  /// Decodes the JWT payload section (no signature verification) to check
  /// the `exp` claim. Returns true if the token has expired or is malformed.
  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;

      // JWT base64url payload — add padding as needed
      String payload = parts[1];
      switch (payload.length % 4) {
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
      }

      final decoded = jsonDecode(utf8.decode(base64Url.decode(payload)));
      final exp = decoded['exp'];
      if (exp == null) return false; // no exp claim — treat as valid

      final nowSeconds = DateTime.now().millisecondsSinceEpoch / 1000;
      return nowSeconds > (exp as num).toDouble();
    } catch (_) {
      return true; // anything that can't be decoded is treated as expired
    }
  }
}
