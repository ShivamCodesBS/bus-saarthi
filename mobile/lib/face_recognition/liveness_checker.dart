import 'dart:math';
import 'package:flutter/material.dart';
import 'face_tracker.dart';
import 'arcface_service.dart';
import 'recognition_config.dart';

class LivenessResult {
  final bool isLive;
  final double score;
  final String reason;

  LivenessResult({
    required this.isLive,
    required this.score,
    required this.reason,
  });
}

class LivenessChecker {
  /// Checks liveness passively using accumulated tracking data.
  /// Normal flow requires no user interaction.
  LivenessResult check(TrackedFace track) {
    if (!RecognitionConfig.livenessEnabled) {
      return LivenessResult(isLive: true, score: 1.0, reason: "Liveness disabled");
    }

    if (track.positionHistory.length < 3 || track.embeddingHistory.length < 2) {
      return LivenessResult(isLive: true, score: 0.5, reason: "Insufficient data, assuming live");
    }

    // 1. Temporal Movement (face moves naturally over frames)
    final double movementScore = _checkMovement(track.positionHistory);
    
    // 2. Embedding Variance (live face produces slightly different embeddings; photo produces identical)
    final double embeddingVarianceScore = _checkEmbeddingVariance(track.embeddingHistory);
    
    // 3. 3D Pose Variation (live faces have subtle 3D rotational jitter, flat photos do not)
    final double poseVariationScore = _checkPoseVariation(track.yawHistory, track.pitchHistory);

    // Composite score
    final double totalScore = (movementScore * 0.25) + (embeddingVarianceScore * 0.5) + (poseVariationScore * 0.25);

    if (totalScore < 0.3) {
      return LivenessResult(isLive: false, score: totalScore, reason: "Suspiciously static (possible spoof)");
    }

    return LivenessResult(isLive: true, score: totalScore, reason: "Live");
  }

  double _checkMovement(List<Offset> positions) {
    if (positions.length < 2) return 0.0;
    
    double maxDist = 0.0;
    for (int i = 1; i < positions.length; i++) {
      final dist = (positions[i] - positions[i-1]).distance;
      if (dist > maxDist) maxDist = dist;
    }
    
    // Some natural jitter is expected. 0 jitter = static photo.
    if (maxDist < RecognitionConfig.minMovementPixels) {
      return 0.0; // Suspiciously perfectly still
    }
    
    return (maxDist / 20.0).clamp(0.0, 1.0);
  }

  double _checkEmbeddingVariance(List<List<double>> embeddings) {
    if (embeddings.length < 2) return 0.0;
    
    double maxDist = 0.0;
    
    // Check maximum pairwise cosine distance
    for (int i = 0; i < embeddings.length; i++) {
      for (int j = i + 1; j < embeddings.length; j++) {
        final sim = ArcFaceService.cosineSimilarity(embeddings[i], embeddings[j]);
        final dist = 1.0 - sim; // distance
        if (dist > maxDist) maxDist = dist;
      }
    }
    
    // If the embeddings are exactly identical across different frames, it's likely a static printed photo.
    // Live faces have slight variations (0.02 - 0.08 distance typically)
    if (maxDist < RecognitionConfig.minEmbeddingVariance) {
      return 0.0; 
    }
    
    return (maxDist / 0.1).clamp(0.0, 1.0);
  }

  double _checkPoseVariation(List<double> yaw, List<double> pitch) {
    if (yaw.length < 2) return 0.0;
    
    double maxYawDiff = 0.0;
    double maxPitchDiff = 0.0;
    
    for (int i = 1; i < yaw.length; i++) {
      final yDiff = (yaw[i] - yaw[i-1]).abs();
      final pDiff = (pitch[i] - pitch[i-1]).abs();
      if (yDiff > maxYawDiff) maxYawDiff = yDiff;
      if (pDiff > maxPitchDiff) maxPitchDiff = pDiff;
    }
    
    // Live faces usually have > 1 degree of micro-movement in 3D space
    final totalDiff = maxYawDiff + maxPitchDiff;
    if (totalDiff < 1.0) {
      return 0.0; // Suspiciously flat/rigid
    }
    
    return (totalDiff / 5.0).clamp(0.0, 1.0);
  }
}
