import 'dart:math';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'recognition_config.dart';
import 'face_tracker.dart';
import '../core/image_utils.dart';

class FaceQualityResult {
  final double faceSizeScore;
  final double blurScore;
  final double brightnessScore;
  final double contrastScore;
  final double yawScore;
  final double pitchScore;
  final double rollScore;
  final double eyeOpenScore;
  final double positionScore;
  final double landmarkConfScore;

  final double totalScore;

  FaceQualityResult({
    required this.faceSizeScore,
    required this.blurScore,
    required this.brightnessScore,
    required this.contrastScore,
    required this.yawScore,
    required this.pitchScore,
    required this.rollScore,
    required this.eyeOpenScore,
    required this.positionScore,
    required this.landmarkConfScore,
    required this.totalScore,
  });
}

class FaceQualityEngine {
  /// Evaluates the quality of a detected face.
  FaceQualityResult score(
      TrackedFace trackedFace, CameraImage image, CameraLensDirection lensDirection) {
    
    final face = trackedFace.face;
    
    // 1. Face Size Score
    double faceSizeScore = 0.0;
    if (image.width > 0 && image.height > 0) {
      final faceArea = face.boundingBox.width * face.boundingBox.height;
      final imageArea = image.width * image.height;
      final sizeRatio = faceArea / imageArea;
      
      if (sizeRatio < RecognitionConfig.minFaceSize) {
        faceSizeScore = 0.0;
      } else {
        // Optimal size is around 15-40% of the frame
        faceSizeScore = (sizeRatio * 2).clamp(0.0, 1.0);
      }
    }

    // 2. Position Score
    double positionScore = 1.0;
    final centerX = image.width / 2;
    final centerY = image.height / 2;
    final faceCenterX = face.boundingBox.left + face.boundingBox.width / 2;
    final faceCenterY = face.boundingBox.top + face.boundingBox.height / 2;
    
    final distFromCenter = sqrt(pow(centerX - faceCenterX, 2) + pow(centerY - faceCenterY, 2));
    final maxDist = sqrt(pow(centerX, 2) + pow(centerY, 2));
    positionScore = (1.0 - (distFromCenter / maxDist)).clamp(0.0, 1.0);

    // 3. Pose Scores (Yaw, Pitch, Roll)
    final yaw = face.headEulerAngleY ?? 0.0;
    final pitch = face.headEulerAngleX ?? 0.0;
    final roll = face.headEulerAngleZ ?? 0.0;

    double yawScore = 1.0 - (yaw.abs() / RecognitionConfig.maxYaw).clamp(0.0, 1.0);
    double pitchScore = 1.0 - (pitch.abs() / RecognitionConfig.maxPitch).clamp(0.0, 1.0);
    double rollScore = 1.0 - (roll.abs() / RecognitionConfig.maxRoll).clamp(0.0, 1.0);

    // 4. Eye Open Score
    double eyeOpenScore = 1.0;
    if (face.leftEyeOpenProbability != null && face.rightEyeOpenProbability != null) {
      final avgEyeOpen = (face.leftEyeOpenProbability! + face.rightEyeOpenProbability!) / 2.0;
      eyeOpenScore = avgEyeOpen.clamp(0.0, 1.0);
    }

    // 5. Landmark Confidence Score
    // Check if the 5 key landmarks exist
    int landmarksFound = 0;
    if (face.landmarks[FaceLandmarkType.leftEye] != null) landmarksFound++;
    if (face.landmarks[FaceLandmarkType.rightEye] != null) landmarksFound++;
    if (face.landmarks[FaceLandmarkType.noseBase] != null) landmarksFound++;
    if (face.landmarks[FaceLandmarkType.leftMouth] != null) landmarksFound++;
    if (face.landmarks[FaceLandmarkType.rightMouth] != null) landmarksFound++;
    
    double landmarkConfScore = landmarksFound / 5.0;

    // Fast-fail: if face is too small, bad pose, or missing landmarks, don't waste time on pixel operations
    double baseScore = (faceSizeScore * RecognitionConfig.wFaceSize) +
        (positionScore * RecognitionConfig.wPosition) +
        (yawScore * RecognitionConfig.wYaw) +
        (pitchScore * RecognitionConfig.wPitch) +
        (rollScore * RecognitionConfig.wRoll) +
        (eyeOpenScore * RecognitionConfig.wEyeOpen) +
        (landmarkConfScore * RecognitionConfig.wLandmarkConf);
        
    double maxBaseWeight = RecognitionConfig.wFaceSize + RecognitionConfig.wPosition +
        RecognitionConfig.wYaw + RecognitionConfig.wPitch + RecognitionConfig.wRoll +
        RecognitionConfig.wEyeOpen + RecognitionConfig.wLandmarkConf;

    double pixelWeights = RecognitionConfig.wBlur + RecognitionConfig.wBrightness + RecognitionConfig.wContrast;
    
    // If the base score is already terrible, skip pixel analysis and return low score
    if (baseScore < 0.2) {
      return FaceQualityResult(
        faceSizeScore: faceSizeScore,
        blurScore: 0.0,
        brightnessScore: 0.0,
        contrastScore: 0.0,
        yawScore: yawScore,
        pitchScore: pitchScore,
        rollScore: rollScore,
        eyeOpenScore: eyeOpenScore,
        positionScore: positionScore,
        landmarkConfScore: landmarkConfScore,
        totalScore: baseScore, // Penality applied by omitting pixel weights
      );
    }

    // 6. Image Pixel Quality (Blur, Brightness, Contrast)
    // Extract face crop to analyze pixels
    final faceCrop = ImageUtils.cropFaceFromCameraImage(image, face.boundingBox, lensDirection);
    
    double blurScore = 0.5;
    double brightnessScore = 0.5;
    double contrastScore = 0.5;

    if (faceCrop != null) {
      blurScore = _estimateBlurScore(faceCrop);
      final lumaStats = _estimateLuminanceStats(faceCrop);
      
      // Optimal brightness is around 128 (middle grey). Penalty for too dark or too bright.
      double meanLuma = lumaStats['mean']!;
      brightnessScore = 1.0 - (meanLuma - 128).abs() / 128.0;
      
      // Higher standard deviation means better contrast
      double stdDev = lumaStats['stdDev']!;
      contrastScore = (stdDev / 128.0).clamp(0.0, 1.0);
    }

    double totalScore = baseScore + 
        (blurScore * RecognitionConfig.wBlur) +
        (brightnessScore * RecognitionConfig.wBrightness) +
        (contrastScore * RecognitionConfig.wContrast);

    return FaceQualityResult(
      faceSizeScore: faceSizeScore,
      blurScore: blurScore,
      brightnessScore: brightnessScore,
      contrastScore: contrastScore,
      yawScore: yawScore,
      pitchScore: pitchScore,
      rollScore: rollScore,
      eyeOpenScore: eyeOpenScore,
      positionScore: positionScore,
      landmarkConfScore: landmarkConfScore,
      totalScore: totalScore,
    );
  }

