import 'dart:math';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'recognition_config.dart';
import 'face_tracker.dart';
import '../core/image_utils.dart';

class FaceAligner {
  /// ArcFace standard reference points for 112x112 crop
  static const double _refLeftEyeX = 38.29;
  static const double _refLeftEyeY = 51.69;
  static const double _refRightEyeX = 73.53;
  static const double _refRightEyeY = 51.69;
  
  /// Aligns and crops the face from the camera image to a 112x112 image.
  /// Uses a similarity transform based on eye centers.
  img.Image align(CameraImage image, TrackedFace trackedFace, CameraLensDirection lensDirection) {
    final face = trackedFace.face;
    final int outSize = RecognitionConfig.modelInputSize; // 112
    
    // Get eye landmarks
    final leftEye = face.landmarks[FaceLandmarkType.leftEye];
    final rightEye = face.landmarks[FaceLandmarkType.rightEye];
    
    // If eyes are missing, fallback to simple crop and resize
    if (leftEye == null || rightEye == null) {
      return _fallbackCropAndResize(image, face.boundingBox, lensDirection, outSize);
    }

    // Coordinates from ML Kit
    double leX = leftEye.position.x.toDouble();
    double leY = leftEye.position.y.toDouble();
    double reX = rightEye.position.x.toDouble();
    double reY = rightEye.position.y.toDouble();

    // Handle mirroring for front camera
    if (lensDirection == CameraLensDirection.front) {
      leX = image.width - leX;
      reX = image.width - reX;
      // swap left and right logically because image is mirrored
      final tempX = leX;
      final tempY = leY;
      leX = reX;
      leY = reY;
      reX = tempX;
      reY = tempY;
    }

    // Source eye centers
    final double srcDX = reX - leX;
    final double srcDY = reY - leY;
    final double srcDist = sqrt(srcDX * srcDX + srcDY * srcDY);
    
    // Target eye centers
    final double dstDX = _refRightEyeX - _refLeftEyeX;
    final double dstDY = _refRightEyeY - _refLeftEyeY;
    final double dstDist = sqrt(dstDX * dstDX + dstDY * dstDY);
    
    // Scale and Rotation
    final double scale = dstDist / srcDist;
    final double angle = atan2(srcDY, srcDX) - atan2(dstDY, dstDX);
    
    // Translation
    final double sinA = sin(angle);
    final double cosA = cos(angle);
    
    // Transform matrix for Source -> Target
    // X_target = (X_src - leX) * scale * cosA - (Y_src - leY) * scale * sinA + refLeftEyeX
    // Y_target = (X_src - leX) * scale * sinA + (Y_src - leY) * scale * cosA + refLeftEyeY
    
    // Inverse transform for Target -> Source (for backward mapping pixel interpolation)
    // We want to loop over 112x112 target image and find corresponding source pixel
    final double invScale = 1.0 / scale;
    final double invSinA = sin(-angle);
    final double invCosA = cos(-angle);

    // Create 112x112 output image
    final outImg = img.Image(width: outSize, height: outSize);
    
    // Since CameraImage might be YUV, we shouldn't convert the whole image.
    // Let's first extract a slightly padded bounding box covering the face,
    // convert that to RGB, and then do the affine warp from that RGB crop.
    
    // 1. Get padded bounding box
    final pad = (face.boundingBox.width * 0.5).toInt();
    final cropRect = Rect.fromLTRB(
      (face.boundingBox.left - pad).clamp(0, image.width).toDouble(),
      (face.boundingBox.top - pad).clamp(0, image.height).toDouble(),
      (face.boundingBox.right + pad).clamp(0, image.width).toDouble(),
      (face.boundingBox.bottom + pad).clamp(0, image.height).toDouble(),
    );
    
    // 2. Convert crop to RGB
    final rgbCrop = ImageUtils.cropFaceFromCameraImage(image, cropRect, lensDirection);
    if (rgbCrop == null) {
      // Fallback if conversion fails
      return img.Image(width: outSize, height: outSize);
    }
    
    // 3. Backward map from 112x112 to rgbCrop
    for (int y = 0; y < outSize; y++) {
      for (int x = 0; x < outSize; x++) {
        // Target -> Source (global)
        final double dx = x - _refLeftEyeX;
        final double dy = y - _refLeftEyeY;
        
        final double srcGlobalX = leX + (dx * invCosA - dy * invSinA) * invScale;
        final double srcGlobalY = leY + (dx * invSinA + dy * invCosA) * invScale;
        
        // Global -> Crop local
        final int srcLocalX = (srcGlobalX - cropRect.left).round();
        final int srcLocalY = (srcGlobalY - cropRect.top).round();
        
        if (srcLocalX >= 0 && srcLocalX < rgbCrop.width && 
            srcLocalY >= 0 && srcLocalY < rgbCrop.height) {
          final p = rgbCrop.getPixel(srcLocalX, srcLocalY);
          outImg.setPixel(x, y, p);
        } else {
          // Out of bounds - set to black
          outImg.setPixelRgb(x, y, 0, 0, 0);
        }
      }
    }
    
    return outImg;
  }
  
  img.Image _fallbackCropAndResize(CameraImage image, Rect boundingBox, CameraLensDirection lensDirection, int outSize) {
    // Basic crop
    final cropRect = Rect.fromLTRB(
      boundingBox.left,
      boundingBox.top,
      boundingBox.right,
      boundingBox.bottom,
    );
    
    final cropped = ImageUtils.cropFaceFromCameraImage(image, cropRect, lensDirection);
    if (cropped == null) {
      return img.Image(width: outSize, height: outSize);
    }
    
    return img.copyResize(cropped, width: outSize, height: outSize);
  }
}
