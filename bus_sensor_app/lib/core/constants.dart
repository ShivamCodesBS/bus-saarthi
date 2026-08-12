class AppConstants {
  // API URL for History and Face Sync
  static const String restApiUrl = 'https://bus-sarthi.onrender.com';
  
  // WebSocket URL for Real-Time Telemetry
  static const String socketUrl = 'https://bus-sarthi.onrender.com';
  
  // Hardware token to authorize sensor data uploads
  static const String hardwareToken = 'invertis_hardware_secret_2026';
  
  // Route ID this phone is assigned to
  static const String defaultRouteId = '4';
  
  // Sensor intervals
  static const int sensorIntervalMs = 2000; // Send telemetry every 2s

  // ── Face Recognition Timing ──────────────────────────────────────────────
  // AWS Rekognition interval: 3000ms between recognition calls.
  // Recognition is now a network round-trip to the backend + AWS, so 3s
  // prevents flooding and gives Rekognition time to process.
  static const int faceRecognitionIntervalMs = 3000;

  // Attendance de-duplicate window: 3 hours (one shift)
  static const int attendanceWindowMinutes = 180;
}
