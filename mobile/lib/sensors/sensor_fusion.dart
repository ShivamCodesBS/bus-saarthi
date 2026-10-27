import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../models/sensor_payload.dart';
import '../models/telemetry_model.dart';
import '../core/constants.dart';
import 'gps_sensor.dart';
import 'accelerometer_sensor.dart';
import 'compass_sensor.dart';

class SensorFusion {
  final GpsSensor _gps = GpsSensor();
  final AccelerometerSensor _accel = AccelerometerSensor();
  final CompassSensor _compass = CompassSensor();

  StreamSubscription? _gpsSub;
  StreamSubscription? _accelSub;
  StreamSubscription? _compassSub;
  Timer? _publishTimer;

  final StreamController<SensorPayload> _controller =
      StreamController<SensorPayload>.broadcast();
  Stream<SensorPayload> get stream => _controller.stream;

  Position? _lastGps;
  UserAccelerometerEvent? _lastAccel;
  double? _lastHeading;
  
  // For ride comfort calculation - maintain rolling buffer of acceleration magnitudes
  final List<double> _accelBuffer = [];
  static const int _bufferSize = 20;
  
  // Movement detection using accelerometer (to filter GPS noise)
  final List<double> _movementBuffer = [];
  static const int _movementBufferSize = 30; // ~7.5 seconds at 250ms interval
  static const double _movementThreshold = 1.2; // m/s² - minimum vibration to consider "moving"
  bool _isActuallyMoving = false;
  
  // GPS speed smoothing
  final List<double> _gpsSpeedBuffer = [];
  static const int _gpsSpeedBufferSize = 10;

  Future<void> start(String routeId) async {
    // Guard: stop any existing session before starting a new one.
    stop();

    try {
      _gpsSub = _gps.positionStream.listen(
        (pos) => _lastGps = pos,
        onError: (e) => print('[GPS] Stream error (non-fatal): $e'),
      );
    } catch (e) {
      print('[SensorFusion] Error initializing GPS in background: $e');
    }

    try {
      _accelSub = _accel.accelerometerStream.listen(
        (e) {
          _lastAccel = e;
          // Calculate acceleration magnitude for comfort
          final magnitude = sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
          _accelBuffer.add(magnitude);
          if (_accelBuffer.length > _bufferSize) {
            _accelBuffer.removeAt(0);
          }
          
          // Movement detection: use user acceleration (excludes gravity)
          // to detect actual bus movement vs GPS noise
          _movementBuffer.add(magnitude);
          if (_movementBuffer.length > _movementBufferSize) {
            _movementBuffer.removeAt(0);
          }
          
          // Update movement state based on rolling average
          if (_movementBuffer.isNotEmpty) {
            final avgMovement = _movementBuffer.reduce((a, b) => a + b) / _movementBuffer.length;
            _isActuallyMoving = avgMovement > _movementThreshold;
          }
        },
        onError: (e) => print('[Accel] Stream error (non-fatal): $e'),
      );
    } catch (e) {
      print('[SensorFusion] Error initializing Accelerometer: $e');
    }

    try {
      _compassSub = _compass.compassStream?.listen(
        (e) {
          if (e.heading != null) {
            _lastHeading = TelemetryData.normalizeHeading(e.heading!);
          }
        },
        onError: (e) => print('[Compass] Stream error (non-fatal): $e'),
      );
    } catch (e) {
      print('[SensorFusion] Error initializing Compass: $e');
    }

    _publishTimer = Timer.periodic(
      const Duration(milliseconds: AppConstants.sensorIntervalMs),
      (_) => _publish(routeId),
    );
  }

  void stop() {
    _gpsSub?.cancel();
    _gpsSub = null;

    _accelSub?.cancel();
    _accelSub = null;

    _compassSub?.cancel();
    _compassSub = null;

    _publishTimer?.cancel();
    _publishTimer = null;

    _lastGps = null;
    _lastAccel = null;
    _lastHeading = null;
    _accelBuffer.clear();
    _movementBuffer.clear();
    _gpsSpeedBuffer.clear();
    _isActuallyMoving = false;
  }

  void dispose() {
    stop();
    _controller.close();
  }

  String _calculateComfort() {
    if (_accelBuffer.isEmpty) return 'Smooth';

    final mean = _accelBuffer.reduce((a, b) => a + b) / _accelBuffer.length;
    final variance = _accelBuffer.map((v) => pow(v - mean, 2)).reduce((a, b) => a + b) / _accelBuffer.length;
    final stdDev = sqrt(variance);
    final maxAccel = _accelBuffer.reduce(max);

    // Adjusted thresholds for realistic bus ride comfort:
    // - Smooth: normal driving, minor vibrations (maxAccel < 4, stdDev < 1.5)
    // - Moderate: noticeable bumps, potholes (maxAccel 4-8, stdDev 1.5-3.0)
    // - Rough: severe bumps, speed breakers, bad roads (maxAccel > 8, stdDev > 3.0)
    if (maxAccel >= 10.0 || stdDev >= 3.5) return 'Rough';
    if (maxAccel >= 4.0 || stdDev >= 1.5) return 'Moderate';
    return 'Smooth';
  }

  double _calculateFilteredSpeed(double gpsSpeedKmh) {
    // Add GPS speed to buffer
    _gpsSpeedBuffer.add(gpsSpeedKmh);
    if (_gpsSpeedBuffer.length > _gpsSpeedBufferSize) {
      _gpsSpeedBuffer.removeAt(0);
    }

    // If not actually moving (based on accelerometer), return 0
    if (!_isActuallyMoving) {
      return 0.0;
    }

    // If moving, use median of recent GPS speeds to filter outliers
    if (_gpsSpeedBuffer.isNotEmpty) {
      final sorted = List<double>.from(_gpsSpeedBuffer)..sort();
      final mid = sorted.length ~/ 2;
      return sorted.length % 2 == 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    }

    return gpsSpeedKmh;
  }

  void _publish(String routeId) {
    final gpsSpeedMs = _lastGps?.speed ?? 0.0;
    final gpsSpeedKmh = gpsSpeedMs * 3.6;
    final filteredSpeedKmh = _calculateFilteredSpeed(gpsSpeedKmh);
    
    final comfort = _calculateComfort();

    final payload = SensorPayload(
      latitude: _lastGps?.latitude,
      longitude: _lastGps?.longitude,
      gpsSpeedKnots: gpsSpeedMs * 1.94384,
      accelX: _lastAccel?.x,
      accelY: _lastAccel?.y,
      accelZ: _lastAccel?.z,
      headingDeg: _lastHeading,
      mpuSpeedKmh: filteredSpeedKmh, // Use filtered speed
      routeId: routeId,
      timestamp: DateTime.now().toUtc().toIso8601String(),
      comfort: comfort,
    );

    _controller.add(payload);
  }
}
