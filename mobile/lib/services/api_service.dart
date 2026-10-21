import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants.dart';
import '../models/attendance_payload.dart';

/// API service for communicating with the Bus Saarthi backend.
///
/// Face recognition is handled on-device by ArcFace.
/// This service syncs attendance records, user metadata, and enrollment to the backend.
class ApiService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConstants.restApiUrl,
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
    headers: {
      'x-hardware-token': AppConstants.hardwareToken,
    },
  ));

  // ── Attendance Sync ────────────────────────────────────────────────────────

  /// Post a locally-matched attendance record to the backend for persistence.
  Future<bool> postAttendance(AttendancePayload payload) async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final body = {
        'route_id': payload.data.routeId,
        'records': [
          {
            'passenger_id': payload.data.loginId,
            'name': payload.data.name,
            'fee_status': payload.data.feeStatus,
            'confidence': payload.data.confidence,
            'timestamp': payload.data.checkInTime,
          }
        ]
      };

      final response = await _dio.post(
        '/api/sync/attendance',
        data: body,
        options: Options(headers: {
          'Content-Type': 'application/json',
          'x-hardware-token': AppConstants.hardwareToken,
          if (token != null) 'Authorization': 'Bearer $token',
        }),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      print('[ApiService] postAttendance error: ${e.type} — ${e.message}');
      return false;
    }
  }

  // ── Face Enrollment Metadata ───────────────────────────────────────────────

  /// Notify the backend that a face has been enrolled on-device.
  /// No image is sent — just the student's login ID.
  Future<bool> markFaceEnrolled(String studentId) async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final response = await _dio.post(
        '/api/faces/$studentId/enroll',
        options: Options(headers: {
          'x-hardware-token': AppConstants.hardwareToken,
          if (token != null) 'Authorization': 'Bearer $token',
        }),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      print('[ApiService] markFaceEnrolled error: ${e.type} — ${e.message}');
      return false;
    }
  }

  // ── User Lookup ────────────────────────────────────────────────────────────

  /// Lookup user information by login ID (name, feeStatus, routeId, etc.)
  Future<Map<String, dynamic>?> fetchUser(String loginId) async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final response = await _dio.get(
        '/api/users/$loginId',
        options: Options(headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        }),
      );

      if (response.statusCode == 200 && response.data != null) {
        return response.data as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('[ApiService] fetchUser error: $e');
      return null;
    }
  }

  // ── Admin Dashboard Stats ──────────────────────────────────────────────────

  Future<Map<String, dynamic>?> fetchAdminStats() async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final response = await _dio.get(
        '/api/stats/admin',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200 && response.data['status'] == 'success') {
        return response.data['data'] as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('[ApiService] fetchAdminStats error: $e');
      return null;
    }
  }
}
