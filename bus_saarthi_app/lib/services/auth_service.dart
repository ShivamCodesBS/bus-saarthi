import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../models/user_model.dart';

/// Result of a login attempt — `error` is null on success.
/// `blockedUntil` carries the 429 lockout timestamp, mirroring the web's
/// countdown behaviour on the Login page.
class LoginResult {
  final UserModel? user;
  final String? error;
  final DateTime? blockedUntil;

  const LoginResult({this.user, this.error, this.blockedUntil});

  bool get success => user != null;
}

/// Authentication service — a faithful port of the web AuthContext +
/// Login.jsx flow, with the descriptive error mapping from the
/// existing mobile app's AuthService.
class AuthService {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
  ));

  final FlutterSecureStorage _secure = const FlutterSecureStorage();

  /// POST /api/login — same payload as the web app (login_id + password;
  /// the backend resolves the role from the account, and validates the
  /// optional `role` field when it is sent).
  Future<LoginResult> login(String loginId, String password, String? role) async {
    try {
      final response = await _dio.post(
        '${AppConstants.restApiUrl}/api/login',
        data: {
          'login_id': loginId,
          'password': password,
          if (role != null) 'role': role,
        },
      );

      final data = response.data;
      if (response.statusCode == 200 && data is Map && data['status'] == 'success') {
        final user = UserModel.fromJson(
          Map<String, dynamic>.from(data['user'] as Map),
          fallbackId: loginId,
        ).copyWith(token: data['token']?.toString());

        await _persistSession(user);
        return LoginResult(user: user);
      }

      return LoginResult(
        error: (data is Map ? data['detail'] ?? data['message'] : null)?.toString() ??
            'Login failed. Please try again.',
      );
    } on DioException catch (e) {
      // ── Network / timeout errors ───────────────────────────────────────
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return LoginResult(error: 'Server is starting up. Please wait ~30 seconds and retry.');
      }
      if (e.type == DioExceptionType.receiveTimeout) {
        return const LoginResult(error: 'Server took too long to respond. Please retry.');
      }
      if (e.type == DioExceptionType.connectionError) {
        return const LoginResult(error: 'Cannot reach server. Check your internet connection.');
      }

      // ── HTTP error responses ───────────────────────────────────────────
      final data = e.response?.data;
      final String? detail =
          data is Map ? (data['detail'] ?? data['message'])?.toString() : null;
      final statusCode = e.response?.statusCode;

      if (statusCode == 429) {
        DateTime? blockedUntil;
        if (data is Map && data['blockedUntil'] != null) {
          final ms = int.tryParse(data['blockedUntil'].toString());
          if (ms != null) blockedUntil = DateTime.fromMillisecondsSinceEpoch(ms);
        }
        return LoginResult(
          error: detail ?? 'Too many login attempts. Please wait and retry.',
          blockedUntil: blockedUntil,
        );
      }
      if (statusCode == 401) {
        return LoginResult(error: detail ?? 'Invalid credentials. Check your Login ID and password.');
      }
      if (statusCode == 400) {
        return LoginResult(error: detail ?? 'Please enter your Login ID and password.');
      }
      if (statusCode != null && statusCode >= 500) {
        return LoginResult(error: 'Server error ($statusCode). Please retry in a moment.');
      }
      return LoginResult(error: detail ?? 'Login failed (${statusCode ?? 'no response'}). Please retry.');
    } catch (_) {
      return const LoginResult(error: 'Unexpected error during login. Please try again.');
    }
  }

  Future<void> _persistSession(UserModel user) async {
    await _secure.write(key: AppConstants.storageTokenKey, value: user.token);
    // Same localStorage key the web app uses, in SharedPreferences so the
    // whole user JSON (including the token) round-trips like `bus_saarthi_user`.
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.storageUserKey, jsonEncode(user.toJson()));
  }

  /// Restore the persisted session (web: localStorage read on boot).
  /// Returns null when no session is stored.
  Future<UserModel?> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(AppConstants.storageUserKey);
      if (raw == null) return null;
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic>) return null;
      final user = UserModel.fromJson(json);
      if (user.token == null || user.token!.isEmpty) return null;
      return user;
    } catch (_) {
      return null;
    }
  }

  /// Update the persisted session JSON (profile pic changes etc.).
  Future<void> updateSession(UserModel user) => _persistSession(user);

  Future<void> logout() async {
    await _secure.delete(key: AppConstants.storageTokenKey);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.storageUserKey);
  }

  Future<String?> readToken() => _secure.read(key: AppConstants.storageTokenKey);
}
