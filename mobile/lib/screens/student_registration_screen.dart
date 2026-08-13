import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'dart:io' show Platform;

import '../face_recognition/face_detector.dart';
import '../face_recognition/embedding_store.dart';
import '../services/api_service.dart';
import '../core/theme.dart';
import 'widgets/loading_overlay.dart';

/// Student face enrollment screen — ArcFace on-device.
///
/// Flow: Camera → ML Kit face detection → ArcFace embedding → Store locally.
/// Backend is notified that enrollment happened (metadata only, no image upload).
class StudentRegistrationScreen extends StatefulWidget {
  const StudentRegistrationScreen({Key? key}) : super(key: key);

  @override
  State<StudentRegistrationScreen> createState() => _StudentRegistrationScreenState();
}

class _StudentRegistrationScreenState extends State<StudentRegistrationScreen> {
  CameraController? _controller;
  late final FaceDetectionService _detectionService;
  late final EmbeddingStore _embeddingStore;
  final ApiService _apiService = ApiService();
  final TextEditingController _studentIdController = TextEditingController();

  bool _isCameraInitialized = false;
  bool _isModelReady = false;
  bool _isCapturing = false;
  String _status = 'Loading ArcFace model...';

  @override
  void initState() {
    super.initState();
    _detectionService = FaceDetectionService();
    _embeddingStore = EmbeddingStore();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _embeddingStore.initialize();
      await _detectionService.initialize();
      _isModelReady = true;
      if (mounted) setState(() => _status = 'Position your face in the oval and press Capture');
      await _initCamera();
    } catch (e) {
      if (mounted) setState(() => _status = 'Error loading ArcFace model: $e');
    }
  }

  Future<void> _initCamera() async {
    final cameras = await availableCameras();
    final front = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    _controller = CameraController(
      front,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.nv21
          : ImageFormatGroup.bgra8888,
    );

    await _controller!.initialize();
    if (!mounted) return;
    setState(() => _isCameraInitialized = true);
  }

  Future<void> _captureAndEnroll() async {
    final studentId = _studentIdController.text.trim();
    if (studentId.isEmpty) {
      _showSnack('Please enter a Student ID', AppTheme.orange);
      return;
    }

    if (!_isModelReady) {
      _showSnack('ArcFace model not ready yet', AppTheme.dangerColor);
      return;
    }

    setState(() {
      _isCapturing = true;
      _status = 'Capturing face...';
    });

    BusSarthiLoader.show(context, label: 'Detecting face...');

    try {
      // Capture + detect + extract embedding (all on-device)
      final result = await _detectionService.captureAndEmbed(_controller!);

      if (result == null) {
        throw Exception('Could not capture image. Please try again.');
      }

      if (!result.isSuccess) {
        throw Exception(result.error ?? 'Face detection failed.');
      }

      if (mounted) {
        BusSarthiLoader.hide(context);
        BusSarthiLoader.show(context, label: 'Saving face embedding...');
      }

      setState(() => _status = 'Storing ArcFace embedding locally...');

      // Store embedding in local SQLite
      await _embeddingStore.upsert(
        loginId: studentId,
        name: studentId, // Name will be synced from backend later
        feeStatus: 'unpaid',
        embedding: result.embedding!,
      );

      // Notify backend that enrollment happened (metadata only — no image)
      _apiService.markFaceEnrolled(studentId); // fire-and-forget

      if (mounted) BusSarthiLoader.hide(context);

      if (mounted) {
        await _showSuccessDialog(studentId);
        if (mounted) Navigator.pop(context);
      }
    } catch (e) {
      print('[StudentRegistration] error: $e');
      if (mounted) {
        BusSarthiLoader.hide(context);
        _showSnack('Error: $e', AppTheme.dangerColor);
        setState(() => _status = 'Position your face in the oval and press Capture');
      }
    } finally {
      if (mounted) setState(() => _isCapturing = false);
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

  Future<void> _showSuccessDialog(String studentId) {
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
                'Face Enrolled!',
                style: TextStyle(color: AppTheme.black, fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                'Student $studentId has been enrolled locally using ArcFace.\nFace recognition is ready for attendance.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.blackSoft, fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.security_rounded, size: 14, color: Color(0xFF22C55E)),
                    SizedBox(width: 6),
                    Text('Stored on-device • No cloud upload', style: TextStyle(fontSize: 11, color: Color(0xFF22C55E))),
                  ],
                ),
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
    _controller?.dispose();
    _detectionService.dispose();
    _embeddingStore.dispose();
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
        title: const Text('Register Face', style: TextStyle(color: AppTheme.black, fontWeight: FontWeight.w800, fontSize: 18)),
        centerTitle: true,
      ),
      body: (!_isCameraInitialized || !_isModelReady)
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
                      // ArcFace badge
                      Positioned(
                        top: 12, right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.face_retouching_natural, color: Colors.white70, size: 12),
                              SizedBox(width: 4),
                              Text('ArcFace On-Device', style: TextStyle(color: Colors.white70, fontSize: 10)),
                            ],
                          ),
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
                            _isCapturing ? 'Processing...' : 'Capture & Enroll',
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _isCapturing ? Colors.grey.shade300 : AppTheme.orange,
                            elevation: _isCapturing ? 0 : 4,
                            shadowColor: AppTheme.orange.withOpacity(0.4),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: _isCapturing ? null : _captureAndEnroll,
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

// ── Oval Face Guide ───────────────────────────────────────────────────────────
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
