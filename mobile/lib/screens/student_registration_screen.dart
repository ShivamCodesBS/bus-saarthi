import 'dart:async';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'dart:io' show Platform;

import '../face_recognition/face_detector.dart';
import '../face_recognition/embedding_store.dart';
import '../face_recognition/face_quality_engine.dart';
import '../face_recognition/face_aligner.dart';
import '../face_recognition/arcface_service.dart';
import '../face_recognition/face_tracker.dart';
import '../face_recognition/recognition_config.dart';
import '../services/api_service.dart';
import '../core/theme.dart';
import 'widgets/loading_overlay.dart';

class StudentRegistrationScreen extends StatefulWidget {
  const StudentRegistrationScreen({Key? key}) : super(key: key);

  @override
  State<StudentRegistrationScreen> createState() => _StudentRegistrationScreenState();
}

class _StudentRegistrationScreenState extends State<StudentRegistrationScreen> {
  CameraController? _controller;
  CameraDescription? _camera;
  
  late final FaceDetectionService _detector;
  late final FaceQualityEngine _qualityEngine;
  late final FaceAligner _aligner;
  late final ArcFaceService _recognizer;
  late final FaceTracker _tracker;
  late final EmbeddingStore _store;
  final ApiService _apiService = ApiService();

  final TextEditingController _studentIdController = TextEditingController();

  bool _isInitialized = false;
  bool _isCapturing = false;
  String _status = 'Loading models...';
  
  // Auto-capture state
  int _capturedFrames = 0;
  final List<FaceTemplate> _collectedTemplates = [];
  bool _isProcessingFrame = false;
  
  bool _hasFrontal = false;
  bool _hasLeft = false;
  bool _hasRight = false;

