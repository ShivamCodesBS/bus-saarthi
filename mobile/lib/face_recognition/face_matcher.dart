import 'arcface_service.dart';
import 'embedding_store.dart';
import '../core/constants.dart';

/// On-device face matching using ArcFace cosine similarity.
///
/// Compares a live embedding against all enrolled faces in the local store
/// and returns the best match above the similarity threshold.
class FaceMatcher {
  final EmbeddingStore _store;

  // Cache enrolled faces to avoid hitting SQLite on every frame
  List<StoredFace> _cachedFaces = [];
  DateTime? _lastCacheRefresh;
  static const _cacheLifetime = Duration(seconds: 30);

  FaceMatcher(this._store);

  /// Refresh the in-memory cache of enrolled faces.
  Future<void> refreshCache() async {
    _cachedFaces = await _store.getAll();
    _lastCacheRefresh = DateTime.now();
  }

  /// Match a live embedding against all enrolled faces.
  ///
  /// Returns a [MatchResult] with the best match, or [MatchResult.noMatch()]
  /// if no face exceeds the similarity threshold.
  Future<MatchResult> match(List<double> liveEmbedding) async {
    // Auto-refresh cache if stale
    if (_lastCacheRefresh == null ||
        DateTime.now().difference(_lastCacheRefresh!) > _cacheLifetime) {
      await refreshCache();
    }

    if (_cachedFaces.isEmpty) {
      return MatchResult.noMatch();
    }

    double bestSimilarity = -1;
    StoredFace? bestFace;

    for (final face in _cachedFaces) {
      final similarity = ArcFaceService.cosineSimilarity(liveEmbedding, face.embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestFace = face;
      }
    }

    if (bestFace != null && bestSimilarity >= AppConstants.arcFaceSimilarityThreshold) {
      return MatchResult(
        matched: true,
        loginId: bestFace.loginId,
        name: bestFace.name,
        feeStatus: bestFace.feeStatus,
        routeId: bestFace.routeId,
        confidence: bestSimilarity * 100, // Convert to percentage
      );
    }

    return MatchResult.noMatch();
  }

  /// Number of enrolled faces available for matching.
  int get enrolledCount => _cachedFaces.length;
}

/// Result of an on-device face match.
class MatchResult {
  final bool matched;
  final String? loginId;
  final String? name;
  final String? feeStatus;
  final String? routeId;
  final double? confidence;

  // Attendance dedup flags (set by caller based on local cache)
  final bool isCooldown;
  final bool isLimitReached;

  const MatchResult({
    required this.matched,
    this.loginId,
    this.name,
    this.feeStatus,
    this.routeId,
    this.confidence,
    this.isCooldown = false,
    this.isLimitReached = false,
  });

  factory MatchResult.noMatch() => const MatchResult(matched: false);

  MatchResult copyWith({bool? isCooldown, bool? isLimitReached}) {
    return MatchResult(
      matched: matched,
      loginId: loginId,
      name: name,
      feeStatus: feeStatus,
      routeId: routeId,
      confidence: confidence,
      isCooldown: isCooldown ?? this.isCooldown,
      isLimitReached: isLimitReached ?? this.isLimitReached,
    );
  }
}
