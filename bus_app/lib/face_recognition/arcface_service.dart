import 'dart:typed_data';
import 'dart:math';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';
import 'recognition_config.dart';

/// ArcFace / MobileFaceNet on-device inference service.
class ArcFaceService {
  Interpreter? _interpreter;
  bool _isInitialized = false;

  final int _inputSize = RecognitionConfig.modelInputSize;
  final int _embeddingSize = RecognitionConfig.embeddingDimension;

  int _lastInferenceTimeMs = 0;
  int get lastInferenceTimeMs => _lastInferenceTimeMs;

  bool get isReady => _isInitialized;

  Future<void> initialize() async {
    if (_isInitialized) return;
    try {
      final options = InterpreterOptions();
      options.threads = 4;
      // options.addDelegate(NnApiDelegate()); // Uncomment if testing on Android

      _interpreter = await Interpreter.fromAsset(
        RecognitionConfig.modelPath,
        options: options,
      );
      _isInitialized = true;
      print('[ArcFaceService] Model loaded successfully: ${RecognitionConfig.modelPath}');
    } catch (e) {
      print('[ArcFaceService] Error loading model: $e');
      rethrow;
    }
  }

  /// Extracts embedding from an already-aligned 112x112 image
  Future<List<double>?> getEmbeddingFromAlignedImage(img.Image image) async {
    if (!_isInitialized || _interpreter == null) return null;

    final watch = Stopwatch()..start();

    final input = _imageToFloat32Tensor(image);
    final output = List.filled(_embeddingSize, 0.0).reshape([1, _embeddingSize]);

    try {
      _interpreter!.run(input, output);
    } catch (e) {
      print('[ArcFaceService] Inference error: $e');
      return null;
    }

    watch.stop();
    _lastInferenceTimeMs = watch.elapsedMilliseconds;

    List<double> embedding = List<double>.from(output[0]);

    if (embedding.any((v) => v.isNaN || v.isInfinite)) {
      print('[ArcFaceService] Invalid embedding generated (NaN or Infinity)');
      return null;
    }

    return _l2Normalize(embedding);
  }

  /// Legacy method for raw image bytes (fallback)
  Future<List<double>?> getEmbedding(Uint8List faceImageBytes) async {
    if (!_isInitialized || _interpreter == null) return null;

    final decoded = img.decodeImage(faceImageBytes);
    if (decoded == null) return null;

    final resized = img.copyResize(
      decoded,
      width: _inputSize,
      height: _inputSize,
      interpolation: img.Interpolation.linear,
    );

    return getEmbeddingFromAlignedImage(resized);
  }

  List<List<List<List<double>>>> _imageToFloat32Tensor(img.Image image) {
    return List.generate(1, (_) {
      return List.generate(_inputSize, (y) {
        return List.generate(_inputSize, (x) {
          final pixel = image.getPixel(x, y);
          return [
            (pixel.r.toDouble() - 127.5) / 128.0,
            (pixel.g.toDouble() - 127.5) / 128.0,
            (pixel.b.toDouble() - 127.5) / 128.0,
          ];
        });
      });
    });
  }

  List<double> _l2Normalize(List<double> vec) {
    double norm = 0;
    for (final v in vec) {
      norm += v * v;
    }
    norm = sqrt(norm);
    if (norm == 0) return vec;
    return vec.map((v) => v / norm).toList();
  }

  static double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length) return -1;

    double dotProduct = 0;
    double normA = 0;
    double normB = 0;

    for (int i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA == 0 || normB == 0) return 0;
    return dotProduct / (sqrt(normA) * sqrt(normB));
  }

  void dispose() {
    _interpreter?.close();
    _interpreter = null;
    _isInitialized = false;
  }
}
