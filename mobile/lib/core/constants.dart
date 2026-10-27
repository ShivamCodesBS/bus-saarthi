/// App-wide constants for Bus Saarthi mobile app.
///
/// API URLs are configured at build time via --dart-define flags:
///   flutter run --dart-define=API_URL=http://10.0.2.2:5000
///   flutter build apk --dart-define=API_URL=https://your-vps.com
class AppConstants {
  // API URL — configurable via --dart-define=API_URL=...
  // Defaults to production Render backend
  static const String restApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://bus-saarthi-j3lq.onrender.com',
  );

  // WebSocket URL — defaults to same as REST API
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://bus-saarthi-j3lq.onrender.com',
  );

  // Hardware token — must match WEBHOOK_SECRET on the backend
  // Configured via --dart-define=HARDWARE_TOKEN=...
  static const String hardwareToken = String.fromEnvironment(
    'HARDWARE_TOKEN',
    defaultValue: 'dev_only_token_DO_NOT_USE_IN_PROD',
  );

  // Route ID this device is assigned to.
  // The route is the stable identity — the bus serving it can change.
  static const String defaultRouteId = String.fromEnvironment(
    'ROUTE_ID',
    defaultValue: '4',
  );

  // ── App mode ──────────────────────────────────────────────────────────
  // The app has two distinct roles:
  //
  //  driver      The phone belongs to the bus driver. It is a dashboard
  //              and navigation aid — it does NOT run the sensors or the
  //              face scanner.
  //
  //  busDevice   A device fixed inside the bus. It runs continuously:
  //              sensor telemetry for live tracking AND the ArcFace
  //              scanner for attendance. It identifies itself with the
  //              hardware token rather than a user account.
  static const String modeDriver = 'driver';
  static const String modeBusDevice = 'busDevice';

  // Which mode this build starts in. A bus device build sets
  // --dart-define=APP_MODE=busDevice.
  static const String appMode = String.fromEnvironment(
    'APP_MODE',
    defaultValue: modeDriver,
  );

  // Sensor intervals
  // GPS is typically 1Hz; accelerometer/compass can be faster but we publish telemetry at 1Hz
  static const int sensorIntervalMs = 1000; // 1Hz telemetry publish rate

  // ── Face Recognition (ArcFace — on-device) ───────────────────────────────
  // Interval between face recognition attempts
  static const int faceRecognitionIntervalMs = 3000;

  // Attendance de-duplicate window: 3 hours (one shift)
  static const int attendanceWindowMinutes = 180;

  // ArcFace cosine similarity threshold (0.0 – 1.0)
  // Higher = stricter matching, fewer false positives
  static const double arcFaceSimilarityThreshold = 0.6;
}
