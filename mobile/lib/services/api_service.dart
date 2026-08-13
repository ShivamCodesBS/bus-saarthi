import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants.dart';
import '../models/attendance_payload.dart';

/// API service for communicating with the Bus Saarthi backend.
///
/// Face recognition is now handled entirely on-device by ArcFace.
/// This service only syncs attendance records and metadata to the backend.
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
      final response = await _dio.post(
        '/api/sync/attendance',
        data: payload.data.toJson(),
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      return response.statusCode == 200;
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
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      return response.statusCode == 200;
    } on DioException catch (e) {
      print('[ApiService] markFaceEnrolled error: ${e.type} — ${e.message}');
      return false;
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
