import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:latlong2/latlong.dart';
import '../../providers/auth_provider.dart';
import '../../providers/connection_provider.dart';
import '../../providers/sensor_provider.dart';
import '../../providers/telemetry_provider.dart';
import '../../models/user_model.dart';
import '../../models/telemetry_model.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../services/api_service.dart';
import 'widgets/driver_map_widget.dart';
import 'settings_screen.dart';
import 'dashboard_screen.dart';
import 'login_screen.dart';

class DriverDashboardScreen extends StatefulWidget {
  const DriverDashboardScreen({Key? key}) : super(key: key);

  @override
  State<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends State<DriverDashboardScreen> with TickerProviderStateMixin {
  final GlobalKey<DriverMapWidgetState> _mapKey = GlobalKey<DriverMapWidgetState>();
  final ApiService _apiService = ApiService();

  // Route & Bus states
  String _routeId = AppConstants.defaultRouteId;
  String _routeName = 'Main Campus Express';
  String _busNumber = 'Bus 4';
  List<LatLng> _routeStops = [];
  List<Map<String, dynamic>> _stopsData = [];
  List<Map<String, dynamic>> _availableRoutes = [];

  // Trip Tracking states
  bool _isTripActive = false;
  DateTime? _tripStartTime;
  Duration _tripDuration = Duration.zero;
  Timer? _tripTimer;
  double _distanceTraveledMeters = 0.0;
  Position? _lastRecordedPosition;

  // Live Hardware Sensors
  StreamSubscription<Position>? _positionStreamSub;
  StreamSubscription<CompassEvent>? _compassSub;
  StreamSubscription<UserAccelerometerEvent>? _accelSub;
  double? _currentCompassHeading;
  String _currentComfort = 'Smooth';
  final List<double> _accelBuffer = [];

  // Speed & Heading Filtering (Stillness detection, Deadband, EMA)
  double _currentSpeed = 0.0;
  double? _smoothedSpeed;
  double? _lastValidMovingHeading;
  DateTime? _lastPositionTime;
  static const double _speedDeadbandKmh = 2.5;

  // Low-latency GPS & Broadcast
  Position? _currentGpsPosition;
  Position? _pendingBroadcastPosition;
  Timer? _broadcastThrottleTimer;

  // Next stop calculation
  int _nextStopIndex = 0;
  double _distanceToNextStopMeters = 0.0;

  // SOS state
  bool _isSosActive = false;
  bool _isSosLoading = false;

  // UI animations
  late AnimationController _sheetAnimationCtrl;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    _sheetAnimationCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _initSensors();
    _initializeDriverSession();
  }

  @override
  void dispose() {
    _compassSub?.cancel();
    _accelSub?.cancel();
    _positionStreamSub?.cancel();
    _broadcastThrottleTimer?.cancel();
    _tripTimer?.cancel();
    _sheetAnimationCtrl.dispose();
    super.dispose();
  }

  // ────────────────────────────────────────────────────────────
  //  Hardware Sensors: Compass (Magnetometer) & Accelerometer
  // ────────────────────────────────────────────────────────────
  void _initSensors() {
    // 1. Hardware Compass: live orientation regardless of movement
    try {
      _compassSub?.cancel();
      _compassSub = FlutterCompass.events?.listen((event) {
        if (event.heading != null && mounted) {
          final normalized = TelemetryData.normalizeHeading(event.heading!);
          if (_currentCompassHeading == null) {
            _currentCompassHeading = normalized;
            setState(() {});
          } else {
            double diff = (normalized - _currentCompassHeading! + 180) % 360 - 180;
            if (diff.abs() > 2.0) {
              _currentCompassHeading = (_currentCompassHeading! + 0.25 * diff + 360) % 360;
              setState(() {});
            }
          }
        }
      }, onError: (e) {
        print('[DriverDashboard] Compass error: $e');
      });
    } catch (e) {
      print('[DriverDashboard] Compass init error: $e');
    }

    // 2. Hardware Accelerometer: instant ride comfort & shake detection
    try {
      _accelSub?.cancel();
      _accelSub = userAccelerometerEventStream().listen((event) {
        final mag = sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
        _accelBuffer.add(mag);
        if (_accelBuffer.length > 12) {
          _accelBuffer.removeAt(0);
        }
        final newComfort = _calculateComfort();
        if (newComfort != _currentComfort && mounted) {
          setState(() {
            _currentComfort = newComfort;
          });
          // Broadcast comfort change immediately to web and listeners
          if (_isTripActive && _pendingBroadcastPosition != null) {
            final telemetry = Provider.of<TelemetryProvider>(context, listen: false);
            _emitPosition(telemetry);
          }
        }
      }, onError: (e) {
        print('[DriverDashboard] Accel error: $e');
      });
    } catch (e) {
      print('[DriverDashboard] Accel init error: $e');
    }
  }

