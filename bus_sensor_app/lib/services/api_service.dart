import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:typed_data';
import '../core/constants.dart';
import '../models/attendance_payload.dart';
import '../models/face_descriptor.dart';
import '../face_recognition/face_matcher.dart';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConstants.restApiUrl,
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 30),
    headers: {
      'x-hardware-token': AppConstants.hardwareToken,
    },
  ));

  // ── Attendance ─────────────────────────────────────────────────────────────

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

  // ── AWS Rekognition Face Recognition ──────────────────────────────────────

  /// Recognizes a face from [imageBytes] via the backend.
  /// Returns a [RecognitionResult] with matched student info, or [RecognitionResult.noMatch()].
  Future<RecognitionResult> recognizeFace(Uint8List imageBytes, {String routeId = '4'}) async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final formData = FormData.fromMap({
        'file':     MultipartFile.fromBytes(imageBytes, filename: 'face.jpg', contentType: DioMediaType('image', 'jpeg')),
        'route_id': routeId,
      });

      final response = await _dio.post(
        '/api/attendance/recognize',
        data: formData,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final status = data['status'];
        if (status == 'matched' || status == 'cooldown' || status == 'limit_reached') {
          return RecognitionResult.fromJson(data);
        }
      }
      return RecognitionResult.noMatch();
    } on DioException catch (e) {
      print('[ApiService] recognizeFace error: ${e.type} — ${e.message}');
      return RecognitionResult.noMatch();
    } catch (e) {
      print('[ApiService] recognizeFace unexpected error: $e');
      return RecognitionResult.noMatch();
    }
  }

  /// Returns null on success, or an error message string on failure.
  Future<String?> enrollFace(String studentId, Uint8List imageBytes) async {
    try {
      final storage = const FlutterSecureStorage();
      final token = await storage.read(key: 'jwt_token');

      final formData = FormData.fromMap({
        'student_id': studentId,
        'file':       MultipartFile.fromBytes(imageBytes, filename: 'enroll.jpg', contentType: DioMediaType('image', 'jpeg')),
      });

      final response = await _dio.post(
        '/api/faces/enroll',
        data: formData,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200 && response.data['status'] == 'success') {
        return null; // Success
      }
      return response.data['message'] ?? 'Unknown error';
    } on DioException catch (e) {
      print('[ApiService] enrollFace error: ${e.type} — ${e.message} — ${e.response?.data}');
      if (e.response?.data != null && e.response?.data['message'] != null) {
        return e.response!.data['message'];
      }
      return 'Network Error: ${e.message}';
    } catch (e) {
      print('[ApiService] enrollFace unexpected error: $e');
      return e.toString();
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

  // ── REMOVED: getFaceDescriptors() — no longer needed (server-side matching)
  // ── REMOVED: registerStudentFace(studentId, List<double>) — replaced by enrollFace()
}
