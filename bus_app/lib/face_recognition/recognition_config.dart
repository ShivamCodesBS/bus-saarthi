class RecognitionConfig {
  // ── Detection ──
  static const double minFaceSize = 0.15;
  static const bool useAccurateMode = true;
  static const bool enableContours = true;
  static const int detectionFrameSkip = 3;  // detect every Nth camera frame

  // ── Quality Engine Weights ──
  static const double wFaceSize = 0.15;
  static const double wBlur = 0.20;
  static const double wBrightness = 0.10;
  static const double wContrast = 0.05;
  static const double wYaw = 0.15;
  static const double wPitch = 0.10;
  static const double wRoll = 0.05;
  static const double wEyeOpen = 0.10;
  static const double wPosition = 0.05;
  static const double wLandmarkConf = 0.05;

  // ── Quality Thresholds ──
  static const double minEnrollmentQuality = 0.70;
  static const double minRecognitionQuality = 0.40;
  static const double nearDuplicateThreshold = 0.95;  // cosine sim between frames

  // ── Pose Limits ──
  static const double maxYaw = 35.0;
  static const double maxPitch = 25.0;
  static const double maxRoll = 25.0;
  static const double enrollmentMaxYaw = 45.0;  // slightly more lenient for pose diversity

  // ── Enrollment ──
  static const int enrollmentDurationSeconds = 5;
  static const int minEnrollmentFrames = 15;
  static const int maxEnrollmentFrames = 30;
  static const int maxTemplatesPerStudent = 10;  // after clustering

  // ── Matching ──
  static const double strongMatchThreshold = 0.45;
  static const double weakMatchThreshold = 0.35;
  static const double ambiguityGap = 0.05;  // min gap between top-1 and top-2
  static const int minSupportingFrames = 3;

  // ── Multi-Frame Aggregation ──
  static const int maxEmbeddingsPerTrack = 7;
  static const String aggregationMethod = 'quality_weighted_top_n';

  // ── Liveness ──
  static const bool livenessEnabled = true;
  static const double minEmbeddingVariance = 0.02;  // live > photo
  static const double minMovementPixels = 5.0;
  static const int livenessWindowFrames = 10;

  // ── Tracking ──
  static const double trackIoUThreshold = 0.3;
  static const int trackExpiryFrames = 5;
  static const int maxConcurrentTracks = 5;

  // ── Performance ──
  static const int maxInferenceQueueSize = 2;
  static const bool enableTelemetry = true;  // debug toggle

  // ── Attendance ──
  static const int attendanceCooldownMinutes = 180;

  // ── Model ──
  static const String modelPath = 'assets/models/mobilefacenet.tflite';
  static const int modelInputSize = 112;
  static const int embeddingDimension = 192;
}
