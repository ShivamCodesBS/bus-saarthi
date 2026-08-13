import 'dart:async';
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

  Future<void> start(String routeId) async {
    // Guard: stop any existing session before starting a new one.
    // This prevents duplicate timers if start() is called while already running.
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
        (e) => _lastAccel = e,
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
    // Cancel and null all subscriptions to prevent ghost timers / data leaks
    _gpsSub?.cancel();
    _gpsSub = null;

    _accelSub?.cancel();
    _accelSub = null;

    _compassSub?.cancel();
    _compassSub = null;

    _publishTimer?.cancel();
    _publishTimer = null;

    // Clear cached sensor state so stale values aren't emitted after restart
    _lastGps = null;
    _lastAccel = null;
    _lastHeading = null;
  }

  /// Call when this SensorFusion instance will never be used again.
  /// Closes the broadcast stream so downstream listeners get their onDone.
  void dispose() {
    stop();
    _controller.close();
  }

  void _publish(String routeId) {
    final gpsSpeedMs = _lastGps?.speed ?? 0.0;
    final gpsSpeedKmh = gpsSpeedMs * 3.6;

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
    );

    _controller.add(payload);
  }
}
