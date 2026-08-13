/// App-wide constants for Bus Saarthi mobile app.
///
/// API URLs are configured at build time via --dart-define flags:
///   flutter run --dart-define=API_URL=http://10.0.2.2:5000
///   flutter build apk --dart-define=API_URL=https://your-vps.com
class AppConstants {
  // API URL — configurable via --dart-define=API_URL=...
  // Defaults to Android emulator localhost (10.0.2.2) for dev
  static const String restApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:5000',
  );

  // WebSocket URL — defaults to same as REST API
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: restApiUrl,
  );

  // Hardware token — must match WEBHOOK_SECRET on the backend
  // Configured via --dart-define=HARDWARE_TOKEN=...
  static const String hardwareToken = String.fromEnvironment(
    'HARDWARE_TOKEN',
    defaultValue: 'dev_only_token_DO_NOT_USE_IN_PROD',
  );

  // Route ID this device is assigned to
  static const String defaultRouteId = String.fromEnvironment(
    'ROUTE_ID',
    defaultValue: '4',
  );

  // Sensor intervals
  static const int sensorIntervalMs = 2000; // Send telemetry every 2s

  // ── Face Recognition (ArcFace — on-device) ───────────────────────────────
  // Interval between face recognition attempts
  static const int faceRecognitionIntervalMs = 3000;

  // Attendance de-duplicate window: 3 hours (one shift)
  static const int attendanceWindowMinutes = 180;

  // ArcFace cosine similarity threshold (0.0 – 1.0)
  // Higher = stricter matching, fewer false positives
  static const double arcFaceSimilarityThreshold = 0.6;
}