  @override
  void initState() {
    super.initState();
    _detector = FaceDetectionService();
    _qualityEngine = FaceQualityEngine();
    _aligner = FaceAligner();
    _recognizer = ArcFaceService();
    _tracker = FaceTracker();
    _store = EmbeddingStore();
    
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _store.database;
      _detector.initialize();
      await _recognizer.initialize();
      
      if (mounted) setState(() => _status = 'Enter Student ID to begin auto-capture');
      await _initCamera();
      
      _isInitialized = true;
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) setState(() => _status = 'Error loading models: $e');
    }
  }

  Future<void> _initCamera() async {
    final cameras = await availableCameras();
    _camera = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    _controller = CameraController(
      _camera!,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.nv21
          : ImageFormatGroup.bgra8888,
    );

    await _controller!.initialize();
  }

  void _startAutoCapture() async {
    final studentId = _studentIdController.text.trim();
    if (studentId.isEmpty) {
      _showSnack('Please enter a Student ID', AppTheme.orange);
      return;
    }

    setState(() {
      _isCapturing = true;
      _capturedFrames = 0;
      _collectedTemplates.clear();
      _hasFrontal = false;
      _hasLeft = false;
      _hasRight = false;
      _status = 'Look straight, then slowly turn head left and right.';
    });

    _controller!.startImageStream((CameraImage image) {
      _processEnrollmentFrame(image, studentId);
    });
  }
  
  Future<void> _processEnrollmentFrame(CameraImage image, String studentId) async {
    if (_isProcessingFrame || !_isCapturing) return;
    _isProcessingFrame = true;
    
    try {
      final faces = await _detector.detectFaces(image, _camera!);
      if (faces.isEmpty) {
        if (mounted) setState(() => _status = 'No face detected');
        _isProcessingFrame = false;
        return;
      }
      
      if (faces.length > 1) {
        if (mounted) setState(() => _status = 'Multiple faces detected. Please stand alone.');
        _isProcessingFrame = false;
        return;
      }
      
      final trackedFaces = _tracker.update(faces);
      if (trackedFaces.isEmpty) {
        _isProcessingFrame = false;
        return;
      }
      
      final track = trackedFaces.first;
      final quality = _qualityEngine.score(track, image, _camera!.lensDirection);
      
      if (quality.totalScore < RecognitionConfig.minEnrollmentQuality) {
        if (mounted) setState(() => _status = 'Quality too low. Adjust lighting or come closer.');
        _isProcessingFrame = false;
        return;
      }
      
      // Face is good enough, extract embedding
      final aligned = _aligner.align(image, track, _camera!.lensDirection);
      final embedding = await _recognizer.getEmbeddingFromAlignedImage(aligned);
      
      if (embedding != null) {
        // Determine pose category
        final yaw = track.face.headEulerAngleY ?? 0;
        String pose = 'frontal';
        if (yaw > 12) {
          pose = 'left';  // Mirrored front camera
          _hasLeft = true;
        } else if (yaw < -12) {
          pose = 'right';
          _hasRight = true;
        } else {
          _hasFrontal = true;
        }
        
        // Skip adding if we already have too many of this pose (e.g., max 10 per pose)
        final poseCount = _collectedTemplates.where((t) => t.poseCategory == pose).length;
        if (poseCount < 10) {
          _collectedTemplates.add(FaceTemplate(
            loginId: studentId,
            embedding: embedding,
            poseCategory: pose,
            qualityScore: quality.totalScore,
            isCentroid: false,
          ));
        }
        
        if (mounted) {
          setState(() {
            _capturedFrames = _collectedTemplates.length;
            
            String missing = [];
            if (!_hasFrontal) missing.add('Front');
            if (!_hasLeft) missing.add('Left');
            if (!_hasRight) missing.add('Right');
            
            if (missing.isNotEmpty) {
              _status = 'Captured $_capturedFrames. Need: ${missing.join(", ")}';
            } else {
              _status = 'Captured $_capturedFrames frames.';
            }
          });
        }
        
        final hasAllPoses = _hasFrontal && _hasLeft && _hasRight;
        if (_capturedFrames >= RecognitionConfig.minEnrollmentFrames && hasAllPoses) {
          _finishEnrollment(studentId);
        } else if (_capturedFrames >= RecognitionConfig.maxEnrollmentFrames) {
          // Force finish if we hit max frames, even without all poses
          _finishEnrollment(studentId);
        }
      }
    } catch (e) {
      print('Enrollment frame error: $e');
    } finally {
      _isProcessingFrame = false;
    }
  }
  
  Future<void> _finishEnrollment(String studentId) async {
    setState(() => _isCapturing = false);
    await _controller!.stopImageStream();
    
    BusSarthiLoader.show(context, label: 'Saving multi-template profile...');
    
    try {
      // 1. Save student profile
      await _store.upsertStudent(
        studentId, 
        studentId, // Name will be synced from backend later
        'unpaid', 
        null, 
        _collectedTemplates.map((t) => t.qualityScore).reduce((a, b) => a + b) / _collectedTemplates.length
      );
      
      // 2. Save robust clustered templates (centroids)
      await _store.clusterAndSaveTemplates(studentId, _collectedTemplates);
      
      // 3. Notify backend
      _apiService.markFaceEnrolled(studentId); // fire-and-forget
      
      if (mounted) BusSarthiLoader.hide(context);
      
      if (mounted) {
        await _showSuccessDialog(studentId, _collectedTemplates.length);
        if (mounted) Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) BusSarthiLoader.hide(context);
      _showSnack('Save failed: $e', AppTheme.dangerColor);
      setState(() => _status = 'Enter Student ID to begin auto-capture');
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _showSuccessDialog(String studentId, int templates) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.face_retouching_natural, color: Color(0xFF22C55E), size: 52),
              ),
              const SizedBox(height: 20),
              const Text(
                'Enrollment Complete!',
                style: TextStyle(color: AppTheme.black, fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                'Student $studentId enrolled successfully with $templates high-quality templates.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.blackSoft, fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF22C55E),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Done', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    if (_controller != null && _controller!.value.isStreamingImages) {
      _controller!.stopImageStream();
    }
    _controller?.dispose();
    _detector.dispose();
    _recognizer.dispose();
    _studentIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Auto-Enroll Face', style: TextStyle(color: AppTheme.black, fontWeight: FontWeight.w800, fontSize: 18)),
        centerTitle: true,
      ),
      body: !_isInitialized
          ? Center(child: BusSarthiLoader(size: 80, label: _status))
          : Column(
              children: [
                // Camera preview
                Expanded(
                  flex: 6,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CameraPreview(_controller!),
                      Positioned(
                        top: 0, left: 0, right: 0, height: 60,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x88000000), Colors.transparent],
                            ),
                          ),
                        ),
                      ),
                      const Center(child: _OvalFaceGuide()),
                      
                      // Progress Bar
                      if (_isCapturing)
                        Positioned(
                          bottom: 20, left: 40, right: 40,
                          child: Column(
                            children: [
                              Text('$_capturedFrames / ${RecognitionConfig.maxEnrollmentFrames} frames', 
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              LinearProgressIndicator(
                                value: _capturedFrames / RecognitionConfig.maxEnrollmentFrames,
                                backgroundColor: Colors.black54,
                                color: AppTheme.orange,
                                minHeight: 8,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Controls
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                  child: Column(
                    children: [
                      // Status
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppTheme.orange.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.orange.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: AppTheme.orange, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _status,
                                style: const TextStyle(color: AppTheme.orange, fontWeight: FontWeight.w600, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Student ID
                      TextField(
                        controller: _studentIdController,
                        keyboardType: TextInputType.text,
                        textCapitalization: TextCapitalization.characters,
                        enabled: !_isCapturing,
                        style: const TextStyle(color: AppTheme.black, fontWeight: FontWeight.w600, fontSize: 15),
                        decoration: InputDecoration(
                          labelText: 'Student Login ID',
                          hintText: 'e.g. STU001',
                          prefixIcon: const Icon(Icons.badge_rounded),
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.surfaceBorder)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.surfaceBorder)),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.orange, width: 2)),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Capture button
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton.icon(
                          icon: _isCapturing
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                              : const Icon(Icons.face_retouching_natural, color: Colors.white),
                          label: Text(
                            _isCapturing ? 'Auto-Capturing...' : 'Start Auto-Capture',
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _isCapturing ? Colors.grey.shade400 : AppTheme.orange,
                            elevation: _isCapturing ? 0 : 4,
                            shadowColor: AppTheme.orange.withOpacity(0.4),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: _isCapturing ? null : _startAutoCapture,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _OvalFaceGuide extends StatefulWidget {
  const _OvalFaceGuide();

  @override
  State<_OvalFaceGuide> createState() => _OvalFaceGuideState();
}

class _OvalFaceGuideState extends State<_OvalFaceGuide> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.96, end: 1.04)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (_, __) => Transform.scale(
        scale: _pulse.value,
        child: Container(
          width: 180, height: 230,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(110),
            border: Border.all(color: AppTheme.orange, width: 3),
            boxShadow: [BoxShadow(color: AppTheme.orange.withOpacity(0.28), blurRadius: 20, spreadRadius: 2)],
          ),
        ),
      ),
    );
  }
}
