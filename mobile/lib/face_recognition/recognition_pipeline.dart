import 'dart:async';
import 'package:camera/camera.dart';
import 'recognition_config.dart';
import 'face_detector.dart';
import 'face_quality_engine.dart';
import 'face_aligner.dart';
import 'arcface_service.dart';
import 'face_tracker.dart';
import 'multi_frame_aggregator.dart';
import 'face_matcher.dart';
import 'liveness_checker.dart';
import 'performance_telemetry.dart';

// --- Events ---
abstract class RecognitionEvent {}
class FaceDetectedEvent extends RecognitionEvent { 
  final List<TrackedFace> faces;
  FaceDetectedEvent(this.faces);
}
class MatchProgressEvent extends RecognitionEvent { 
  final int trackId; 
  final String? candidate; 
  final double confidence; 
  final int frames;
  MatchProgressEvent(this.trackId, this.candidate, this.confidence, this.frames);
}
class AttendanceMarkedEvent extends RecognitionEvent { 
  final String studentId; 
  final String name; 
  final double confidence;
  AttendanceMarkedEvent(this.studentId, this.name, this.confidence);
}
class DuplicateAttendanceEvent extends RecognitionEvent { 
  final String studentId; 
  final String name;
  DuplicateAttendanceEvent(this.studentId, this.name);
}
class UnknownFaceEvent extends RecognitionEvent { 
  final int trackId;
  UnknownFaceEvent(this.trackId);
}
class ErrorEvent extends RecognitionEvent { 
  final String message;
  ErrorEvent(this.message);
}
class TelemetryEvent extends RecognitionEvent { 
  final TelemetryData data;
  TelemetryEvent(this.data);
}

class RecognitionPipeline {
  final FaceDetectionService _detector = FaceDetectionService();
  final FaceQualityEngine _qualityEngine = FaceQualityEngine();
  final FaceAligner _aligner = FaceAligner();
  final ArcFaceService _recognizer = ArcFaceService();
  final FaceTracker _tracker = FaceTracker();
  late final FaceMatcher _matcher;
  late final MultiFrameAggregator _aggregator;
  final LivenessChecker _liveness = LivenessChecker();
  final PerformanceTelemetry _telemetry = PerformanceTelemetry();
  
  bool _isProcessing = false;
  int _frameCount = 0;
  
  // Local dedup cache to prevent duplicate marking in same session
  final Map<String, DateTime> _markedStudents = {};

  final StreamController<RecognitionEvent> _eventsController = StreamController<RecognitionEvent>.broadcast();
  Stream<RecognitionEvent> get events => _eventsController.stream;

  Future<void> initialize() async {
    _matcher = FaceMatcher();
    _aggregator = MultiFrameAggregator(_matcher);
    
    _detector.initialize();
    await _recognizer.initialize();
    
    if (!_recognizer.isReady) {
      _eventsController.add(ErrorEvent("Failed to load facial recognition model."));
    }
  }

  Future<void> forceCacheRefresh() async {
    await _matcher.forceRefresh();
  }

  void _emit(RecognitionEvent event) {
    if (!_eventsController.isClosed) {
      _eventsController.add(event);
    }
  }

