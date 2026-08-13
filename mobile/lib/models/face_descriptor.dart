/// On-device face recognition result model.
///
/// Used to pass match results from the local ArcFace pipeline
/// to the UI and attendance sync layer.
class FaceMatchInfo {
  final String loginId;
  final String name;
  final String feeStatus;
  final double confidence; // Cosine similarity as percentage (0-100)
  final String? routeId;

  const FaceMatchInfo({
    required this.loginId,
    required this.name,
    required this.feeStatus,
    required this.confidence,
    this.routeId,
  });
}
