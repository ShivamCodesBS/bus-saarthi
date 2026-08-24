import 'face_tracker.dart';
import 'face_matcher.dart';
import 'recognition_config.dart';

enum AggregationState { match, uncertain, unknown }

class AggregatedMatch {
  final AggregationState state;
  final MatchResult? bestMatch;
  final double trimmedSimilarity;
  
  AggregatedMatch(this.state, this.bestMatch, {this.trimmedSimilarity = 0.0});
}

class MultiFrameAggregator {
  final FaceMatcher _matcher;

  MultiFrameAggregator(this._matcher);

  /// Aggregates match results across multiple frames for a tracked face.
  Future<AggregatedMatch> aggregate(TrackedFace track) async {
    if (track.embeddingHistory.isEmpty) {
      return AggregatedMatch(AggregationState.unknown, null);
    }

    // Map to count votes for each student identity
    Map<String, double> identityScoreSums = {};
    Map<String, int> identityVoteCounts = {};
    Map<String, MatchResult> bestMatchInstances = {};
    
    // Store all similarities for the top ID for trimmed mean
    Map<String, List<Map<String, dynamic>>> allMatchData = {};

    for (int i = 0; i < track.embeddingHistory.length; i++) {
      final embedding = track.embeddingHistory[i];
      final quality = track.embeddingQualities[i];
      
      final matchResult = await _matcher.match(embedding);
      
      if (matchResult.studentId != null) {
        final id = matchResult.studentId!;
        final weightedScore = matchResult.similarity * quality;
        
        identityScoreSums[id] = (identityScoreSums[id] ?? 0) + weightedScore;
        identityVoteCounts[id] = (identityVoteCounts[id] ?? 0) + 1;
        
        if (!allMatchData.containsKey(id)) {
          allMatchData[id] = [];
        }
        allMatchData[id]!.add({
          'sim': matchResult.similarity,
          'qual': quality,
        });
        
        if (bestMatchInstances[id] == null || matchResult.similarity > bestMatchInstances[id]!.similarity) {
          bestMatchInstances[id] = matchResult;
        }
      }
    }

    if (identityVoteCounts.isEmpty) {
      return AggregatedMatch(AggregationState.unknown, MatchResult(
        confidence: MatchConfidence.unknown,
        studentId: null,
        name: null,
        feeStatus: null,
        routeId: null,
        similarity: 0.0,
      ));
    }

    // Find the identity with the most votes
    String? topId;
    int maxVotes = 0;
    
    identityVoteCounts.forEach((id, votes) {
      if (votes > maxVotes) {
        maxVotes = votes;
        topId = id;
      } else if (votes == maxVotes) {
        // Tie-breaker: use weighted score sum
        if (identityScoreSums[id]! > identityScoreSums[topId!]!) {
          topId = id;
        }
      }
    });

    if (topId != null) {
      final topMatch = bestMatchInstances[topId]!;
      final matchList = allMatchData[topId]!;
      
      // Calculate Quality-Weighted Trimmed Mean
      double finalSim = topMatch.similarity;
      
      if (matchList.length >= 4) {
        matchList.sort((a, b) => (a['sim'] as double).compareTo(b['sim'] as double));
        // Trim lowest and highest
        final trimmed = matchList.sublist(1, matchList.length - 1);
        
        double weightedSum = 0;
        double weightTotal = 0;
        for (var item in trimmed) {
          double s = item['sim'];
          double q = item['qual'];
          weightedSum += s * q;
          weightTotal += q;
        }
        
        if (weightTotal > 0) {
          finalSim = weightedSum / weightTotal;
        }
      } else {
        // Just use quality weighted mean
        double weightedSum = 0;
        double weightTotal = 0;
        for (var item in matchList) {
          double s = item['sim'];
          double q = item['qual'];
          weightedSum += s * q;
          weightTotal += q;
        }
        if (weightTotal > 0) {
          finalSim = weightedSum / weightTotal;
        }
      }
      
      // Update track state
      track.matchedStudentId = topMatch.studentId;
      track.matchedName = topMatch.name;
      track.matchedFeeStatus = topMatch.feeStatus;
      track.matchConfidence = finalSim;
      track.supportingFrames = maxVotes;

      // 3-State Logic
      if (maxVotes >= RecognitionConfig.minSupportingFrames) {
        final totalVotes = track.embeddingHistory.length;
        if (maxVotes / totalVotes >= 0.6) { 
          if (finalSim >= RecognitionConfig.strongMatchThreshold) {
            track.isStableIdentity = true;
            return AggregatedMatch(AggregationState.match, topMatch, trimmedSimilarity: finalSim);
          } else if (finalSim >= RecognitionConfig.weakMatchThreshold) {
            return AggregatedMatch(AggregationState.uncertain, topMatch, trimmedSimilarity: finalSim);
          }
        } else {
           // Too much identity switching
           return AggregatedMatch(AggregationState.uncertain, topMatch, trimmedSimilarity: finalSim);
        }
      }
      
      // Not enough frames yet -> uncertain or unknown
      return AggregatedMatch(AggregationState.unknown, topMatch, trimmedSimilarity: finalSim);
    }
    
    return AggregatedMatch(AggregationState.unknown, null);
  }
}