  String _calculateComfort() {
    if (_accelBuffer.isEmpty) return 'Smooth';

    final mean = _accelBuffer.reduce((a, b) => a + b) / _accelBuffer.length;
    final variance = _accelBuffer
            .map((v) => pow(v - mean, 2))
            .reduce((a, b) => a + b) /
        _accelBuffer.length;
    final stdDev = sqrt(variance);
    final maxAccel = _accelBuffer.reduce(max);

    // Adjusted thresholds for realistic bus ride comfort (matching SensorFusion):
    // - Smooth: normal driving, minor vibrations (maxAccel < 4, stdDev < 1.5)
    // - Moderate: noticeable bumps, potholes (maxAccel 4-10, stdDev 1.5-3.5)
    // - Rough: severe bumps, speed breakers, bad roads (maxAccel > 10, stdDev > 3.5)
    if (maxAccel >= 10.0 || stdDev >= 3.5) {
      return 'Rough';
    } else if (maxAccel >= 4.0 || stdDev >= 1.5) {
      return 'Moderate';
    }
    return 'Smooth';
  }

  Future<void> _initializeDriverSession() async {
    // 1. Check and request location permissions
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      await openAppSettings();
    }
    await Permission.notification.request();

    if (!mounted) return;

    // 2. Resolve initial assigned route & driver details
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.user;
    if (user?.routeId != null && user!.routeId!.isNotEmpty) {
      _routeId = user.routeId!;
    }

    // 3. Connect TelemetryProvider socket to receive and emit route updates
    final telemetry = Provider.of<TelemetryProvider>(context, listen: false);
    telemetry.connect(_routeId);

    // 4. Load route details, stops & available routes for quick bus switching
    await _loadRouteDetails(_routeId);
    await _loadAvailableRoutes();

