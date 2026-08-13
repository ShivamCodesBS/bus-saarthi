import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'dart:io' show Platform;
import 'dart:ui' as ui;

import 'arcface_service.dart';

/// Face detection + ArcFace embedding extraction service.
///
/// Pipeline:
/// 1. Google ML Kit detects face bounding boxes in camera frames
/// 2. Face is cropped from the original image
/// 3. ArcFace model extracts a 192-dim embedding from the crop
class FaceDetectionService {
  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.fast,
      enableLandmarks: true,
      enableClassification: true, // For blink detection (liveness)
      minFaceSize: 0.15,
    ),
  );

  final ArcFaceService _arcFace = ArcFaceService();

  bool get isModelReady => _arcFace.isReady;

  /// Initialize ArcFace model. Call once at startup.
  Future<void> initialize() async {
    await _arcFace.initialize();
  }

  /// Detect faces in a camera frame and extract ArcFace embeddings.
  ///
  /// Returns a list of [DetectedFace] objects, each with the bounding box,
  /// landmark info, classification (eye open probability), and the 192-dim embedding.
  ///
  /// For recognition, typically only the first (largest) face is used.
  Future<List<DetectedFace>> detectAndEmbed(CameraImage cameraImage, CameraDescription camera) async {
    final inputImage = _cameraImageToInputImage(cameraImage, camera);
    if (inputImage == null) return [];

    final faces = await _faceDetector.processImage(inputImage);
    if (faces.isEmpty) return [];

    // Decode the camera frame to img.Image for cropping
    final img.Image? fullImage = _cameraImageToImgImage(cameraImage);
    if (fullImage == null) return [];

    final results = <DetectedFace>[];

    for (final face in faces) {
      // Crop the face region (with padding)
      final crop = _cropFace(fullImage, face.boundingBox, cameraImage.width, cameraImage.height);
      if (crop == null) continue;

      // Extract ArcFace embedding
      final embedding = _arcFace.getEmbeddingFromImage(crop);

      results.add(DetectedFace(
        boundingBox: face.boundingBox,
        leftEyeOpenProbability: face.leftEyeOpenProbability,
        rightEyeOpenProbability: face.rightEyeOpenProbability,
        headEulerAngleY: face.headEulerAngleY,
        headEulerAngleZ: face.headEulerAngleZ,
        embedding: embedding,
      ));
    }

    return results;
  }

  /// Capture a high-quality image and extract embedding (for enrollment).
  ///
  /// Uses [takePicture()] for maximum quality instead of streaming frames.
  Future<EnrollmentResult?> captureAndEmbed(CameraController controller) async {
    if (!controller.value.isInitialized || !_arcFace.isReady) return null;

    try {
      final XFile file = await controller.takePicture();
      final Uint8List bytes = await file.readAsBytes();

      // Decode
      final img.Image? decoded = img.decodeImage(bytes);
      if (decoded == null) return null;

      // Detect face using ML Kit
      final inputImage = InputImage.fromFilePath(file.path);
      final faces = await _faceDetector.processImage(inputImage);
      if (faces.isEmpty) return EnrollmentResult(error: 'No face detected. Please face the camera directly.');
      if (faces.length > 1) return EnrollmentResult(error: '${faces.length} faces detected. Only one person should be in frame.');

      final face = faces.first;

      // Quality checks
      if (face.headEulerAngleY != null && face.headEulerAngleY!.abs() > 30) {
        return EnrollmentResult(error: 'Face is turned too far sideways. Please look straight at the camera.');
      }

      // Crop face
      final crop = _cropFace(decoded, face.boundingBox, decoded.width, decoded.height);
      if (crop == null) return EnrollmentResult(error: 'Could not crop face region.');

      // Extract embedding
      final embedding = _arcFace.getEmbeddingFromImage(crop);
      if (embedding == null) return EnrollmentResult(error: 'Could not extract face features. Please try again.');

      // Create JPEG thumbnail for display
      final thumbnail = Uint8List.fromList(img.encodeJpg(
        img.copyResize(crop, width: 150),
        quality: 85,
      ));

      return EnrollmentResult(
        embedding: embedding,
        thumbnail: thumbnail,
      );
    } catch (e) {
      return EnrollmentResult(error: 'Capture failed: $e');
    }
  }

  /// Crop a face from the image with 20% padding around the bounding box.
  img.Image? _cropFace(img.Image image, ui.Rect bbox, int sourceWidth, int sourceHeight) {
    // Scale bounding box to image dimensions
    final scaleX = image.width / sourceWidth;
    final scaleY = image.height / sourceHeight;

    final int x = (bbox.left * scaleX).round();
    final int y = (bbox.top * scaleY).round();
    final int w = (bbox.width * scaleX).round();
    final int h = (bbox.height * scaleY).round();

    // Add 20% padding
    final pad = (w * 0.2).round();
    final int cx = (x - pad).clamp(0, image.width - 1);
    final int cy = (y - pad).clamp(0, image.height - 1);
    final int cw = (w + pad * 2).clamp(1, image.width - cx);
    final int ch = (h + pad * 2).clamp(1, image.height - cy);

    if (cw < 20 || ch < 20) return null;

    return img.copyCrop(image, x: cx, y: cy, width: cw, height: ch);
  }

  /// Convert CameraImage to ML Kit InputImage.
  InputImage? _cameraImageToInputImage(CameraImage image, CameraDescription camera) {
    final rotation = _rotationFromSensorOrientation(camera.sensorOrientation);

    if (Platform.isAndroid) {
      final format = InputImageFormatValue.fromRawValue(image.format.raw);
      if (format == null) return null;

      return InputImage.fromBytes(
        bytes: image.planes[0].bytes,
        metadata: InputImageMetadata(
          size: ui.Size(image.width.toDouble(), image.height.toDouble()),
          rotation: rotation,
          format: format,
          bytesPerRow: image.planes[0].bytesPerRow,
        ),
      );
    } else if (Platform.isIOS) {
      return InputImage.fromBytes(
        bytes: image.planes[0].bytes,
        metadata: InputImageMetadata(
          size: ui.Size(image.width.toDouble(), image.height.toDouble()),
          rotation: rotation,
          format: InputImageFormat.bgra8888,
          bytesPerRow: image.planes[0].bytesPerRow,
        ),
      );
    }
    return null;
  }

  /// Convert CameraImage to img.Image for cropping.
  img.Image? _cameraImageToImgImage(CameraImage cameraImage) {
    try {
      if (Platform.isAndroid) {
        // NV21 format
        return _convertNv21ToImage(cameraImage);
      } else {
        // BGRA8888 format (iOS)
        return _convertBgraToImage(cameraImage);
      }
    } catch (e) {
      print('[FaceDetection] Image conversion error: $e');
      return null;
    }
  }

  img.Image _convertNv21ToImage(CameraImage image) {
    final int width = image.width;
    final int height = image.height;
    final Uint8List yPlane = image.planes[0].bytes;
    final Uint8List uvPlane = image.planes[1].bytes;
    final int uvRowStride = image.planes[1].bytesPerRow;
    final int uvPixelStride = image.planes[1].bytesPerPixel ?? 1;

    final img.Image result = img.Image(width: width, height: height);

    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        final int yValue = yPlane[y * width + x];
        final int uvIndex = uvPixelStride * (x ~/ 2) + uvRowStride * (y ~/ 2);
        final int vValue = uvPlane[uvIndex];
        final int uValue = uvPlane[uvIndex + 1];

        int r = (yValue + 1.370705 * (vValue - 128)).round().clamp(0, 255);
        int g = (yValue - 0.337633 * (uValue - 128) - 0.698001 * (vValue - 128)).round().clamp(0, 255);
        int b = (yValue + 1.732446 * (uValue - 128)).round().clamp(0, 255);

        result.setPixelRgba(x, y, r, g, b, 255);
      }
    }
    return result;
  }

  img.Image _convertBgraToImage(CameraImage image) {
    final int width = image.width;
    final int height = image.height;
    final Uint8List bytes = image.planes[0].bytes;

    final img.Image result = img.Image(width: width, height: height);

    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        final int i = (y * width + x) * 4;
        result.setPixelRgba(x, y, bytes[i + 2], bytes[i + 1], bytes[i], bytes[i + 3]);
      }
    }
    return result;
  }

  InputImageRotation _rotationFromSensorOrientation(int sensorOrientation) {
    switch (sensorOrientation) {
      case 0:   return InputImageRotation.rotation0deg;
      case 90:  return InputImageRotation.rotation90deg;
      case 180: return InputImageRotation.rotation180deg;
      case 270: return InputImageRotation.rotation270deg;
      default:  return InputImageRotation.rotation0deg;
    }
  }

  void dispose() {
    _faceDetector.close();
    _arcFace.dispose();
  }
}

/// Result of a face detection: bounding box, eye/head info, and ArcFace embedding.
class DetectedFace {
  final ui.Rect boundingBox;
  final double? leftEyeOpenProbability;
  final double? rightEyeOpenProbability;
  final double? headEulerAngleY;
  final double? headEulerAngleZ;
  final List<double>? embedding;

  const DetectedFace({
    required this.boundingBox,
    this.leftEyeOpenProbability,
    this.rightEyeOpenProbability,
    this.headEulerAngleY,
    this.headEulerAngleZ,
    this.embedding,
  });

  bool get hasEmbedding => embedding != null && embedding!.isNotEmpty;
}

/// Result of an enrollment capture.
class EnrollmentResult {
  final List<double>? embedding;
  final Uint8List? thumbnail;
  final String? error;

  const EnrollmentResult({this.embedding, this.thumbnail, this.error});

  bool get isSuccess => embedding != null && error == null;
}
