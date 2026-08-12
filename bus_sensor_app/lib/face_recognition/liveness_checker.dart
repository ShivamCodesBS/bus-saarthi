/// Liveness stub — on-device liveness detection via ML Kit has been removed.
///
/// AWS Rekognition's SearchFacesByImage performs its own quality filtering
/// (sharpness, brightness, pose) server-side. No on-device liveness check needed.
class LivenessChecker {
  /// Always returns false — liveness is now handled by Rekognition quality gate.
  static bool detectBlink(dynamic face) => false;
}