  Future<void> processFrame(CameraImage image, CameraDescription camera) async {
    _frameCount++;
    if (RecognitionConfig.enableTelemetry) _telemetry.onFrameReceived();

    if (_frameCount % RecognitionConfig.detectionFrameSkip != 0) return;
    
    // Back-pressure: drop frame if pipeline is busy
    if (_isProcessing) return;
    _isProcessing = true;

    try {
      // 1. Detection
      final swDetection = Stopwatch()..start();
      final faces = await _detector.detectFaces(image, camera);
      swDetection.stop();
      if (RecognitionConfig.enableTelemetry) _telemetry.recordDetectionMs(swDetection.elapsedMilliseconds);

      // 2. Tracking
      final trackedFaces = _tracker.update(faces);
      if (trackedFaces.isNotEmpty) {
        _emit(FaceDetectedEvent(trackedFaces));
      }

      TrackedFace? bestCandidate;
      double highestPriority = -1.0;

      // 3. Quality Scoring & Priority Queue Selection
      for (var track in trackedFaces) {
        if (track.attendanceMarked) continue; // Skip already marked

        final quality = _qualityEngine.score(track, image, camera.lensDirection);
        
        if (quality.totalScore < RecognitionConfig.minRecognitionQuality) {
          continue; // Too poor quality to waste inference on
        }
        
        track.addQuality(quality);
        
        // Priority = Quality * (1 - Confidence). Unrecognized high-quality faces get priority.
        final priority = quality.totalScore * (1.0 - track.matchConfidence);
        if (priority > highestPriority) {
          highestPriority = priority;
          bestCandidate = track;
        }
      }

      // 4. Inference & Matching (Only 1 face per frame to avoid lag)
      if (bestCandidate != null && _recognizer.isReady) {
        final aligned = _aligner.align(image, bestCandidate, camera.lensDirection);
        final embedding = await _recognizer.getEmbeddingFromAlignedImage(aligned);
        
        if (RecognitionConfig.enableTelemetry) _telemetry.recordInferenceMs(_recognizer.lastInferenceTimeMs);

        if (embedding != null) {
          bestCandidate.addEmbedding(embedding, bestCandidate.qualityHistory.last);
          
          final aggregated = await _aggregator.aggregate(bestCandidate);
          
          if (aggregated.bestMatch != null) {
            final match = aggregated.bestMatch!;
            
            if (aggregated.state == AggregationState.match) {
              // 5. Liveness
              final liveness = _liveness.check(bestCandidate);
              if (liveness.isLive) {
                _markAttendance(bestCandidate, match);
              } else {
                print('[Pipeline] Spoof suspected for track ${bestCandidate.trackId}: ${liveness.reason}');
                // Could emit a SuspiciousEvent here if needed
              }
            } else if (aggregated.state == AggregationState.uncertain) {
              _emit(MatchProgressEvent(bestCandidate.trackId, match.name, aggregated.trimmedSimilarity, bestCandidate.supportingFrames));
            } else if (aggregated.state == AggregationState.unknown) {
              _emit(UnknownFaceEvent(bestCandidate.trackId));
            }
          }
        }
      }

      // Telemetry
      if (RecognitionConfig.enableTelemetry) {
        String? topId;
        double topConf = 0.0;
        if (bestCandidate != null) {
          topId = bestCandidate.matchedName ?? bestCandidate.matchedStudentId;
          topConf = bestCandidate.matchConfidence;
        }
        _emit(TelemetryEvent(_telemetry.generateReport(trackedFaces.length, topId, topConf)));
      }

    } catch (e) {
      print('[Pipeline] Error processing frame: $e');
    } finally {
      _isProcessing = false;
    }
  }

  void _markAttendance(TrackedFace track, MatchResult match) {
    if (match.studentId == null) return;
    
    // Check dedup cache
    final lastMarked = _markedStudents[match.studentId!];
    final now = DateTime.now();
    
    if (lastMarked != null) {
      final diff = now.difference(lastMarked).inMinutes;
      if (diff < RecognitionConfig.attendanceCooldownMinutes) {
        if (!track.attendanceMarked) {
          track.attendanceMarked = true;
          _emit(DuplicateAttendanceEvent(match.studentId!, match.name ?? "Unknown"));
        }
        return;
      }
    }

    // Mark as attended
    _markedStudents[match.studentId!] = now;
    track.attendanceMarked = true;
    
    _emit(AttendanceMarkedEvent(match.studentId!, match.name ?? "Unknown", match.similarity));
  }

  void clearSession() {
    _markedStudents.clear();
    _tracker.clear();
  }

  void dispose() {
    _eventsController.close();
    _detector.dispose();
    _recognizer.dispose();
    _matcher.dispose();
  }
}
