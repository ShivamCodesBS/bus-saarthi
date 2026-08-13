import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import '../../providers/sensor_provider.dart';
import '../../providers/connection_provider.dart';
import '../../core/theme.dart';

class SensorDashboardWidget extends StatefulWidget {
  const SensorDashboardWidget({Key? key}) : super(key: key);

  @override
  State<SensorDashboardWidget> createState() => _SensorDashboardWidgetState();
}

class _SensorDashboardWidgetState extends State<SensorDashboardWidget> {
  String? _currentAddress;
  double? _lastGeoLat;
  double? _lastGeoLng;
  bool _isGeocoding = false;

  void _updateAddressIfNeeded(double? lat, double? lng) async {
    if (lat == null || lng == null || _isGeocoding) return;

    bool shouldUpdate = false;
    if (_lastGeoLat == null || _lastGeoLng == null) {
      shouldUpdate = true;
    } else {
      double distance = Geolocator.distanceBetween(_lastGeoLat!, _lastGeoLng!, lat, lng);
      if (distance > 50.0) shouldUpdate = true;
    }

    if (shouldUpdate) {
      _isGeocoding = true;
      try {
        List<Placemark> placemarks = await placemarkFromCoordinates(lat, lng);
        if (placemarks.isNotEmpty) {
          final place = placemarks.first;
          final address = '${place.name}, ${place.subLocality}, ${place.locality}';
          if (mounted) {
            setState(() {
              _currentAddress = address
                  .replaceAll(RegExp(r'^,\s*'), '')
                  .replaceAll(RegExp(r',\s*,'), ',');
              _lastGeoLat = lat;
              _lastGeoLng = lng;
            });
          }
        }
      } catch (e) {
        print('Reverse geocoding error: $e');
      } finally {
        if (mounted) setState(() { _isGeocoding = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SensorProvider>(
      builder: (context, sensorData, child) {
        final payload = sensorData.currentPayload;

        if (payload != null && payload.latitude != null && payload.longitude != null) {
          _updateAddressIfNeeded(payload.latitude, payload.longitude);
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Pull handle ──────────────────────────────────────
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // ── Section label ────────────────────────────────────
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: AppTheme.orange,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'LIVE TELEMETRY',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.0,
                      color: AppTheme.black,
                    ),
                  ),
                  const Spacer(),
                  // Live indicator — reflects real socket connection state
                  Consumer<ConnectionProvider>(
                    builder: (context, conn, _) {
                      final isLive = conn.isConnected && payload != null;
                      final color = isLive
                          ? const Color(0xFF22C55E)
                          : const Color(0xFFEF4444);
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.10),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: color.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: color,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              isLive ? 'LIVE' : 'OFFLINE',
                              style: TextStyle(
                                color: color,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // ── Speed + Heading ──────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: _GaugeCard(
                      title: 'SPEED',
                      unit: 'km/h',
                      value: payload?.mpuSpeedKmh.toStringAsFixed(1) ?? '--',
                      icon: Icons.speed_rounded,
                      color: const Color(0xFFFF6B00),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _GaugeCard(
                      title: 'HEADING',
                      unit: 'degrees',
                      value: payload?.headingDeg != null
                          ? '${payload!.headingDeg!.toStringAsFixed(0)}°'
                          : '--',
                      icon: Icons.explore_rounded,
                      color: const Color(0xFF6366F1),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // ── GPS Location ─────────────────────────────────────
              _LocationCard(
                lat: payload?.latitude,
                lng: payload?.longitude,
                address: _currentAddress,
              ),

              const SizedBox(height: 14),

              // ── Accelerometer Bars ───────────────────────────────
              _AccelCard(
                x: payload?.accelX ?? 0,
                y: payload?.accelY ?? 0,
                z: payload?.accelZ ?? 0,
              ),

              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}

// ────────────────────────────────────────────────────────────
//  Gauge card (Speed / Heading)
// ────────────────────────────────────────────────────────────
class _GaugeCard extends StatelessWidget {
  final String title;
  final String unit;
  final String value;
  final IconData icon;
  final Color color;

  const _GaugeCard({
    required this.title,
    required this.unit,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: AppTheme.black,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: TextStyle(
              fontSize: 10,
              color: AppTheme.blackSoft,
              letterSpacing: 1.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────
//  GPS Location card
// ────────────────────────────────────────────────────────────
class _LocationCard extends StatelessWidget {
  final double? lat;
  final double? lng;
  final String? address;

  const _LocationCard({this.lat, this.lng, this.address});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.location_on_rounded, color: Color(0xFF22C55E), size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LIVE GPS LOCATION',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppTheme.blackSoft,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  address ??
                      (lat != null
                          ? '${lat!.toStringAsFixed(5)}°N, ${lng!.toStringAsFixed(5)}°E'
                          : 'Acquiring satellite signal...'),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.black,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (address != null && lat != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${lat!.toStringAsFixed(5)}°, ${lng!.toStringAsFixed(5)}°',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.orange.withOpacity(0.8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────
//  Accelerometer card with axis bars
// ────────────────────────────────────────────────────────────
class _AccelCard extends StatelessWidget {
  final double x;
  final double y;
  final double z;
  const _AccelCard({required this.x, required this.y, required this.z});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.orange.withOpacity(0.10),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.vibration_rounded, color: AppTheme.orange, size: 20),
              ),
              const SizedBox(width: 12),
              const Text(
                'ACCELEROMETER (m/s²)',
                style: TextStyle(
                  fontSize: 10,
                  color: AppTheme.blackSoft,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _AxisBar(label: 'X', value: x, color: const Color(0xFFEF4444)),
          const SizedBox(height: 10),
          _AxisBar(label: 'Y', value: y, color: const Color(0xFF22C55E)),
          const SizedBox(height: 10),
          _AxisBar(label: 'Z', value: z, color: const Color(0xFF6366F1)),
        ],
      ),
    );
  }
}

class _AxisBar extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _AxisBar({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final normalized = ((value.clamp(-20.0, 20.0) + 20) / 40);
    return Row(
      children: [
        SizedBox(
          width: 16,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 12,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: normalized,
              minHeight: 10,
              backgroundColor: color.withOpacity(0.10),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 44,
          child: Text(
            value.toStringAsFixed(1),
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.black,
            ),
          ),
        ),
      ],
    );
  }
}
