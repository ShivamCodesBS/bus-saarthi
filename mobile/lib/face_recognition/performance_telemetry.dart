class TelemetryData {
  final double cameraFps;
  final double avgDetectionMs;
  final double avgInferenceMs;
  final double p50InferenceMs;
  final double p95InferenceMs;
  final int activeTracks;
  final String? topCandidate;
  final double topConfidence;

  TelemetryData({
    required this.cameraFps,
    required this.avgDetectionMs,
    required this.avgInferenceMs,
    required this.p50InferenceMs,
    required this.p95InferenceMs,
    required this.activeTracks,
    this.topCandidate,
    required this.topConfidence,
  });
}

class PerformanceTelemetry {
  int _framesReceived = 0;
  DateTime _lastFpsCalcTime = DateTime.now();
  double _currentFps = 0.0;

  final List<int> _detectionLatencies = [];
  final List<int> _inferenceLatencies = [];

  void onFrameReceived() {
    _framesReceived++;
    final now = DateTime.now();
    final diff = now.difference(_lastFpsCalcTime).inMilliseconds;
    if (diff >= 1000) {
      _currentFps = (_framesReceived / diff) * 1000;
      _framesReceived = 0;
      _lastFpsCalcTime = now;
    }
  }

  void recordDetectionMs(int ms) {
    _detectionLatencies.add(ms);
    if (_detectionLatencies.length > 30) {
      _detectionLatencies.removeAt(0);
    }
  }

  void recordInferenceMs(int ms) {
    _inferenceLatencies.add(ms);
    if (_inferenceLatencies.length > 30) {
      _inferenceLatencies.removeAt(0);
    }
  }

  double get avgDetectionMs {
    if (_detectionLatencies.isEmpty) return 0.0;
    return _detectionLatencies.reduce((a, b) => a + b) / _detectionLatencies.length;
  }

  double get avgInferenceMs {
    if (_inferenceLatencies.isEmpty) return 0.0;
    return _inferenceLatencies.reduce((a, b) => a + b) / _inferenceLatencies.length;
  }
  
  double get currentFps => _currentFps;

  double get p50InferenceMs {
    if (_inferenceLatencies.isEmpty) return 0.0;
    final sorted = List<int>.from(_inferenceLatencies)..sort();
    return sorted[(sorted.length * 0.5).floor()].toDouble();
  }

  double get p95InferenceMs {
    if (_inferenceLatencies.isEmpty) return 0.0;
    final sorted = List<int>.from(_inferenceLatencies)..sort();
    return sorted[(sorted.length * 0.95).floor()].toDouble();
  }

  TelemetryData generateReport(int activeTracks, String? topCandidate, double topConfidence) {
    return TelemetryData(
      cameraFps: _currentFps,
      avgDetectionMs: avgDetectionMs,
      avgInferenceMs: avgInferenceMs,
      p50InferenceMs: p50InferenceMs,
      p95InferenceMs: p95InferenceMs,
      activeTracks: activeTracks,
      topCandidate: topCandidate,
      topConfidence: topConfidence,
    );
  }
}
