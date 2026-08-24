import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  final Dio _dio = Dio();
  static const String baseUrl = 'http://localhost:5000';
  final SharedPreferences _prefs;

  ApiService(this._prefs) {
    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 10);
    _dio.options.receiveTimeout = const Duration(seconds: 15);

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final storedUser = _prefs.getString('bus_saarthi_user');
          if (storedUser != null) {
            try {
              final user = jsonDecode(storedUser) as Map<String, dynamic>;
              if (user['token'] != null) {
                options.headers['Authorization'] = 'Bearer ${user['token']}';
              }
            } catch (_) {}
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          return handler.next(e);
        },
      ),
    );
  }

  Future<Response> login(String loginId, String password) async {
    return await _dio.post('/api/login', data: {
      'login_id': loginId,
      'password': password,
    });
  }

  Future<Response> getAttendanceForUser(String loginId) async {
    return await _dio.get('/api/attendance/user/$loginId');
  }

  Future<Response> getRouteStatus(String routeId) async {
    return await _dio.get('/api/route_status/$routeId');
  }

  Future<Response> checkMergeStatus(String routeId) async {
    return await _dio.get('/api/merge/check/$routeId');
  }

  Future<Response> getNotices() async {
    return await _dio.get('/api/notices');
  }

  Future<Response> getGrievances() async {
    return await _dio.get('/api/grievances');
  }

  Future<Response> postGrievance(String message) async {
    return await _dio.post('/api/grievances', data: {'message': message});
  }

  Future<Response> getAllUsers() async {
    return await _dio.get('/api/admin/users');
  }

  Future<Response> deleteUser(String loginId) async {
    return await _dio.delete('/api/admin/users/$loginId');
  }

  Future<Response> getAllRoutes() async {
    return await _dio.get('/api/routes');
  }

  Future<Response> getParentDashboard() async {
    return await _dio.get('/api/parent/dashboard');
  }

  Future<Response> sendSos(double lat, double lng) async {
    return await _dio.post('/api/sos', data: {'lat': lat, 'lng': lng});
  }
}
