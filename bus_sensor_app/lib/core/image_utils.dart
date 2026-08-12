import 'package:camera/camera.dart';
import 'package:image/image.dart' as img;
import 'dart:math';
import 'dart:ui';

class ImageUtils {
  /// Padding factor applied to the face bounding box before cropping.
  ///
  /// FIX #5: MobileFaceNet was trained on MTCNN-aligned crops with ~25–30%
  /// padding around the face (chin, forehead, and cheeks are visible).
  /// Cropping exactly at the ML Kit bounding box produces unnaturally tight
  /// crops the model was never trained on, degrading embedding quality.
  static const double _cropPadding = 0.30;

  /// Converts a [CameraImage] to an [img.Image] cropped around the face,
  /// with [_cropPadding] applied and the bounding box mirrored for front cameras.
  ///
  /// Returns null if the image format is unsupported.
  static img.Image? convertCameraImageToImage(
    CameraImage image,
    Rect boundingBox, {
    CameraLensDirection lensDirection = CameraLensDirection.front,
  }) {
    final paddedBox = _applyPaddingAndMirror(
      boundingBox,
      image.width.toDouble(),
      image.height.toDouble(),
      lensDirection,
    );

    if (image.format.group == ImageFormatGroup.yuv420 ||
        image.format.group == ImageFormatGroup.nv21) {
      return _convertYUV420ToImage(image, paddedBox);
    } else if (image.format.group == ImageFormatGroup.bgra8888) {
      return _convertBGRA8888ToImage(image, paddedBox);
    }
    return null;
  }

  /// Applies padding + front-camera horizontal mirror to the bounding box.
  ///
  /// Returns a clamped Rect that is always within the image bounds.
  static Rect _applyPaddingAndMirror(
    Rect box,
    double imgW,
    double imgH,
    CameraLensDirection lensDirection,
  ) {
    // Step 1: Add padding proportional to box size
    final padX = box.width * _cropPadding;
    final padY = box.height * _cropPadding;

    Rect padded = Rect.fromLTRB(
      box.left - padX,
      box.top - padY,
      box.right + padX,
      box.bottom + padY,
    );

    // Step 2: Mirror X for front camera (ML Kit reports in display-mirrored
    // coordinates, but the raw frame is NOT mirrored on Android/iOS)
    if (lensDirection == CameraLensDirection.front) {
      padded = Rect.fromLTRB(
        imgW - padded.right,
        padded.top,
        imgW - padded.left,
        padded.bottom,
      );
    }

    // Step 3: Clamp to image bounds
    return Rect.fromLTRB(
      padded.left.clamp(0, imgW),
      padded.top.clamp(0, imgH),
      padded.right.clamp(0, imgW),
      padded.bottom.clamp(0, imgH),
    );
  }

  static img.Image _convertBGRA8888ToImage(CameraImage image, Rect box) {
    final int cropW = max(1, (box.right - box.left).toInt());
    final int cropH = max(1, (box.bottom - box.top).toInt());
    final int left = box.left.toInt();
    final int top = box.top.toInt();

    final imgOut = img.Image(width: cropW, height: cropH);
    final bytes = image.planes[0].bytes;
    final bytesPerRow = image.planes[0].bytesPerRow;

    for (int y = 0; y < cropH; y++) {
      for (int x = 0; x < cropW; x++) {
        final int index = (top + y) * bytesPerRow + (left + x) * 4;
        if (index + 2 < bytes.length) {
          imgOut.setPixelRgb(x, y, bytes[index + 2], bytes[index + 1], bytes[index]);
        }
      }
    }
    return imgOut;
  }

  static img.Image _convertYUV420ToImage(CameraImage image, Rect box) {
    final int width = image.width;
    final int height = image.height;

    final int cropW = max(1, (box.right - box.left).toInt());
    final int cropH = max(1, (box.bottom - box.top).toInt());
    final int left = box.left.toInt();
    final int top = box.top.toInt();

    final uvRowStride = image.planes.length > 1 ? image.planes[1].bytesPerRow : width;
    final uvPixelStride = image.planes.length > 1 ? (image.planes[1].bytesPerPixel ?? 1) : 2;

    final imgOut = img.Image(width: cropW, height: cropH);

    for (int y = 0; y < cropH; y++) {
      final actualY = (top + y).clamp(0, height - 1);
      final uvY = actualY ~/ 2;

      for (int x = 0; x < cropW; x++) {
        final actualX = (left + x).clamp(0, width - 1);
        final uvX = actualX ~/ 2;

        final yIndex = actualY * image.planes[0].bytesPerRow + actualX;
        if (yIndex >= image.planes[0].bytes.length) continue;

        final yVal = image.planes[0].bytes[yIndex] & 0xFF;
        int uVal = 128, vVal = 128;

        if (image.planes.length > 2) {
          final uvIdx = uvY * uvRowStride + uvX * uvPixelStride;
          if (uvIdx < image.planes[1].bytes.length && uvIdx < image.planes[2].bytes.length) {
            uVal = image.planes[1].bytes[uvIdx] & 0xFF;
            vVal = image.planes[2].bytes[uvIdx] & 0xFF;
          }
        } else if (image.planes.length == 2) {
          final uvIdx = uvY * uvRowStride + uvX * uvPixelStride;
          if (uvIdx + 1 < image.planes[1].bytes.length) {
            vVal = image.planes[1].bytes[uvIdx] & 0xFF;
            uVal = image.planes[1].bytes[uvIdx + 1] & 0xFF;
          }
        }

        final r = (yVal + 1.402 * (vVal - 128)).round().clamp(0, 255);
        final g = (yVal - 0.344136 * (uVal - 128) - 0.714136 * (vVal - 128)).round().clamp(0, 255);
        final b = (yVal + 1.772 * (uVal - 128)).round().clamp(0, 255);

        imgOut.setPixelRgb(x, y, r, g, b);
      }
    }
    return imgOut;
  }
}
