import 'dart:async';
import 'arcface_service.dart';
import 'embedding_store.dart';
import 'recognition_config.dart';

enum MatchConfidence { strong, weak, unknown, ambiguous }

class MatchResult {
  final MatchConfidence confidence;
  final String? studentId;
  final String? name;
  final String? feeStatus;
  final String? routeId;
  final double similarity;
  final double? secondBestSimilarity;
  final int templatesCompared;

  MatchResult({
    required this.confidence,
    this.studentId,
    this.name,
    this.feeStatus,
    this.routeId,
    required this.similarity,
    this.secondBestSimilarity,
    this.templatesCompared = 0,
  });
}

class FaceMatcher {
  final EmbeddingStore _store = EmbeddingStore();
  
  List<StudentProfile> _cachedProfiles = [];
  Timer? _refreshTimer;
  bool _isCacheLoaded = false;

  FaceMatcher() {
    // Refresh cache periodically to pick up new enrollments
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _loadCache();
    });
    _loadCache();
  }

  Future<void> _loadCache() async {
    _cachedProfiles = await _store.getAllStudentProfiles();
    _isCacheLoaded = true;
  }
  
  Future<void> forceRefresh() async {
    await _loadCache();
  }

  /// Matches a live embedding against all student profiles using multi-template max similarity.
  Future<MatchResult> match(List<double> queryEmbedding) async {
    if (!_isCacheLoaded) {
      await _loadCache();
    }

    if (_cachedProfiles.isEmpty) {
      return MatchResult(
        confidence: MatchConfidence.unknown,
        similarity: 0.0,
      );
    }

    double bestSim = -1.0;
    StudentProfile? bestProfile;
    
    double secondBestSim = -1.0;
    
    int templatesCompared = 0;

    for (final profile in _cachedProfiles) {
      if (profile.templates.isEmpty) continue;
      
      // Find the best similarity across all templates for this student
      double profileBestSim = -1.0;
      for (final template in profile.templates) {
        final sim = ArcFaceService.cosineSimilarity(queryEmbedding, template.embedding);
        if (sim > profileBestSim) {
          profileBestSim = sim;
        }
        templatesCompared++;
      }

      if (profileBestSim > bestSim) {
        secondBestSim = bestSim;
        bestSim = profileBestSim;
        bestProfile = profile;
      } else if (profileBestSim > secondBestSim) {
        secondBestSim = profileBestSim;
      }
    }

    if (bestProfile == null) {
      return MatchResult(
        confidence: MatchConfidence.unknown,
        similarity: 0.0,
        templatesCompared: templatesCompared,
      );
    }

    MatchConfidence confidence;
    
    if (bestSim >= RecognitionConfig.strongMatchThreshold) {
      // Check for ambiguity (two students look very similar)
      if (secondBestSim > 0 && (bestSim - secondBestSim) < RecognitionConfig.ambiguityGap) {
        confidence = MatchConfidence.ambiguous;
      } else {
        confidence = MatchConfidence.strong;
      }
    } else if (bestSim >= RecognitionConfig.weakMatchThreshold) {
      // Wait for more frames to accumulate evidence
      confidence = MatchConfidence.weak;
    } else {
      confidence = MatchConfidence.unknown;
    }

    return MatchResult(
      confidence: confidence,
      studentId: bestProfile.loginId,
      name: bestProfile.name,
      feeStatus: bestProfile.feeStatus,
      routeId: bestProfile.routeId,
      similarity: bestSim,
      secondBestSimilarity: secondBestSim,
      templatesCompared: templatesCompared,
    );
  }

  void dispose() {
    _refreshTimer?.cancel();
  }
}
