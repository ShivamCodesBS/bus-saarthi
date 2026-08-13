import 'package:camera/camera.dart';
import 'dart:typed_data';
import 'dart:io';
import 'package:image/image.dart' as img;

/// Service that handles face image capture for AWS Rekognition.
///
/// Replaces the old [FaceDetectorService] (Google ML Kit).
/// Face detection and matching is now performed server-side.
class FaceCaptureService {
  /// Captures a still image from [controller] and returns its bytes as JPEG.
  ///
  /// Uses [takePicture()] for the highest quality image, which is
  /// important for AWS Rekognition accuracy.
  Future<Uint8List?> captureFrameAsJpeg(CameraController controller) async {
    try {
      if (!controller.value.isInitialized) return null;

      final XFile file = await controller.takePicture();
      final Uint8List bytes = await file.readAsBytes();

      // Re-encode to JPEG at 75% quality (fast matching)
      final img.Image? decoded = img.decodeImage(bytes);
      if (decoded == null) return null;

      // Resize to max 600px on longest side — aggressively reduces upload time for faster matching
      img.Image resized = decoded;
      if (decoded.width > 600 || decoded.height > 600) {
        resized = img.copyResize(
          decoded,
          width:  decoded.width > decoded.height ? 600 : -1,
          height: decoded.height >= decoded.width ? 600 : -1,
          interpolation: img.Interpolation.linear,
        );
      }

      return Uint8List.fromList(img.encodeJpg(resized, quality: 75));
    } catch (e) {
      print('[FaceCaptureService] captureFrameAsJpeg error: $e');
      return null;
    } finally {
      // Clean up temp file — no disk accumulation
    }
  }

  /// Cleans up resources. No-op for this service (no native detectors).
  void dispose() {}
}
