import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io' show Platform;
import 'dart:typed_data';

import '../../face_recognition/face_detector.dart';
import '../../face_recognition/face_matcher.dart';
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

  final FaceCaptureService _captureService = FaceCaptureService();
  final ApiService _apiService = ApiService();
  final AudioPlayer _audioPlayer = AudioPlayer();

  // Recognition state
  bool _isRecognizing = false;
  FaceMatchState _matchState = FaceMatchState.idle;
  String? _matchedName;
  Timer? _recognitionTimer;
  Timer? _successDisplayTimer;

  // ── Local attendance cache ────────────────────────────────────────────────
  // Stores loginId → {name, time} for faces already marked THIS session.
  // Used to give INSTANT "Already Marked" feedback without hitting the API.
  final Map<String, _MarkedEntry> _markedFaces = {};

  // Throttle: prevent calling the expensive AWS API for the exact same face
  // repeatedly. After a face is identified, we skip API calls for this face
  // for the throttle window, but STILL show "Already Marked" from the local cache.
  String? _lastScannedLoginId;
  DateTime? _lastScannedTime;

  String? _cameraInitError;
  bool _cameraReady = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      await Permission.camera.request();
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _cameraInitError = 'No cameras found.');
        return;
      }

      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _controller = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.nv21
            : ImageFormatGroup.bgra8888,
      );

      await _controller!.initialize();
      if (!mounted) return;
      setState(() => _cameraReady = true);

      // Start periodic recognition every 3 seconds
      _recognitionTimer = Timer.periodic(
        const Duration(milliseconds: AppConstants.faceRecognitionIntervalMs),
        (_) => _runRecognition(),
      );
    } catch (e) {
      if (mounted) setState(() => _cameraInitError = 'Camera error: $e');
    }
  }

  Future<void> _runRecognition() async {
    if (_isRecognizing || !_cameraReady || _controller == null) return;
    
    // Pause recognition while displaying success or duplicate messages to prevent API spam
    if (_matchState == FaceMatchState.success || _matchState == FaceMatchState.duplicate) {
      return;
    }
    
    _isRecognizing = true;

    try {
      // Capture JPEG frame
      final Uint8List? imageBytes = await _captureService.captureFrameAsJpeg(_controller!);
      if (imageBytes == null) return;

      if (!mounted) return;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final routeId = auth.user?.routeId ?? AppConstants.defaultRouteId;
      final now = DateTime.now();

      // ── CALL BACKEND → AWS Rekognition ────────────────────────────────
      final result = await _apiService.recognizeFace(imageBytes, routeId: routeId);
      if (!mounted) return;

      if (result.matched && result.loginId != null) {
        // Update throttle tracking
        _lastScannedLoginId = result.loginId;
        _lastScannedTime = DateTime.now(); // Use fresh time after API call

        if (result.isCooldown || result.isLimitReached) {
          // ── ALREADY MARKED (from backend) ───────────────────────────────
          // Also add to local cache so subsequent scans don't hit API
          _markedFaces[result.loginId!] = _MarkedEntry(
            name: result.name ?? 'Unknown',
            time: DateTime.now(),
          );

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

        } else {
          // ── FIRST VALID MATCH — Attendance auto-saved by backend ────────
          // Add to local cache immediately
          _markedFaces[result.loginId!] = _MarkedEntry(
            name: result.name ?? 'Unknown',
            time: DateTime.now(),
          );

          setState(() {
            _matchState = FaceMatchState.success;
            _matchedName = result.name;
          });

          // Show green for 3 seconds
          _successDisplayTimer?.cancel();
          _successDisplayTimer = Timer(const Duration(seconds: 3), () {
            if (mounted) setState(() => _matchState = FaceMatchState.idle);
          });

          // Loud beep: audio + heavy vibration
          unawaited(_audioPlayer.setVolume(1.0));
          unawaited(_audioPlayer.play(AssetSource('sounds/success.wav')));
          HapticFeedback.heavyImpact();
          Future.delayed(const Duration(milliseconds: 200), () => HapticFeedback.heavyImpact());

          _showMatchSnackbar(result);
        }
      } else {
        // No face matched — only update UI if not currently showing a result
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

  void _showMatchSnackbar(RecognitionResult result) {
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

  void _showDuplicateSnackbar(RecognitionResult result) {
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
                  Text(
                    result.isLimitReached
                        ? 'Limit of 2 scans per day reached.'
                        : 'Already marked this shift. Next scan after 3 hours.',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFFFBBF24), // Yellow warning
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
    _controller?.stopImageStream();
    _controller?.dispose();
    _captureService.dispose();
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

    if (_controller == null || !_controller!.value.isInitialized) {
      return const ColoredBox(
        color: Colors.white,
        child: Center(child: BusSarthiLoader(size: 80, label: 'Initializing Camera')),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera feed
        CameraPreview(_controller!),

        // Face scan overlay
        Center(
          child: FaceScanOverlay(state: _scanState, label: _matchedName),
        ),

        // Confidence badge (shown when matched)
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
                  Icon(Icons.cloud_done_rounded, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'AWS Rekognition • Attendance Marked',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),

        // Already-marked badge (shown when duplicate)
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