  /// Calculates a normalized blur score based on Variance of Laplacian.
  /// 1.0 = sharp, 0.0 = completely blurred.
  double _estimateBlurScore(img.Image image) {
    // A proper Variance of Laplacian would require convolution.
    // For performance, we can approximate high-frequency content by checking differences between adjacent pixels.
    if (image.width < 2 || image.height < 2) return 0.0;
    
    double sumDiff = 0;
    int count = 0;
    
    // Sample a grid for speed
    final step = max(1, image.width ~/ 20);
    
    for (int y = 0; y < image.height - 1; y += step) {
      for (int x = 0; x < image.width - 1; x += step) {
        final p1 = image.getPixel(x, y);
        final p2 = image.getPixel(x + 1, y);
        final p3 = image.getPixel(x, y + 1);
        
        final l1 = p1.r * 0.299 + p1.g * 0.587 + p1.b * 0.114;
        final l2 = p2.r * 0.299 + p2.g * 0.587 + p2.b * 0.114;
        final l3 = p3.r * 0.299 + p3.g * 0.587 + p3.b * 0.114;
        
        sumDiff += (l1 - l2).abs() + (l1 - l3).abs();
        count += 2;
      }
    }
    
    if (count == 0) return 0.0;
    
    final avgGradient = sumDiff / count;
    // Map average gradient to a 0.0 - 1.0 score (typical good gradients are 10-30)
    return (avgGradient / 30.0).clamp(0.0, 1.0);
  }

  /// Returns mean and standard deviation of luminance
  Map<String, double> _estimateLuminanceStats(img.Image image) {
    if (image.width == 0 || image.height == 0) return {'mean': 0.0, 'stdDev': 0.0};
    
    double sum = 0;
    double sqSum = 0;
    int count = 0;
    
    final step = max(1, image.width ~/ 20);
    
    for (int y = 0; y < image.height; y += step) {
      for (int x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        final luma = p.r * 0.299 + p.g * 0.587 + p.b * 0.114;
        
        sum += luma;
        sqSum += luma * luma;
        count++;
      }
    }
    
    if (count == 0) return {'mean': 0.0, 'stdDev': 0.0};
    
    final mean = sum / count;
    final variance = (sqSum / count) - (mean * mean);
    final stdDev = variance > 0 ? sqrt(variance) : 0.0;
    
    return {'mean': mean, 'stdDev': stdDev};
  }
}
