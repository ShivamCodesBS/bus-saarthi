import 'dart:async';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'dart:io' show Platform;

import '../face_recognition/recognition_pipeline.dart';
import '../face_recognition/performance_telemetry.dart';
import '../face_recognition/face_matcher.dart';
import '../core/theme.dart';
import 'widgets/loading_overlay.dart';

class BenchmarkScreen extends StatefulWidget {
  const BenchmarkScreen({Key? key}) : super(key: key);

  @override
  State<BenchmarkScreen> createState() => _BenchmarkScreenState();
}

class _BenchmarkScreenState extends State<BenchmarkScreen> {
  CameraController? _controller;
  CameraDescription? _camera;
  
  late final RecognitionPipeline _pipeline;
  StreamSubscription? _pipelineSub;
  
  String? _cameraInitError;
  bool _isInitialized = false;

  // Benchmark stats
  int _totalFrames = 0;
  int _matches = 0;
  int _uncertains = 0;
  int _unknowns = 0;
  double _lastSimilarity = 0.0;
  String _lastMatchName = "None";

  @override
  void initState() {
    super.initState();
    _pipeline = RecognitionPipeline();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _pipeline.initialize();
      _pipelineSub = _pipeline.events.listen(_onPipelineEvent);

      final cameras = await availableCameras();
      _camera = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.front, orElse: () => cameras.first);

      _controller = CameraController(
        _camera!,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );

      await _controller!.initialize();
      
      _controller!.startImageStream((CameraImage image) {
        _pipeline.processFrame(image, _camera!);
      });

      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      if (mounted) setState(() => _cameraInitError = 'Error: $e');
    }
  }

  void _onPipelineEvent(RecognitionEvent event) {
    if (!mounted) return;

    if (event is AttendanceMarkedEvent) {
      setState(() {
        _totalFrames++;
        _matches++;
        _lastSimilarity = event.confidence;
        _lastMatchName = event.name;
      });
      _pipeline.clearSession(); // Allow continuous scanning for benchmark
    } else if (event is DuplicateAttendanceEvent) {
       _pipeline.clearSession(); // Allow continuous scanning for benchmark
    } else if (event is MatchProgressEvent) {
      setState(() {
        _totalFrames++;
        _uncertains++;
        _lastSimilarity = event.confidence;
        _lastMatchName = event.candidate ?? "Unknown";
      });
    } else if (event is UnknownFaceEvent) {
      setState(() {
        _totalFrames++;
        _unknowns++;
        _lastSimilarity = 0.0;
        _lastMatchName = "Unknown";
      });
    }
  }

  @override
  void dispose() {
    _pipelineSub?.cancel();
    _pipeline.dispose();
    _controller?.stopImageStream();
    _controller?.dispose();
    super.dispose();
  }

  void _resetStats() {
    setState(() {
      _totalFrames = 0;
      _matches = 0;
      _uncertains = 0;
      _unknowns = 0;
      _lastSimilarity = 0.0;
      _lastMatchName = "None";
    });
    _pipeline.clearSession();
  }

  @override
  Widget build(BuildContext context) {
    if (_cameraInitError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Benchmark Mode')),
        body: Center(child: Text(_cameraInitError!)),
      );
    }

    if (!_isInitialized) {
      return const Scaffold(
        body: Center(child: BusSarthiLoader(label: 'Loading Benchmark...')),
      );
    }

    final matchRate = _totalFrames > 0 ? (_matches / _totalFrames * 100).toStringAsFixed(1) : "0.0";
    final uncertainRate = _totalFrames > 0 ? (_uncertains / _totalFrames * 100).toStringAsFixed(1) : "0.0";
    final unknownRate = _totalFrames > 0 ? (_unknowns / _totalFrames * 100).toStringAsFixed(1) : "0.0";

    return Scaffold(
      appBar: AppBar(
        title: const Text('FAR/FRR Benchmark', style: TextStyle(color: AppTheme.black, fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.black),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _resetStats,
          )
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 1,
            child: CameraPreview(_controller!),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            color: Colors.white,
            child: Column(
              children: [
                const Text('Realtime Aggregation Results', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 10),
                Text('Last Candidate: $_lastMatchName', style: const TextStyle(fontSize: 15)),
                Text('Last Similarity: ${_lastSimilarity.toStringAsFixed(3)}', style: const TextStyle(fontSize: 15, color: Colors.blue)),
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _StatColumn('Match (TPR)', '$_matches', '$matchRate%', Colors.green),
                    _StatColumn('Uncertain', '$_uncertains', '$uncertainRate%', Colors.orange),
                    _StatColumn('Unknown (FNR)', '$_unknowns', '$unknownRate%', Colors.red),
                  ],
                ),
                const SizedBox(height: 20),
                const Text('To test False Acceptance Rate (FAR), show a face that is NOT enrolled. The Match column should stay at 0%.', 
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.black54, fontSize: 12)),
                const SizedBox(height: 10),
                const Text('To test False Rejection Rate (FRR), show an ENROLLED face. The Unknown column should stay low.', 
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.black54, fontSize: 12)),
              ],
            ),
          )
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  final String label;
  final String count;
  final String percent;
  final Color color;

  const _StatColumn(this.label, this.count, this.percent, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        Text(count, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
        Text(percent, style: const TextStyle(fontSize: 14, color: Colors.black54)),
      ],
    );
  }
}
