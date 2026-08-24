import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'recognition_config.dart';

class FaceDetectionService {
  late FaceDetector _faceDetector;
  bool _isInitialized = false;

  void initialize() {
    if (_isInitialized) return;
    
    final options = FaceDetectorOptions(
      enableContours: RecognitionConfig.enableContours,
      enableLandmarks: true,
      enableClassification: true, // For eye open probability
      enableTracking: true,
      performanceMode: RecognitionConfig.useAccurateMode 
          ? FaceDetectorMode.accurate 
          : FaceDetectorMode.fast,
      minFaceSize: RecognitionConfig.minFaceSize,
    );
    
    _faceDetector = FaceDetector(options: options);
    _isInitialized = true;
  }

  /// Detects faces in a live camera frame.
  Future<List<Face>> detectFaces(CameraImage image, CameraDescription camera) async {
    if (!_isInitialized) initialize();

    final inputImage = _cameraImageToInputImage(image, camera);
    if (inputImage == null) return [];

    try {
      return await _faceDetector.processImage(inputImage);
    } catch (e) {
      print('[FaceDetectionService] Error detecting faces: $e');
      return [];
    }
  }

  /// Converts a [CameraImage] to an [InputImage] for ML Kit.
  InputImage? _cameraImageToInputImage(CameraImage image, CameraDescription camera) {
    final WriteBuffer allBytes = WriteBuffer();
    for (final Plane plane in image.planes) {
      allBytes.putUint8List(plane.bytes);
    }
    final bytes = allBytes.done().buffer.asUint8List();

    final Size imageSize = Size(image.width.toDouble(), image.height.toDouble());
    
    final imageRotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation);
    if (imageRotation == null) return null;
    
    final inputImageFormat = InputImageFormatValue.fromRawValue(image.format.raw);
    if (inputImageFormat == null) return null;

    final planeData = image.planes.map(
      (Plane plane) {
        return InputImagePlaneMetadata(
          bytesPerRow: plane.bytesPerRow,
          height: plane.height,
          width: plane.width,
        );
      },
    ).toList();

    final inputImageData = InputImageData(
      size: imageSize,
      imageRotation: imageRotation,
      inputImageFormat: inputImageFormat,
      planeData: planeData,
    );

    return InputImage.fromBytes(bytes: bytes, inputImageData: inputImageData);
  }

  void dispose() {
    _faceDetector.close();
    _isInitialized = false;
  }
}
