import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io' show Platform;

import '../../face_recognition/face_detector.dart';
import '../../face_recognition/face_matcher.dart';
import '../../face_recognition/embedding_store.dart';
import '../../core/constants.dart';
import '../../services/api_service.dart';
import '../../models/attendance_payload.dart';
import '../../providers/auth_provider.dart';
import 'loading_overlay.dart';

class CameraPreviewWidget extends StatefulWidget {
  const CameraPreviewWidget({Key? key}) : super(key: key);

  @override
  State<CameraPreviewWidget> createState() => _CameraPreviewWidgetState();
}

enum FaceMatchState { idle, success, duplicate, unknown }

class _CameraPreviewWidgetState extends State<CameraPreviewWidget> {
  CameraController? _controller;
  CameraDescription? _camera;

  late final FaceDetectionService _detectionService;
  late final EmbeddingStore _embeddingStore;
  late final FaceMatcher _matcher;
  final ApiService _apiService = ApiService();
  final AudioPlayer _audioPlayer = AudioPlayer();

  // Recognition state
  bool _isRecognizing = false;
  bool _isInitialized = false;
  FaceMatchState _matchState = FaceMatchState.idle;
  String? _matchedName;
  Timer? _recognitionTimer;
  Timer? _successDisplayTimer;

  // Local attendance cache — loginId → {name, time}
  final Map<String, _MarkedEntry> _markedFaces = {};

  String? _cameraInitError;
  bool _cameraReady = false;
  int _enrolledCount = 0;

