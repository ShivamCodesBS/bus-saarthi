import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io' show Platform;

import '../../face_recognition/recognition_pipeline.dart';
import '../../face_recognition/performance_telemetry.dart';
import '../../core/constants.dart';
import '../../models/attendance_payload.dart';
import '../../providers/auth_provider.dart';
import '../../providers/attendance_provider.dart';
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

  late final RecognitionPipeline _pipeline;
  StreamSubscription? _pipelineSub;
  final AudioPlayer _audioPlayer = AudioPlayer();

  // Recognition state
  bool _isInitialized = false;
  FaceMatchState _matchState = FaceMatchState.idle;
  String? _matchedName;
  Timer? _successDisplayTimer;
  
  TelemetryData? _latestTelemetry;

  String? _cameraInitError;
  bool _cameraReady = false;

  @override
  void initState() {
    super.initState();
    _pipeline = RecognitionPipeline();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _pipeline.initialize();

      // Listen to pipeline events
      _pipelineSub = _pipeline.events.listen(_onPipelineEvent);

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

      // Start streaming frames directly to pipeline
      await _controller!.startImageStream((CameraImage image) {
        _pipeline.processFrame(image, _camera!);
      });
    } catch (e) {
      if (mounted) setState(() => _cameraInitError = 'Camera error: $e');
    }
  }

  void _onPipelineEvent(RecognitionEvent event) {
    if (!mounted) return;

    if (event is AttendanceMarkedEvent) {
      _handleAttendanceMarked(event);
    } else if (event is DuplicateAttendanceEvent) {
      _handleDuplicate(event);
    } else if (event is UnknownFaceEvent) {
      if (_matchState != FaceMatchState.success && _matchState != FaceMatchState.duplicate) {
        setState(() {
          _matchState = FaceMatchState.unknown;
          _matchedName = null;
        });
      }
    } else if (event is TelemetryEvent) {
      setState(() {
        _latestTelemetry = event.data;
      });
    } else if (event is MatchProgressEvent) {
      // Could show a progress indicator for weak matches if desired
    }
  }

  void _handleAttendanceMarked(AttendanceMarkedEvent event) {
    setState(() {
      _matchState = FaceMatchState.success;
      _matchedName = event.name;
    });

    _resetStateAfterDelay();
    _playSuccessSound();
    _showMatchSnackbar(event);

    // Sync via provider
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final routeId = auth.user?.routeId ?? AppConstants.defaultRouteId;
    
    final record = AttendanceRecord(
      passengerId: event.studentId,
      name: event.name,
      confidence: event.confidence,
      timestamp: DateTime.now().toIso8601String(),
    );
    
    Provider.of<AttendanceProvider>(context, listen: false).addAttendance(record, routeId);
  }

  void _handleDuplicate(DuplicateAttendanceEvent event) {
    setState(() {
      _matchState = FaceMatchState.duplicate;
      _matchedName = event.name;
    });
    
    _resetStateAfterDelay();
    HapticFeedback.vibrate();
    _showDuplicateSnackbar(event);
  }

  void _resetStateAfterDelay() {
    _successDisplayTimer?.cancel();
    _successDisplayTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _matchState = FaceMatchState.idle);
    });
  }

  void _playSuccessSound() {
    unawaited(_audioPlayer.setVolume(1.0));
    unawaited(_audioPlayer.play(AssetSource('sounds/success.wav')));
    HapticFeedback.heavyImpact();
    Future.delayed(const Duration(milliseconds: 200), () => HapticFeedback.heavyImpact());
  }

  void _showMatchSnackbar(AttendanceMarkedEvent result) {
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
                    result.name,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                  ),
                  Text(
                    'Boarding recorded • ${(result.confidence * 100).toStringAsFixed(1)}% match',
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

  void _showDuplicateSnackbar(DuplicateAttendanceEvent result) {
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
                    result.name,
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
    _successDisplayTimer?.cancel();
    _pipelineSub?.cancel();
    _pipeline.dispose();
    _controller?.stopImageStream();
    _controller?.dispose();
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
        child: Center(child: BusSarthiLoader(size: 80, label: 'Loading Realtime Pipeline')),
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

        // Debug Telemetry Overlay
        if (_latestTelemetry != null)
          Positioned(
            top: 12, right: 12,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('FPS: ${_latestTelemetry!.cameraFps.toStringAsFixed(1)}', style: const TextStyle(color: Colors.white, fontSize: 10)),
                  Text('Detect avg: ${_latestTelemetry!.avgDetectionMs.toStringAsFixed(1)}ms', style: const TextStyle(color: Colors.white, fontSize: 10)),
                  Text('Infer p50: ${_latestTelemetry!.p50InferenceMs.toStringAsFixed(1)}ms', style: const TextStyle(color: Colors.white, fontSize: 10)),
                  Text('Infer p95: ${_latestTelemetry!.p95InferenceMs.toStringAsFixed(1)}ms', style: const TextStyle(color: Colors.white, fontSize: 10)),
                  Text('Tracks: ${_latestTelemetry!.activeTracks}', style: const TextStyle(color: Colors.white, fontSize: 10)),
                ],
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
                    'ArcFace Realtime • Marked',
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
