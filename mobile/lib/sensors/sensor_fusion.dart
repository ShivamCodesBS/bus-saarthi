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
  
  // Heading smoothing - exponential moving average
  double? _smoothedHeading;
  static const double _headingAlpha = 0.3; // Smoothing factor (0-1, lower = smoother)

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
        (e) {
          if (e.heading != null) {
            final rawHeading = TelemetryData.normalizeHeading(e.heading!);
            // Exponential moving average for heading stability
            if (_smoothedHeading == null) {
              _smoothedHeading = rawHeading;
            } else {
              // Handle wrap-around (359° -> 1° = 2°, not -358°)
              double diff = rawHeading - _smoothedHeading!;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              _smoothedHeading = (_smoothedHeading! + _headingAlpha * diff) % 360;
              if (_smoothedHeading! < 0) _smoothedHeading = _smoothedHeading! + 360;
            }
            _lastHeading = _smoothedHeading;
          }
        },
        onError: (e) => print('[Compass] Stream error (non-fatal): $e'),
      );
    } catch (e) {
      print('[SensorFusion] Error initializing Compass: $e');
    }

    _publishTimer = Timer.periodic(
      const Duration(milliseconds: 1000), // 1Hz telemetry
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
    _smoothedHeading = null;
    _accelBuffer.clear();
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
    if (maxAccel >= 10.0 || stdDev >= 3.5) return 'Rough';
    if (maxAccel >= 4.0 || stdDev >= 1.5) return 'Moderate';
    return 'Smooth';
  }

  void _publish(String routeId) {
    // Publish whatever GPS we have (raw, no filtering)
    if (_lastGps == null) {
      print('[SensorFusion] No GPS fix yet, skipping publish');
      return;
    }

    final gpsSpeedMs = _lastGps!.speed;
    final gpsSpeedKmh = gpsSpeedMs * 3.6;
    
    final comfort = _calculateComfort();

    final payload = SensorPayload(
      latitude: _lastGps!.latitude,
      longitude: _lastGps!.longitude,
      gpsSpeedKnots: gpsSpeedMs * 1.94384,
      accelX: _lastAccel?.x,
      accelY: _lastAccel?.y,
      accelZ: _lastAccel?.z,
      headingDeg: _lastHeading,
      mpuSpeedKmh: gpsSpeedKmh, // Raw GPS speed - no filtering
      routeId: routeId,
      timestamp: DateTime.now().toUtc().toIso8601String(),
      comfort: comfort,
    );

    _controller.add(payload);
    print('[SensorFusion] Published: lat=${_lastGps!.latitude.toStringAsFixed(6)}, lng=${_lastGps!.longitude.toStringAsFixed(6)}, spd=${gpsSpeedKmh.toStringAsFixed(1)}km/h, comfort=$comfort, heading=${_lastHeading?.toStringAsFixed(1) ?? 'N/A'}');
  }
}
