import 'dart:typed_data';
import 'dart:math';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

/// ArcFace / MobileFaceNet on-device inference service.
///
/// Loads a MobileFaceNet TFLite model and extracts 192-dimensional
/// face embeddings from cropped face images.
///
/// Model expects: 112×112 RGB float32 input normalized to [-1, 1]
/// Model outputs: 192-dim float32 embedding vector
class ArcFaceService {
  static const String _modelPath = 'assets/models/mobilefacenet.tflite';
  static const int inputSize = 112;
  static const int embeddingSize = 192;

  Interpreter? _interpreter;
  bool _isReady = false;

  bool get isReady => _isReady;

  /// Load the TFLite model. Call once at app startup.
  Future<void> initialize() async {
    try {
      _interpreter = await Interpreter.fromAsset(_modelPath);
      _isReady = true;
      print('[ArcFace] Model loaded successfully');
    } catch (e) {
      _isReady = false;
      print('[ArcFace] Failed to load model: $e');
      rethrow;
    }
  }

  /// Extract a 192-dim embedding from a cropped face image (JPEG bytes).
  ///
  /// The image should be tightly cropped around the face.
  /// Returns null if the model isn't ready or processing fails.
  List<double>? getEmbedding(Uint8List faceImageBytes) {
    if (!_isReady || _interpreter == null) return null;

    try {
      // Decode image
      final img.Image? decoded = img.decodeImage(faceImageBytes);
      if (decoded == null) return null;

      // Resize to model input size (112×112)
      final img.Image resized = img.copyResize(
        decoded,
        width: inputSize,
        height: inputSize,
        interpolation: img.Interpolation.linear,
      );

      // Convert to float32 tensor normalized to [-1, 1]
      final input = _imageToFloat32Tensor(resized);

      // Prepare output buffer
      final output = List.filled(embeddingSize, 0.0).reshape([1, embeddingSize]);

      // Run inference
      _interpreter!.run(input, output);

      // Extract and L2-normalize the embedding
      final List<double> embedding = List<double>.from(output[0]);
      return _l2Normalize(embedding);
    } catch (e) {
      print('[ArcFace] Embedding extraction failed: $e');
      return null;
    }
  }

  /// Extract embedding from an already-decoded [img.Image].
  List<double>? getEmbeddingFromImage(img.Image faceImage) {
    if (!_isReady || _interpreter == null) return null;

    try {
      final img.Image resized = img.copyResize(
        faceImage,
        width: inputSize,
        height: inputSize,
        interpolation: img.Interpolation.linear,
      );

      final input = _imageToFloat32Tensor(resized);
      final output = List.filled(embeddingSize, 0.0).reshape([1, embeddingSize]);
      _interpreter!.run(input, output);

      final List<double> embedding = List<double>.from(output[0]);
      return _l2Normalize(embedding);
    } catch (e) {
      print('[ArcFace] Embedding extraction failed: $e');
      return null;
    }
  }

  /// Compute cosine similarity between two embeddings.
  /// Returns a value between -1 and 1, where 1 means identical.
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

  /// Convert an [img.Image] to a [1, 112, 112, 3] float32 tensor.
  /// Pixel values are normalized from [0, 255] to [-1, 1].
  List<List<List<List<double>>>> _imageToFloat32Tensor(img.Image image) {
    return List.generate(1, (_) {
      return List.generate(inputSize, (y) {
        return List.generate(inputSize, (x) {
          final pixel = image.getPixel(x, y);
          return [
            (pixel.r.toDouble() - 127.5) / 127.5,
            (pixel.g.toDouble() - 127.5) / 127.5,
            (pixel.b.toDouble() - 127.5) / 127.5,
          ];
        });
      });
    });
  }

  /// L2-normalize an embedding vector (unit length).
  List<double> _l2Normalize(List<double> vec) {
    double norm = 0;
    for (final v in vec) {
      norm += v * v;
    }
    norm = sqrt(norm);
    if (norm == 0) return vec;
    return vec.map((v) => v / norm).toList();
  }

  void dispose() {
    _interpreter?.close();
    _interpreter = null;
    _isReady = false;
  }
}
