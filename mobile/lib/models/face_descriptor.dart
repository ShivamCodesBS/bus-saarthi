/// AWS face recognition result model.
///
/// Replaces the old [FaceDescriptor] which held a 128-dim float embedding.
/// Embeddings are no longer stored or compared on-device.
class AwsFaceResult {
  final String loginId;
  final String name;
  final String feeStatus;
  final double confidence;
  final String? routeId;

  const AwsFaceResult({
    required this.loginId,
    required this.name,
    required this.feeStatus,
    required this.confidence,
    this.routeId,
  });

  factory AwsFaceResult.fromJson(Map<String, dynamic> json) {
    final student = json['student'] as Map<String, dynamic>? ?? {};
    return AwsFaceResult(
      loginId:    student['login_id']   as String? ?? '',
      name:       student['name']       as String? ?? 'Unknown',
      feeStatus:  student['fee_status'] as String? ?? 'unpaid',
      confidence: (json['confidence']   as num?)?.toDouble() ?? 0.0,
      routeId:    student['route_id']   as String?,
    );
  }
}
