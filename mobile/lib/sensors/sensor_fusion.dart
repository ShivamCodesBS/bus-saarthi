import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../models/sensor_payload.dart';
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
        },
        onError: (e) => print('[Accel] Stream error (non-fatal): $e'),
      );
    } catch (e) {
      print('[SensorFusion] Error initializing Accelerometer: $e');
    }

    try {
      _compassSub = _compass.compassStream?.listen(
        (e) => _lastHeading = e.heading,
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
  }

  void dispose() {
    stop();
    _controller.close();
  }

  String _calculateComfort() {
    if (_accelBuffer.isEmpty) return 'Smooth';
    
    // Calculate standard deviation of acceleration magnitude
    final mean = _accelBuffer.reduce((a, b) => a + b) / _accelBuffer.length;
    final variance = _accelBuffer.map((v) => pow(v - mean, 2)).reduce((a, b) => a + b) / _accelBuffer.length;
    final stdDev = sqrt(variance);
    
    // Also check peak acceleration
    final maxAccel = _accelBuffer.reduce(max);
    
    // Classification thresholds (m/s²)
    // Smooth: stdDev < 1.5 && max < 12
    // Moderate: stdDev < 3.0 && max < 18
    // Rough: otherwise
    if (stdDev < 1.5 && maxAccel < 12.0) return 'Smooth';
    if (stdDev < 3.0 && maxAccel < 18.0) return 'Moderate';
    return 'Rough';
  }

  void _publish(String routeId) {
    final gpsSpeedMs = _lastGps?.speed ?? 0.0;
    final gpsSpeedKmh = gpsSpeedMs * 3.6;
    
    final comfort = _calculateComfort();

    final payload = SensorPayload(
      latitude: _lastGps?.latitude,
      longitude: _lastGps?.longitude,
      gpsSpeedKnots: gpsSpeedMs * 1.94384,
      accelX: _lastAccel?.x,
      accelY: _lastAccel?.y,
      accelZ: _lastAccel?.z,
      headingDeg: _lastHeading,
      mpuSpeedKmh: gpsSpeedKmh,
      routeId: routeId,
      timestamp: DateTime.now().toUtc().toIso8601String(),
      comfort: comfort,
    );

    _controller.add(payload);
  }
}
