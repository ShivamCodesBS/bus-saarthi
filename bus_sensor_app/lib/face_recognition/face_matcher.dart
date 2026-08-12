/// Result returned by AWS Rekognition face recognition.
///
/// Replaces the old [FaceDescriptor] embedding-based model.
/// All matching is performed server-side by AWS Rekognition.
class RecognitionResult {
  final bool matched;
  final String? loginId;
  final String? name;
  final String? feeStatus;
  final String? routeId;
  final String? profilePic;
  final double? confidence;

  final bool isCooldown;
  final bool isLimitReached;

  const RecognitionResult({
    required this.matched,
    this.loginId,
    this.name,
    this.feeStatus,
    this.routeId,
    this.profilePic,
    this.confidence,
    this.isCooldown = false,
    this.isLimitReached = false,
  });

  factory RecognitionResult.noMatch() => const RecognitionResult(matched: false);

  factory RecognitionResult.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>? ?? {};
    final status = json['status'];
    return RecognitionResult(
      matched:    status == 'matched' || status == 'cooldown' || status == 'limit_reached',
      loginId:    student['login_id'] as String?,
      name:       student['name'] as String?,
      feeStatus:  student['fee_status'] as String?,
      routeId:    student['route_id'] as String?,
      profilePic: student['profile_pic'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble(),
      isCooldown: status == 'cooldown',
      isLimitReached: status == 'limit_reached',
    );
  }
}
