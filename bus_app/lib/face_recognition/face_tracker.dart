import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'recognition_config.dart';
import 'face_quality_engine.dart';

class TrackedFace {
  final int trackId;
  Face face; // Latest ML Kit face data
  
  int framesAlive = 0;
  int framesMissed = 0;
  
  // Accumulated evidence
  final List<FaceQualityResult> qualityHistory = [];
  final List<List<double>> embeddingHistory = [];
  final List<double> embeddingQualities = [];
  final List<Offset> positionHistory = [];
  final List<double> yawHistory = [];
  final List<double> pitchHistory = [];
  
  // Matching State
  String? matchedStudentId;
  String? matchedName;
  String? matchedFeeStatus;
  double matchConfidence = 0.0;
  bool isStableIdentity = false;
  int supportingFrames = 0;
  
  // Final Decision State
  bool isLive = false;
  bool attendanceMarked = false;

  TrackedFace(this.trackId, this.face) {
    positionHistory.add(Offset(
      face.boundingBox.left + face.boundingBox.width / 2,
      face.boundingBox.top + face.boundingBox.height / 2,
    ));
    yawHistory.add(face.headEulerAngleY ?? 0.0);
    pitchHistory.add(face.headEulerAngleX ?? 0.0);
  }

  void updateFace(Face newFace) {
    face = newFace;
    framesAlive++;
    framesMissed = 0;
    
    positionHistory.add(Offset(
      face.boundingBox.left + face.boundingBox.width / 2,
      face.boundingBox.top + face.boundingBox.height / 2,
    ));
    yawHistory.add(face.headEulerAngleY ?? 0.0);
    pitchHistory.add(face.headEulerAngleX ?? 0.0);
    
    if (positionHistory.length > RecognitionConfig.livenessWindowFrames) {
      positionHistory.removeAt(0);
      yawHistory.removeAt(0);
      pitchHistory.removeAt(0);
    }
  }
  
  void addQuality(FaceQualityResult quality) {
    qualityHistory.add(quality);
    if (qualityHistory.length > 20) {
      qualityHistory.removeAt(0);
    }
  }

  void addEmbedding(List<double> embedding, FaceQualityResult quality) {
    embeddingHistory.add(embedding);
    embeddingQualities.add(quality.totalScore);
    
    if (embeddingHistory.length > RecognitionConfig.maxEmbeddingsPerTrack) {
      // Remove lowest quality embedding instead of just oldest
      int minIdx = 0;
      double minQ = embeddingQualities[0];
      for (int i = 1; i < embeddingQualities.length; i++) {
        if (embeddingQualities[i] < minQ) {
          minQ = embeddingQualities[i];
          minIdx = i;
        }
      }
      embeddingHistory.removeAt(minIdx);
      embeddingQualities.removeAt(minIdx);
    }
  }
}

class FaceTracker {
  final Map<int, TrackedFace> _activeTracks = {};
  int _nextTrackId = 1;

  /// Updates active tracks with new detections using ML Kit tracking ID or IoU fallback.
  List<TrackedFace> update(List<Face> detectedFaces) {
    final List<TrackedFace> updatedTracks = [];
    final Set<int> matchedTrackIds = {};

    for (var face in detectedFaces) {
      TrackedFace? matchedTrack;

      // 1. Try ML Kit tracking ID if available
      if (face.trackingId != null) {
        if (_activeTracks.containsKey(face.trackingId)) {
          matchedTrack = _activeTracks[face.trackingId];
        } else {
          // New ML Kit tracked face
          matchedTrack = TrackedFace(face.trackingId!, face);
          _activeTracks[face.trackingId!] = matchedTrack;
        }
      } 
      // 2. Fallback to IoU (Intersection over Union) matching
      else {
        double maxIoU = 0.0;
        int? bestTrackId;

        for (var entry in _activeTracks.entries) {
          if (matchedTrackIds.contains(entry.key)) continue;

          final iou = _calculateIoU(face.boundingBox, entry.value.face.boundingBox);
          if (iou > maxIoU && iou > RecognitionConfig.trackIoUThreshold) {
            maxIoU = iou;
            bestTrackId = entry.key;
          }
        }

        if (bestTrackId != null) {
          matchedTrack = _activeTracks[bestTrackId];
        } else {
          // New un-tracked face
          matchedTrack = TrackedFace(_nextTrackId++, face);
          _activeTracks[matchedTrack.trackId] = matchedTrack;
        }
      }

      if (matchedTrack != null) {
        matchedTrack.updateFace(face);
        matchedTrackIds.add(matchedTrack.trackId);
        updatedTracks.add(matchedTrack);
      }
    }

    // Handle missed tracks
    final List<int> toRemove = [];
    for (var entry in _activeTracks.entries) {
      if (!matchedTrackIds.contains(entry.key)) {
        entry.value.framesMissed++;
        if (entry.value.framesMissed >= RecognitionConfig.trackExpiryFrames) {
          toRemove.add(entry.key);
        }
      }
    }

    for (var id in toRemove) {
      _activeTracks.remove(id);
    }

    // Limit active tracks to prevent memory bloat
    if (_activeTracks.length > RecognitionConfig.maxConcurrentTracks) {
      final entries = _activeTracks.entries.toList()
        ..sort((a, b) => b.value.framesAlive.compareTo(a.value.framesAlive)); // keep oldest/most stable
      
      for (int i = RecognitionConfig.maxConcurrentTracks; i < entries.length; i++) {
        _activeTracks.remove(entries[i].key);
      }
    }

    return updatedTracks;
  }

  double _calculateIoU(Rect a, Rect b) {
    final intersection = a.intersect(b);
    if (intersection.width <= 0 || intersection.height <= 0) return 0.0;
    
    final iArea = intersection.width * intersection.height;
    final aArea = a.width * a.height;
    final bArea = b.width * b.height;
    
    return iArea / (aArea + bArea - iArea);
  }
  
  void clear() {
    _activeTracks.clear();
  }
}
