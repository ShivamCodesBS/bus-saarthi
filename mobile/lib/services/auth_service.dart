import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import '../core/constants.dart';
import '../models/user_model.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  /// Dio with explicit timeouts so Render cold-start doesn't hang the UI.
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
  ));

  static const _androidOptions = AndroidOptions(
    encryptedSharedPreferences: true,
    resetOnError: true,
  );

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: _androidOptions,
  );

  String? _token;
  UserModel? _currentUser;

  String? get token => _token;
  UserModel? get currentUser => _currentUser;

  Future<File> _getSessionFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/.session_auth.json');
  }

  Future<void> _persistSession(
      String token, Map<String, dynamic> userMap) async {
    _token = token;
    _currentUser = UserModel.fromJson(userMap);

    // Layer 1: Secure storage
    try {
      await _storage.write(key: 'jwt_token', value: token);
      await _storage.write(key: 'user_data', value: jsonEncode(userMap));
    } catch (e) {
      print('[Auth] SecureStorage write error: $e');
    }

    // Layer 2: Private app sandbox file (preserves session across app kills/restarts)
    try {
      final file = await _getSessionFile();
      await file.writeAsString(jsonEncode({
        'token': token,
        'user': userMap,
      }));
    } catch (e) {
      print('[Auth] Session file write error: $e');
    }
  }

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
        final token = response.data['token']?.toString();
        final rawUser = response.data['user'];

        if (token != null && rawUser is Map) {
          final userMap = Map<String, dynamic>.from(rawUser);
          await _persistSession(token, userMap);
          return null; // null = success
        }
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
        return detail ??
            'Too many failed attempts. Please wait 15 minutes and retry.';
      }
      if (statusCode == 401) {
        return detail ??
            'Invalid credentials. Check your Login ID and password.';
      }
      if (statusCode == 400) {
        return detail ?? 'Please enter your Login ID and password.';
      }
      if (statusCode != null && statusCode >= 500) {
        return 'Server error ($statusCode). Please retry in a moment.';
      }

      return detail ??
          'Login failed (${statusCode ?? 'no response'}). Please retry.';
    } catch (e) {
      return 'Unexpected error during login. Please try again.';
    }
  }

  Future<void> logout() async {
    _token = null;
    _currentUser = null;
    try {
      await _storage.delete(key: 'jwt_token');
      await _storage.delete(key: 'user_data');
    } catch (_) {}
    try {
      final file = await _getSessionFile();
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}
  }

  Future<bool> checkLoginStatus() async {
    String? token;
    String? rawUserData;

    // Layer 1: FlutterSecureStorage
    try {
      token = await _storage.read(key: 'jwt_token');
      rawUserData = await _storage.read(key: 'user_data');
    } catch (e) {
      print('[Auth] SecureStorage read error: $e');
    }

    // Layer 2: Fallback to sandboxed session file
    if (token == null || rawUserData == null || token.isEmpty) {
      try {
        final file = await _getSessionFile();
        if (await file.exists()) {
          final content = await file.readAsString();
          final data = jsonDecode(content);
          if (data is Map) {
            token = data['token']?.toString();
            if (data['user'] != null) {
              rawUserData = jsonEncode(data['user']);
            }
          }
        }
      } catch (e) {
        print('[Auth] Session file read error: $e');
      }
    }

    if (token == null || rawUserData == null || token.isEmpty) {
      return false;
    }

    // Validate JWT expiry safely without false-positive wipe
    if (_isTokenExpired(token)) {
      print('[Auth] Stored JWT is expired. Clearing session.');
      await logout();
      return false;
    }

    try {
      final userMap = Map<String, dynamic>.from(jsonDecode(rawUserData) as Map);
      _token = token;
      _currentUser = UserModel.fromJson(userMap);
      return true;
    } catch (e) {
      print('[Auth] UserModel parsing error: $e');
      await logout();
      return false;
    }
  }

  Future<String?> readToken() async {
    if (_token != null && _token!.isNotEmpty) return _token;
    await checkLoginStatus();
    return _token;
  }

  /// Decodes the JWT payload section to check the `exp` claim.
  /// Never wipes the session on decoding irregularities.
  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;

      final normalized = base64.normalize(parts[1]);
      final decodedString = utf8.decode(base64Url.decode(normalized));
      final decoded = jsonDecode(decodedString);
      final exp = decoded['exp'];
      if (exp == null) return false;

      final nowSeconds = DateTime.now().millisecondsSinceEpoch / 1000;
      return nowSeconds > (exp as num).toDouble();
    } catch (e) {
      print('[Auth] Token decode error (ignoring expiry): $e');
      return false;
    }
  }
}