    // 5. Automatically get current position to center map
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
      );
      if (mounted) {
        setState(() {
          _currentGpsPosition = pos;
          _pendingBroadcastPosition = pos;
        });
      }
    } catch (e) {
      print('[DriverDashboard] Initial GPS fix: $e');
    }
  }

  Future<void> _loadRouteDetails(String routeId) async {
    try {
      final route = await _apiService.fetchRoute(routeId);
      if (route != null && mounted) {
        final parsedStops = _parseStops(route['stops']);
        setState(() {
          _routeId = routeId;
          _routeName = route['routeName']?.toString() ?? 'Route $routeId';
          _busNumber = route['busNumber']?.toString() ?? 'Bus $routeId';
          _routeStops = parsedStops.map((s) => s['point'] as LatLng).toList();
          _stopsData = parsedStops;
        });
        _calculateNextStop();
      }
    } catch (e) {
      print('[DriverDashboard] Failed to fetch route details: $e');
    }
  }

  Future<void> _loadAvailableRoutes() async {
    try {
      final routes = await _apiService.fetchRoutes();
      if (mounted) {
        setState(() => _availableRoutes = routes);
      }
    } catch (e) {
      print('[DriverDashboard] Failed to load routes list: $e');
    }
  }

  List<Map<String, dynamic>> _parseStops(dynamic stops) {
    if (stops == null) return [];
    try {
      List<dynamic> stopList;
      if (stops is String) {
        stopList = jsonDecode(stops) as List<dynamic>;
      } else if (stops is List) {
        stopList = stops;
      } else {
        return [];
      }

      final List<Map<String, dynamic>> results = [];
      for (int i = 0; i < stopList.length; i++) {
        final stop = stopList[i];
        if (stop is Map<String, dynamic>) {
          final lat = (stop['latitude'] ?? stop['lat']) as num?;
          final lng = (stop['longitude'] ?? stop['lng']) as num?;
          final name = stop['name']?.toString() ?? 'Stop ${i + 1}';
          if (lat != null && lng != null) {
            results.add({
              'index': i,
              'name': name,
              'lat': lat.toDouble(),
              'lng': lng.toDouble(),
              'point': LatLng(lat.toDouble(), lng.toDouble()),
            });
          }
        }
      }
      return results;
    } catch (e) {
      print('[DriverDashboard] Parse stops error: $e');
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Trip Tracking: Ultra-Low Latency GPS & Instant Broadcasting
  // ────────────────────────────────────────────────────────────
  LocationSettings _getLocationSettings() {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0, // No deadband: emit as soon as GPS has a fix!
        forceLocationManager: false,
        intervalDuration: const Duration(milliseconds: 200), // Check every 200ms
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0,
    );
  }

  void _startTrip() async {
    HapticFeedback.heavyImpact();

    final sensors = Provider.of<SensorProvider>(context, listen: false);
    final telemetry = Provider.of<TelemetryProvider>(context, listen: false);

    setState(() {
      _isTripActive = true;
      _tripStartTime = DateTime.now();
      _tripDuration = Duration.zero;
      _distanceTraveledMeters = 0.0;
      _lastRecordedPosition = null;
    });

    // Start trip elapsed duration timer
    _tripTimer?.cancel();
    _tripTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _tripDuration = DateTime.now().difference(_tripStartTime!);
        });
      }
    });

    // 1. Start foreground background service (runs in persistent notification)
    await sensors.startSensors(_routeId);

    // 2. Start high-precision foreground GPS stream (200ms interval, 0m filter)
    _positionStreamSub?.cancel();
    _positionStreamSub = Geolocator.getPositionStream(
      locationSettings: _getLocationSettings(),
    ).listen((Position position) {
      _handlePositionUpdate(position, telemetry);
    }, onError: (e) {
      print('[DriverDashboard] GPS stream error: $e');
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Trip Started: Broadcasting live location for $_busNumber ($_routeName)',
              ),
            ),
          ],
        ),
        backgroundColor: AppTheme.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  /// Stillness check: when phone is placed on a table or motionless,
  /// standard deviation of user acceleration is extremely low (< 0.28 m/s²).
  bool _isMotionless() {
    if (_accelBuffer.isEmpty) return false;
    final mean = _accelBuffer.reduce((a, b) => a + b) / _accelBuffer.length;
    final variance = _accelBuffer
            .map((v) => pow(v - mean, 2))
            .reduce((a, b) => a + b) /
        _accelBuffer.length;
    final stdDev = sqrt(variance);
    final maxAccel = _accelBuffer.reduce(max);
    return stdDev < 0.28 && maxAccel < 0.65;
  }

  /// Speed filter with deadband, EMA, and spike rejection.
  double _smoothSpeed(double rawKmh) {
    if (rawKmh < _speedDeadbandKmh || _isMotionless()) {
      _smoothedSpeed = 0.0;
      return 0.0;
    }
    if (_smoothedSpeed == null || _smoothedSpeed == 0.0) {
      final capped = rawKmh > 20.0 ? 15.0 : rawKmh;
      _smoothedSpeed = capped;
      return capped;
    }
    final prev = _smoothedSpeed!;
    var input = rawKmh;
    // Disallow sudden jumps > 20 km/h in a fraction of a second
    if ((input - prev) > 20.0) {
      input = prev + 5.0;
    }
    final next = prev + 0.45 * (input - prev);
    if (next < _speedDeadbandKmh) {
      _smoothedSpeed = 0.0;
      return 0.0;
    }
    _smoothedSpeed = next;
    return next;
  }

  double _calculateBearing(double lat1, double lon1, double lat2, double lon2) {
    final dLon = (lon2 - lon1) * (pi / 180.0);
    final y = sin(dLon) * cos(lat2 * (pi / 180.0));
    final x = cos(lat1 * (pi / 180.0)) * sin(lat2 * (pi / 180.0)) -
        sin(lat1 * (pi / 180.0)) * cos(lat2 * (pi / 180.0)) * cos(dLon);
    final brng = atan2(y, x) * (180.0 / pi);
    return (brng + 360.0) % 360.0;
  }

  void _handlePositionUpdate(Position position, TelemetryProvider telemetry) {
    if (!mounted) return;

    final now = DateTime.now();
    double delta = 0.0;
    double calcSpeedKmh = 0.0;

    if (_lastRecordedPosition != null && _lastPositionTime != null) {
      delta = Geolocator.distanceBetween(
        _lastRecordedPosition!.latitude,
        _lastRecordedPosition!.longitude,
        position.latitude,
        position.longitude,
      );
      final dt = now.difference(_lastPositionTime!).inMilliseconds / 1000.0;
      if (dt > 0.1) {
        calcSpeedKmh = (delta / dt) * 3.6;
      }
    }

    final bool motionless = _isMotionless();
    final bool poorAccuracy = position.accuracy > 30.0;

    // Cross-check raw speed against physical displacement to reject table jitter & Doppler spikes
    double rawSpeed = position.speed * 3.6;
    if (motionless || (delta < 1.5 && calcSpeedKmh < 2.5) || (poorAccuracy && delta < 5.0)) {
      rawSpeed = 0.0;
    } else if (rawSpeed > calcSpeedKmh + 20.0 && calcSpeedKmh > 0) {
      rawSpeed = calcSpeedKmh + 5.0;
    }

    _currentSpeed = _smoothSpeed(rawSpeed);

    // Only accumulate distance when actually moving (prevents indoor GPS drift accumulation)
    if (_currentSpeed > _speedDeadbandKmh && delta > 2.0 && position.accuracy < 30.0) {
      _distanceTraveledMeters += delta;
    }

    // Determine heading: when moving (speed >= 3.0), GPS bearing represents the vehicle direction along the road
    if (_currentSpeed >= 3.0) {
      if (position.heading > 0) {
        _lastValidMovingHeading = TelemetryData.normalizeHeading(position.heading);
      } else if (_lastRecordedPosition != null && delta > 3.0) {
        _lastValidMovingHeading = _calculateBearing(
          _lastRecordedPosition!.latitude,
          _lastRecordedPosition!.longitude,
          position.latitude,
          position.longitude,
        );
      }
    }

    _currentGpsPosition = position;
    _pendingBroadcastPosition = position;
    _lastRecordedPosition = position;
    _lastPositionTime = now;

    _calculateNextStop();

    // Broadcast with 500ms cadence to prevent socket bufferbloat on cellular network
    if (_broadcastThrottleTimer == null || !_broadcastThrottleTimer!.isActive) {
      _emitPosition(telemetry);
      _broadcastThrottleTimer = Timer(const Duration(milliseconds: 500), () {
        if (_pendingBroadcastPosition != null) {
          _emitPosition(telemetry);
        }
      });
    }

    setState(() {});
  }

  void _emitPosition(TelemetryProvider telemetry) {
    if (_pendingBroadcastPosition == null) return;
    final pos = _pendingBroadcastPosition!;

    // Heading priority:
    // 1. When moving (speed >= 3.0), use vehicle traveling bearing
    // 2. When stationary, retain last known moving bearing, or use smoothed compass
    final double? heading = (_currentSpeed >= 3.0 && _lastValidMovingHeading != null)
        ? _lastValidMovingHeading
        : (_lastValidMovingHeading ?? _currentCompassHeading ?? (pos.heading > 0 ? TelemetryData.normalizeHeading(pos.heading) : null));

    telemetry.emitLocation(
      latitude: pos.latitude,
      longitude: pos.longitude,
      speedKmh: _currentSpeed,
      heading: heading != null ? TelemetryData.normalizeHeading(heading) : null,
      comfort: _currentComfort,
      routeId: _routeId,
    );
  }

  void _calculateNextStop() {
    if (_stopsData.isEmpty || _currentGpsPosition == null) return;

    int closestIndex = 0;
    double minDistance = double.infinity;

    for (int i = 0; i < _stopsData.length; i++) {
      final stop = _stopsData[i];
      final dist = Geolocator.distanceBetween(
        _currentGpsPosition!.latitude,
        _currentGpsPosition!.longitude,
        stop['lat'] as double,
        stop['lng'] as double,
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // Next stop is either the closest one or the one after if we are right on it (< 50m)
    if (minDistance < 50 && closestIndex < _stopsData.length - 1) {
      closestIndex++;
      final next = _stopsData[closestIndex];
      minDistance = Geolocator.distanceBetween(
        _currentGpsPosition!.latitude,
        _currentGpsPosition!.longitude,
        next['lat'] as double,
        next['lng'] as double,
      );
    }

    _nextStopIndex = closestIndex;
    _distanceToNextStopMeters = minDistance;
  }

  Future<void> _stopTrip() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End Trip?'),
        content: Text(
          'Are you sure you want to end this trip for $_busNumber? '
          'Live location broadcasting to passengers and parents will stop.',
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Continue Trip'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('End Trip'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    HapticFeedback.mediumImpact();
    final sensors = Provider.of<SensorProvider>(context, listen: false);

    _tripTimer?.cancel();
    _broadcastThrottleTimer?.cancel();
    _positionStreamSub?.cancel();
    _positionStreamSub = null;

    sensors.stopSensors();

    setState(() {
      _isTripActive = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Trip ended: ${(_distanceTraveledMeters / 1000).toStringAsFixed(1)} km in ${_formatDuration(_tripDuration)}',
        ),
        backgroundColor: AppTheme.black,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  //  Bus & Route Switcher
  // ────────────────────────────────────────────────────────────
  void _openRouteSwitcher() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.70,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(Icons.directions_bus, color: AppTheme.orange, size: 24),
                  const SizedBox(width: 10),
                  const Text(
                    'Select Assigned Bus / Route',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.black,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _availableRoutes.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: AppTheme.orange),
                    )
                  : ListView.builder(
                      itemCount: _availableRoutes.length,
                      padding: const EdgeInsets.all(16),
                      itemBuilder: (ctx, idx) {
                        final r = _availableRoutes[idx];
                        final rId = r['routeId']?.toString() ?? '';
                        final bNum = r['busNumber']?.toString() ?? 'Bus $rId';
                        final rName = r['routeName']?.toString() ?? 'Route $rId';
                        final isSelected = rId == _routeId;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppTheme.orange.withOpacity(0.08)
                                : Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected ? AppTheme.orange : Colors.grey.shade200,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: ListTile(
                            leading: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isSelected ? AppTheme.orange : Colors.grey.shade200,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.directions_bus_rounded,
                                color: isSelected ? Colors.white : AppTheme.blackSoft,
                              ),
                            ),
                            title: Text(
                              bNum,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: isSelected ? AppTheme.orange : AppTheme.black,
                              ),
                            ),
                            subtitle: Text(
                              'Route $rId · $rName',
                              style: const TextStyle(fontSize: 13),
                            ),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle, color: AppTheme.orange)
                                : const Icon(Icons.chevron_right, color: Colors.grey),
                            onTap: () async {
                              Navigator.pop(ctx);
                              if (rId != _routeId) {
                                if (_isTripActive) {
                                  _stopTrip();
                                }
                                setState(() {
                                  _routeId = rId;
                                  _busNumber = bNum;
                                  _routeName = rName;
                                });
                                final telemetry = Provider.of<TelemetryProvider>(
                                  context,
                                  listen: false,
                                );
                                telemetry.connect(rId);
                                await _loadRouteDetails(rId);
                                _mapKey.currentState?.centerOnBus();
                              }
                            },
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  //  Driver Emergency SOS Alert
  // ────────────────────────────────────────────────────────────
  Future<void> _handleEmergencySos() async {
    HapticFeedback.vibrate();

    if (_isSosActive) {
      // Cancel SOS
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cancel Active SOS?'),
          content: const Text('Are you safe now? This will call off emergency alerts.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep Active'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.black),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Cancel SOS'),
            ),
          ],
        ),
      );

      if (confirm == true) {
        setState(() => _isSosLoading = true);
        final ok = await _apiService.cancelSos();
        setState(() {
          _isSosLoading = false;
          if (ok) _isSosActive = false;
        });
        if (ok) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Emergency SOS cancelled. Status back to normal.'),
              backgroundColor: AppTheme.black,
            ),
          );
        }
      }
      return;
    }

    // Trigger SOS Confirmation
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.danger,
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.white, size: 28),
            SizedBox(width: 8),
            Text(
              'EMERGENCY SOS',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to trigger Emergency SOS?\n\n'
          'This will IMMEDIATELY notify Campus Security, the Transport Incharge, '
          'and send your exact GPS coordinates.',
          style: TextStyle(color: Colors.white, height: 1.4),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.danger,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'TRIGGER SOS NOW',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSosLoading = true);
    final success = await _apiService.triggerSos();
    setState(() {
      _isSosLoading = false;
      _isSosActive = success;
    });

    if (success) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('🚨 SOS Alert Sent! Transport Office has been alerted.'),
          backgroundColor: AppTheme.danger,
          duration: const Duration(seconds: 8),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _formatDuration(Duration d) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = twoDigits(d.inHours);
    final minutes = twoDigits(d.inMinutes.remainder(60));
    final seconds = twoDigits(d.inSeconds.remainder(60));
    return d.inHours > 0 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Consumer3<AuthProvider, ConnectionProvider, TelemetryProvider>(
          builder: (context, auth, connection, telemetry, _) {
            final user = auth.user;
            final isLive = _isTripActive || (telemetry.isConnected && telemetry.hasValidTelemetry);
            final currentTelemetry = telemetry.latestTelemetry;

            // Use filtered, zero-latency local sensor readings for the driver's own display
            final localSpeed = _currentSpeed;

            final localHeading = (_currentSpeed >= 3.0 && _lastValidMovingHeading != null)
                ? _lastValidMovingHeading
                : (_lastValidMovingHeading ?? _currentCompassHeading ?? (_currentGpsPosition != null && _currentGpsPosition!.heading > 0
                    ? TelemetryData.normalizeHeading(_currentGpsPosition!.heading)
                    : currentTelemetry?.heading));

            // Construct seamless live telemetry object for map
            final displayTelemetry = _currentGpsPosition != null
                ? TelemetryData(
                    latitude: _currentGpsPosition!.latitude,
                    longitude: _currentGpsPosition!.longitude,
                    speed: localSpeed,
                    heading: localHeading,
                    comfort: _currentComfort,
                    timestamp: DateTime.now(),
                    receivedAt: DateTime.now(),
                    routeId: _routeId,
                  )
                : currentTelemetry;

            return Stack(
              children: [
                // ── 1. Full-Screen Interactive Map ─────────────────────
                Positioned.fill(
                  child: DriverMapWidget(
                    key: _mapKey,
                    telemetry: displayTelemetry,
                    isLive: isLive,
                    routeId: _routeId,
                    busNumber: _busNumber,
                    routeStops: _routeStops,
                    stopDetails: _stopsData,
                    onStopTapped: (idx, stop) {
                      _showStopDetailSheet(idx, stop);
                    },
                  ),
                ),

                // ── 2. Top App Bar with Invertis Logo & Bus Switcher ──
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _buildTopBar(context, user, connection, isLive),
                ),

                // ── 3. Active Emergency SOS Banner (if triggered) ──────
                if (_isSosActive)
                  Positioned(
                    top: 105,
                    left: 16,
                    right: 16,
                    child: _buildSosAlertBanner(),
                  ),

                // ── 4. Bottom Control Sheet (Live Telemetry & Trip) ───
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: _buildBottomPanel(
                    context,
                    user,
                    telemetry,
                    localSpeed,
                    localHeading,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  //  Top Navigation Bar
  // ────────────────────────────────────────────────────────────
  Widget _buildTopBar(
    BuildContext context,
    UserModel? user,
    ConnectionProvider connection,
    bool isLive,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.96),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Invertis University Logo
          Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Image.asset(
              'assets/images/logo.png',
              height: 26,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(Icons.school, color: AppTheme.orange, size: 20),
            ),
          ),
          const SizedBox(width: 8),

          // Bus Icon / Change Route button
          GestureDetector(
            onTap: _openRouteSwitcher,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.orange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.directions_bus, color: Colors.white, size: 16),
                  const SizedBox(width: 5),
                  Text(
                    _busNumber,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.arrow_drop_down, color: Colors.white, size: 18),
                ],
              ),
            ),
          ),

          const SizedBox(width: 10),

          // Driver & Route Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user?.name ?? 'Driver',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.black,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Route $_routeId · $_routeName',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppTheme.blackSoft,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // SOS Button
          GestureDetector(
            onTap: _handleEmergencySos,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _isSosActive ? AppTheme.danger : AppTheme.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.danger.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    size: 16,
                    color: _isSosActive ? Colors.white : AppTheme.danger,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'SOS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: _isSosActive ? Colors.white : AppTheme.danger,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 8),

          // Action Menu (Switch Mode, Settings, Logout)
          PopupMenuButton<String>(
            icon: Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.more_vert_rounded, size: 20, color: AppTheme.black),
            ),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            onSelected: (val) async {
              if (val == 'switch_mode') {
                if (_isTripActive) await _stopTrip();
                if (context.mounted) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const DashboardScreen(
                        mode: AppConstants.modeBusDevice,
                      ),
                    ),
                  );
                }
              } else if (val == 'settings') {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                );
              } else if (val == 'logout') {
                if (_isTripActive) await _stopTrip();
                if (context.mounted) {
                  final auth = Provider.of<AuthProvider>(context, listen: false);
                  await auth.logout();
                  if (context.mounted) {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  }
                }
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'switch_mode',
                child: Row(
                  children: [
                    Icon(Icons.sensors_rounded, color: AppTheme.success, size: 20),
                    SizedBox(width: 10),
                    Text('Switch to In-Bus Scanner', style: TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings_outlined, color: AppTheme.blackSoft, size: 20),
                    SizedBox(width: 10),
                    Text('Settings', style: TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, color: AppTheme.danger, size: 20),
                    SizedBox(width: 10),
                    Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w600, color: AppTheme.danger)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  //  Active SOS Banner
  // ────────────────────────────────────────────────────────────
  Widget _buildSosAlertBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.danger,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppTheme.danger.withOpacity(0.4),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.shield, color: Colors.white, size: 26),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '🚨 EMERGENCY SOS BROADCASTING',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
                Text(
                  'Security and Transport Incharge are alerted.',
                  style: TextStyle(color: Colors.white, fontSize: 11),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: _handleEmergencySos,
            style: TextButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.danger,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            ),
            child: const Text('CANCEL', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  //  Bottom Telemetry & Trip Control Sheet
  // ────────────────────────────────────────────────────────────
  Widget _buildBottomPanel(
    BuildContext context,
    UserModel? user,
    TelemetryProvider telemetryProvider,
    double speed,
    double? heading,
  ) {
    final nextStopName = (_stopsData.isNotEmpty && _nextStopIndex < _stopsData.length)
        ? _stopsData[_nextStopIndex]['name'].toString()
        : 'Destination';

    // Ride comfort color and icon
    final comfortColor = _currentComfort == 'Smooth'
        ? AppTheme.success
        : _currentComfort == 'Moderate'
            ? AppTheme.warning
            : AppTheme.danger;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.10),
            blurRadius: 24,
            spreadRadius: 0,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Pull Handle
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── Next Stop & Live Ride Comfort Banner ───────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.orange.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.orange.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        color: AppTheme.orange,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.pin_drop_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'NEXT STOP',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.orange,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Live Ride Comfort badge
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: comfortColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: comfortColor.withOpacity(0.4)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: comfortColor,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      _currentComfort.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                        color: comfortColor,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          Text(
                            nextStopName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.black,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (_distanceToNextStopMeters > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: Text(
                          _distanceToNextStopMeters < 1000
                              ? '${_distanceToNextStopMeters.toStringAsFixed(0)} m'
                              : '${(_distanceToNextStopMeters / 1000).toStringAsFixed(1)} km',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.black,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // ── Live Telemetry Metrics Row (Speed, Heading, Distance, Duration) ──
              Row(
                children: [
                  // Speedometer (Real-time GPS update)
                  Expanded(
                    child: _MetricTile(
                      label: 'SPEED',
                      value: speed.toStringAsFixed(0),
                      unit: 'km/h',
                      color: speed > 60 ? AppTheme.danger : AppTheme.orange,
                      icon: Icons.speed_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Compass Heading (Physical Magnetometer)
                  Expanded(
                    child: _MetricTile(
                      label: 'HEADING',
                      value: heading != null ? '${heading.toStringAsFixed(0)}°' : '--',
                      unit: _getCardinal(heading),
                      color: AppTheme.info,
                      icon: Icons.explore_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Distance Traveled
                  Expanded(
                    child: _MetricTile(
                      label: 'DISTANCE',
                      value: (_distanceTraveledMeters / 1000).toStringAsFixed(1),
                      unit: 'km',
                      color: AppTheme.infoLight,
                      icon: Icons.alt_route_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Trip Time
                  Expanded(
                    child: _MetricTile(
                      label: 'TRIP TIME',
                      value: _formatDuration(_tripDuration),
                      unit: '',
                      color: AppTheme.success,
                      icon: Icons.timer_rounded,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // ── Primary Action: Start / Stop Trip Button ────────────
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isTripActive ? _stopTrip : _startTrip,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isTripActive ? AppTheme.danger : AppTheme.orange,
                    elevation: 4,
                    shadowColor: (_isTripActive ? AppTheme.danger : AppTheme.orange).withOpacity(0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isTripActive ? Icons.stop_circle_rounded : Icons.play_arrow_rounded,
                        size: 24,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isTripActive ? 'END TRIP & STOP BROADCAST' : 'START TRIP (BROADCAST GPS)',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getCardinal(double? deg) {
    if (deg == null) return '';
    final h = TelemetryData.normalizeHeading(deg);
    if (h >= 348.75 || h < 11.25) return 'N (North)';
    if (h >= 11.25 && h < 33.75) return 'NNE';
    if (h >= 33.75 && h < 56.25) return 'NE (North-East)';
    if (h >= 56.25 && h < 78.75) return 'ENE (East-North-East)';
    if (h >= 78.75 && h < 101.25) return 'E (East)';
    if (h >= 101.25 && h < 123.75) return 'ESE';
    if (h >= 123.75 && h < 146.25) return 'SE (South-East)';
    if (h >= 146.25 && h < 168.75) return 'SSE';
    if (h >= 168.75 && h < 191.25) return 'S (South)';
    if (h >= 191.25 && h < 213.75) return 'SSW';
    if (h >= 213.75 && h < 236.25) return 'SW (South-West)';
    if (h >= 236.25 && h < 258.75) return 'WSW';
    if (h >= 258.75 && h < 281.25) return 'W (West)';
    if (h >= 281.25 && h < 303.75) return 'WNW';
    if (h >= 303.75 && h < 326.25) return 'NW (North-West)';
    return 'NNW';
  }

  void _showStopDetailSheet(int index, Map<String, dynamic> stop) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: AppTheme.orange,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${index + 1}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stop['name']?.toString() ?? 'Stop ${index + 1}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.black,
                        ),
                      ),
                      Text(
                        'Route $_routeId · $_routeName',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.blackSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Coordinates',
                  style: TextStyle(fontSize: 13, color: AppTheme.blackSoft),
                ),
                Text(
                  '${(stop['lat'] as num).toStringAsFixed(4)}°N, ${(stop['lng'] as num).toStringAsFixed(4)}°E',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────
//  Metric Tile Component
// ────────────────────────────────────────────────────────────
class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final String unit;
  final Color color;
  final IconData icon;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.unit,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: AppTheme.black,
            ),
          ),
          Text(
            unit.isNotEmpty ? unit : label,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.5,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
