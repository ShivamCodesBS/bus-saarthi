import 'face_detector.dart';

/// Basic on-device liveness detection using ML Kit face classification.
///
/// Uses eye open probability from ML Kit to detect blinks, which helps
/// prevent spoofing with static photos.
class LivenessChecker {
  int _blinkCount = 0;
  bool _eyesClosed = false;
  static const double _eyeClosedThreshold = 0.3;
  static const double _eyeOpenThreshold = 0.7;

  /// Process a detected face and track blink events.
  /// Returns true if a blink was just detected on this frame.
  bool processFace(DetectedFace face) {
    final leftEye = face.leftEyeOpenProbability ?? 1.0;
    final rightEye = face.rightEyeOpenProbability ?? 1.0;

    final avgEyeOpen = (leftEye + rightEye) / 2;

    if (!_eyesClosed && avgEyeOpen < _eyeClosedThreshold) {
      _eyesClosed = true;
    } else if (_eyesClosed && avgEyeOpen > _eyeOpenThreshold) {
      _eyesClosed = false;
      _blinkCount++;
      return true; // Blink detected
    }

    return false;
  }

  /// Check if the face is looking roughly straight at the camera.
  /// Returns true if head angles are within acceptable range.
  static bool isFaceStraight(DetectedFace face, {double maxAngle = 25}) {
    final yaw = face.headEulerAngleY?.abs() ?? 0;
    final roll = face.headEulerAngleZ?.abs() ?? 0;
    return yaw < maxAngle && roll < maxAngle;
  }

  /// Number of blinks detected since last reset.
  int get blinkCount => _blinkCount;

  /// Whether liveness has been confirmed (at least 1 blink detected).
  bool get isLive => _blinkCount >= 1;

  /// Reset blink counter for a new session.
  void reset() {
    _blinkCount = 0;
    _eyesClosed = false;
  }
}