  @override
  void initState() {
    super.initState();
    _detectionService = FaceDetectionService();
    _embeddingStore = EmbeddingStore();
    _matcher = FaceMatcher(_embeddingStore);
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      // Initialize face detection + ArcFace model
      await _embeddingStore.initialize();
      await _detectionService.initialize();
      _enrolledCount = await _embeddingStore.count();
      await _matcher.refreshCache();

      _isInitialized = true;
      if (mounted) setState(() {});

      // Initialize camera
      await _initCamera();
    } catch (e) {
      if (mounted) setState(() => _cameraInitError = 'Initialization error: $e');
    }
  }

  Future<void> _initCamera() async {
    try {
      await Permission.camera.request();
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _cameraInitError = 'No cameras found.');
        return;
      }

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
      if (!mounted) return;
      setState(() => _cameraReady = true);

      // Start periodic recognition
      _recognitionTimer = Timer.periodic(
        const Duration(milliseconds: AppConstants.faceRecognitionIntervalMs),
        (_) => _runRecognition(),
      );
    } catch (e) {
      if (mounted) setState(() => _cameraInitError = 'Camera error: $e');
    }
  }

  Future<void> _runRecognition() async {
    if (_isRecognizing || !_cameraReady || !_isInitialized || _controller == null || _camera == null) return;
    if (_matchState == FaceMatchState.success || _matchState == FaceMatchState.duplicate) return;

    _isRecognizing = true;

    try {
      // Capture a frame
      final XFile file = await _controller!.takePicture();
      final bytes = await file.readAsBytes();

      // Detect face and extract embedding via ML Kit + ArcFace
      final inputImage = InputImage.fromFilePath(file.path);
      // Use the detection service's captureAndEmbed for high quality
      // But for streaming, we use a simpler approach with takePicture
      
      // Detect faces in the captured image
      final img_lib = await _loadImageFromBytes(bytes);
      if (img_lib == null) return;

      // For streaming recognition, use takePicture → detect → embed → match
      final enrollResult = await _detectionService.captureAndEmbed(_controller!);
      if (enrollResult == null || !enrollResult.isSuccess || enrollResult.embedding == null) {
        // No face or error — show unknown if not showing another state
        if (_matchState != FaceMatchState.success && _matchState != FaceMatchState.duplicate) {
          if (mounted) setState(() {
            _matchState = FaceMatchState.unknown;
            _matchedName = null;
          });
        }
        return;
      }

      // Match against enrolled faces locally
      final result = await _matcher.match(enrollResult.embedding!);
      if (!mounted) return;

      if (result.matched && result.loginId != null) {
        final now = DateTime.now();

        // Check local dedup cache
        final existing = _markedFaces[result.loginId!];
        if (existing != null) {
          final elapsed = now.difference(existing.time);
          if (elapsed.inMinutes < AppConstants.attendanceWindowMinutes) {
            // Already marked this shift
            setState(() {
              _matchState = FaceMatchState.duplicate;
              _matchedName = result.name;
            });
            HapticFeedback.vibrate();
            _successDisplayTimer?.cancel();
            _successDisplayTimer = Timer(const Duration(seconds: 3), () {
              if (mounted) setState(() => _matchState = FaceMatchState.idle);
            });
            _showDuplicateSnackbar(result);
            return;
          }
        }

        // ── FIRST VALID MATCH — Mark attendance ────────────────────────
        _markedFaces[result.loginId!] = _MarkedEntry(
          name: result.name ?? 'Unknown',
          time: now,
        );

        setState(() {
          _matchState = FaceMatchState.success;
          _matchedName = result.name;
        });

        _successDisplayTimer?.cancel();
        _successDisplayTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _matchState = FaceMatchState.idle);
        });

        // Sound + haptics
        unawaited(_audioPlayer.setVolume(1.0));
        unawaited(_audioPlayer.play(AssetSource('sounds/success.wav')));
        HapticFeedback.heavyImpact();
        Future.delayed(const Duration(milliseconds: 200), () => HapticFeedback.heavyImpact());

        _showMatchSnackbar(result);

        // Sync attendance to backend (fire-and-forget)
        final auth = Provider.of<AuthProvider>(context, listen: false);
        final routeId = auth.user?.routeId ?? AppConstants.defaultRouteId;
        _apiService.postAttendance(AttendancePayload(
          data: AttendanceData(
            studentId: result.loginId!,
            loginId: result.loginId!,
            name: result.name ?? 'Unknown',
            feeStatus: result.feeStatus ?? 'unpaid',
            confidence: result.confidence ?? 0,
            checkInTime: now.toIso8601String(),
            routeId: routeId,
          ),
        ));
      } else {
        if (_matchState != FaceMatchState.success && _matchState != FaceMatchState.duplicate) {
          setState(() {
            _matchState = FaceMatchState.unknown;
            _matchedName = null;
          });
        }
      }
    } catch (e) {
      debugPrint('[CameraPreviewWidget] recognition error: $e');
    } finally {
      _isRecognizing = false;
    }
  }

  // Placeholder for image loading — not actually needed since we use captureAndEmbed
  Future<dynamic> _loadImageFromBytes(dynamic bytes) async => true;

  void _showMatchSnackbar(MatchResult result) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.name ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                  ),
                  Text(
                    'Boarding recorded • ${result.confidence?.toStringAsFixed(1)}% match • ${result.feeStatus == "paid" ? "✓ Fee Paid" : "⚠ Fee Pending"}',
                    style: const TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showDuplicateSnackbar(MatchResult result) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.black87),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.name ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.black87),
                  ),
                  const Text(
                    'Already marked this shift. Next scan after 3 hours.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFFFBBF24),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  void dispose() {
    _recognitionTimer?.cancel();
    _successDisplayTimer?.cancel();
    _controller?.dispose();
    _detectionService.dispose();
    _embeddingStore.dispose();
    super.dispose();
  }

  ScanState get _scanState {
    switch (_matchState) {
      case FaceMatchState.success:   return ScanState.success;
      case FaceMatchState.duplicate: return ScanState.duplicate;
      case FaceMatchState.unknown:   return ScanState.unknown;
      case FaceMatchState.idle:      return ScanState.scanning;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_cameraInitError != null) {
      return ColoredBox(
        color: Colors.white,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.camera_alt_outlined, size: 56, color: Color(0xFFFF6B00)),
                const SizedBox(height: 16),
                Text(_cameraInitError!, style: const TextStyle(color: Color(0xFF1A1A1A), fontSize: 15), textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      );
    }

    if (_controller == null || !_controller!.value.isInitialized || !_isInitialized) {
      return const ColoredBox(
        color: Colors.white,
        child: Center(child: BusSarthiLoader(size: 80, label: 'Loading ArcFace Model')),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        CameraPreview(_controller!),

        // Face scan overlay
        Center(
          child: FaceScanOverlay(state: _scanState, label: _matchedName),
        ),

        // Enrolled faces count badge
        Positioned(
          top: 12, right: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$_enrolledCount faces enrolled',
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ),
        ),

        // Success badge
        if (_matchState == FaceMatchState.success && _matchedName != null)
          Positioned(
            bottom: 16, left: 20, right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xCC16A34A),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.face_retouching_natural, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'ArcFace • Attendance Marked',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),

        // Duplicate badge
        if (_matchState == FaceMatchState.duplicate && _matchedName != null)
          Positioned(
            bottom: 16, left: 20, right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xCCFBBF24),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.info_outline_rounded, color: Colors.black87, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Already Marked • $_matchedName',
                    style: const TextStyle(color: Colors.black87, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Simple data class to hold a locally cached marked entry.
class _MarkedEntry {
  final String name;
  final DateTime time;
  const _MarkedEntry({required this.name, required this.time});
}
