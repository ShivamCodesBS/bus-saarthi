import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../providers/language_provider.dart';
import '../providers/tracking_provider.dart';
import '../services/api_client.dart';

/// Modal dialog to configure and activate the wake-up alarm.
/// Designed to be 100% unified with WakeAlarmOptionsModal.
class WakeAlarmModal extends StatefulWidget {
  final VoidCallback onClose;

  const WakeAlarmModal({super.key, required this.onClose});

  @override
  State<WakeAlarmModal> createState() => _WakeAlarmModalState();
}

class _WakeAlarmModalState extends State<WakeAlarmModal> {
  String _step = 'choose'; // 'choose' | 'gps' | 'map' | 'confirm'
  LatLng? _position;
  double _thresholdKm = 2;
  bool _isCustomThreshold = false;
  final TextEditingController _customValue = TextEditingController();
  final MapController _mapController = MapController();
  bool _loading = false;
  String _gpsStatus = 'idle'; // 'idle' | 'loading' | 'error'
  bool _isMoving = false;

  static const LatLng _invertisCenter = LatLng(28.3180, 79.4670);
  static const List<double> _kmOptions = [1, 2, 3, 5];

  @override
  void dispose() {
    _customValue.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _flyTo(LatLng target, [double zoom = 16]) {
    setState(() => _position = target);
    _mapController.move(target, zoom);
  }

  void _panBy(double dLng, double dLat) {
    final cur = _position ?? _invertisCenter;
    final target = LatLng(cur.latitude + dLat, cur.longitude + dLng);
    _flyTo(target, _mapController.camera.zoom);
  }

  Future<void> _locateMeOnMap() async {
    try {
      final status = await Permission.locationWhenInUse.request();
      if (!status.isGranted) {
        if (mounted) {
          ApiClient.toast(context, 'Location permission denied', kind: ToastKind.error);
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      if (!mounted) return;
      _flyTo(LatLng(pos.latitude, pos.longitude), 16);
      ApiClient.toast(context, 'Centered on your location', kind: ToastKind.success);
    } catch (_) {
      if (mounted) {
        ApiClient.toast(context, 'Could not get GPS location', kind: ToastKind.error);
      }
    }
  }

  Widget _buildFloatingMapButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
    Color color = const Color(0xFF0F172A),
    Color? borderColor,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor ?? const Color(0xFFCBD5E1), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }

  Future<void> _useGps() async {
    setState(() {
      _step = 'gps';
      _gpsStatus = 'loading';
    });
    try {
      final status = await Permission.locationWhenInUse.request();
      if (!status.isGranted) {
        setState(() => _gpsStatus = 'error');
        if (mounted) {
          ApiClient.toast(
            context,
            'Could not detect location. Try setting it on map.',
            kind: ToastKind.error,
          );
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (!mounted) return;
      setState(() {
        _position = LatLng(pos.latitude, pos.longitude);
        _step = 'confirm';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _gpsStatus = 'error');
      ApiClient.toast(
        context,
        'Could not detect location. Try setting it on map.',
        kind: ToastKind.error,
      );
    }
  }

  Future<void> _confirm() async {
    if (_position == null) return;
    setState(() => _loading = true);
    final tracking = context.read<TrackingProvider>();
    final lang = context.read<LanguageProvider>();
    final ok = await tracking.setWakeAlarm(
      lat: _position!.latitude,
      lng: _position!.longitude,
      thresholdKm: _thresholdKm,
    );
    if (!mounted) return;
    setState(() => _loading = false);
    if (ok) {
      ApiClient.toast(
        context,
        "⏰ Alarm set! We'll notify you when bus is within ${_thresholdKm % 1 == 0 ? _thresholdKm.toStringAsFixed(0) : _thresholdKm}km.",
        kind: ToastKind.success,
      );
      widget.onClose();
    } else {
      ApiClient.toast(
        context,
        lang.lang == 'hi'
            ? 'अलार्म सेट नहीं हो सका। फिर कोशिश करें।'
            : 'Failed to set alarm. Please try again.',
        kind: ToastKind.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final Color textDark = isDark ? AppColors.darkText : const Color(0xFF0F172A);
    final Color textMuted = isDark ? AppColors.darkTextMuted : const Color(0xFF64748B);
    final Color cardBg = isDark ? AppColors.darkCard : Colors.white;
    final Color borderColor = isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0);
    final bool isMapStep = _step == 'map';

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: isMapStep ? 540 : 440),
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 35,
                offset: const Offset(0, 15),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header - Matching WakeAlarmOptionsModal ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: isDark ? AppColors.darkBorder : const Color(0xFFF1F5F9),
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    if (_step != 'choose')
                      IconButton(
                        onPressed: () => setState(() => _step = 'choose'),
                        icon: const Icon(
                          LucideIcons.arrowLeft,
                          size: 20,
                          color: Color(0xFF2563EB),
                        ),
                        splashRadius: 20,
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0x332563EB)
                              : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          LucideIcons.alarmClock,
                          size: 22,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lang.lang == 'hi' ? 'जगाने का अलार्म सेट करें' : 'Set Wake-Up Alarm',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: textDark,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _step == 'choose'
                                ? (lang.lang == 'hi'
                                    ? 'बस नजदीक आने पर सूचना पाएं'
                                    : 'Get notified when bus is near')
                                : _step == 'map'
                                ? (lang.lang == 'hi'
                                    ? 'मैप घुमाकर पिन को स्टॉप पर सेट करें'
                                    : 'Pan map to place pin on your stop')
                                : (lang.lang == 'hi'
                                    ? 'अलार्म दायरा और पुष्टि'
                                    : 'Set trigger radius & confirm'),
                            style: TextStyle(
                              fontSize: 12,
                              color: textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onClose,
                      icon: Icon(
                        LucideIcons.x,
                        size: 20,
                        color: isDark ? AppColors.darkTextMuted : const Color(0xFF94A3B8),
                      ),
                      splashRadius: 20,
                    ),
                  ],
                ),
              ),

              // ── Body ──
              Padding(
                padding: const EdgeInsets.all(20),
                child: _buildStep(context, lang, isDark, textDark, textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(
    BuildContext context,
    LanguageProvider lang,
    bool isDark,
    Color textDark,
    Color textMuted,
  ) {
    switch (_step) {
      case 'gps':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
          child: _gpsStatus == 'loading'
              ? Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0x332563EB) : const Color(0xFFEFF6FF),
                        shape: BoxShape.circle,
                      ),
                      child: const SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation(Color(0xFF2563EB)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      lang.lang == 'hi' ? 'लोकेशन का पता लगाया जा रहा है...' : 'Detecting your location...',
                      style: TextStyle(
                        color: textDark,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      lang.lang == 'hi' ? 'प्रॉम्प्ट आने पर स्थान अनुमति दें' : 'Please allow location permission when prompted',
                      style: TextStyle(color: textMuted, fontSize: 12),
                    ),
                  ],
                )
              : Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0x33450A0A) : const Color(0xFFFEF2F2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(LucideIcons.mapPin, size: 28, color: Color(0xFFEF4444)),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      lang.lang == 'hi' ? 'लोकेशन नहीं मिल सकी' : "Couldn't detect location",
                      style: const TextStyle(
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        OutlinedButton(
                          onPressed: () => setState(() => _step = 'choose'),
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: Text(lang.lang == 'hi' ? 'वापस' : 'Back'),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          onPressed: () => setState(() {
                            _position = _invertisCenter;
                            _step = 'map';
                          }),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: Text(lang.lang == 'hi' ? 'मानचित्र पर चुनें' : 'Choose on Map'),
                        ),
                      ],
                    ),
                  ],
                ),
        );

      case 'map':
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.compass, size: 16, color: Color(0xFF2563EB)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      lang.lang == 'hi'
                          ? 'मैप ड्रैग करें या स्क्रीन एरो (↑ ↓ ← →) से पिन सेट करें'
                          : 'Drag map or use screen arrows (↑ ↓ ← →) to pan',
                      style: TextStyle(fontSize: 12, color: textMuted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Map View with Stationary Center Pin and Floating Controls
            Container(
              height: 340,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: isDark ? AppColors.darkBorder : const Color(0xFFCBD5E1), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _position ?? _invertisCenter,
                      initialZoom: 15,
                      onPositionChanged: (camera, hasGesture) {
                        if (hasGesture) {
                          setState(() {
                            _position = camera.center;
                            _isMoving = true;
                          });
                        }
                      },
                      onMapEvent: (evt) {
                        if (evt is MapEventMoveEnd) {
                          if (_isMoving) setState(() => _isMoving = false);
                        }
                      },
                      onTap: (_, latlng) {
                        _flyTo(latlng, _mapController.camera.zoom);
                      },
                    ),
                    children: [
                      TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                    ],
                  ),

                  // Center Pin Target (Uber/Google Maps style)
                  Center(
                    child: IgnorePointer(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        curve: Curves.easeOut,
                        transform: Matrix4.translationValues(0, _isMoving ? -14 : 0, 0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(12),
                                  topRight: Radius.circular(12),
                                  bottomLeft: Radius.circular(12),
                                  bottomRight: Radius.zero,
                                ),
                                border: Border.all(color: Colors.white, width: 2.5),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF2563EB).withValues(alpha: 0.45),
                                    blurRadius: 18,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              transform: Matrix4.rotationZ(-0.785398),
                              child: Center(
                                child: Transform.rotate(
                                  angle: 0.785398,
                                  child: const Icon(LucideIcons.mapPin, size: 18, color: Colors.white),
                                ),
                              ),
                            ),
                            const SizedBox(height: 3),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              width: _isMoving ? 7 : 12,
                              height: _isMoving ? 3 : 5,
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.35),
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Directional Pan Pad (Top Left)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            onTap: () => _panBy(0, 0.0015),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 30,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: const Icon(Icons.keyboard_arrow_up, size: 18, color: Color(0xFF1E293B)),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              InkWell(
                                onTap: () => _panBy(-0.0018, 0),
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  width: 30,
                                  height: 26,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: const Icon(Icons.keyboard_arrow_left, size: 18, color: Color(0xFF1E293B)),
                                ),
                              ),
                              const SizedBox(width: 4),
                              InkWell(
                                onTap: () => _panBy(0.0018, 0),
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  width: 30,
                                  height: 26,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: const Icon(Icons.keyboard_arrow_right, size: 18, color: Color(0xFF1E293B)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          InkWell(
                            onTap: () => _panBy(0, -0.0015),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 30,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF1E293B)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Floating Map Navigation Controls (Top Right)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildFloatingMapButton(
                          icon: Icons.add,
                          tooltip: lang.lang == 'hi' ? 'बड़ा करें (+)' : 'Zoom In (+)',
                          onTap: () {
                            final cur = _mapController.camera.zoom;
                            _mapController.move(_position ?? _invertisCenter, (cur + 1).clamp(3.0, 18.0));
                          },
                        ),
                        const SizedBox(height: 6),
                        _buildFloatingMapButton(
                          icon: Icons.remove,
                          tooltip: lang.lang == 'hi' ? 'छोटा करें (-)' : 'Zoom Out (-)',
                          onTap: () {
                            final cur = _mapController.camera.zoom;
                            _mapController.move(_position ?? _invertisCenter, (cur - 1).clamp(3.0, 18.0));
                          },
                        ),
                        const SizedBox(height: 6),
                        _buildFloatingMapButton(
                          icon: LucideIcons.crosshair,
                          color: const Color(0xFF2563EB),
                          borderColor: const Color(0xFFBFDBFE),
                          tooltip: lang.lang == 'hi' ? 'मेरी लोकेशन पर जाएं' : 'Go to My Location',
                          onTap: _locateMeOnMap,
                        ),
                      ],
                    ),
                  ),

                  // Floating Map Helper Badge (Bottom Left)
                  Positioned(
                    bottom: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A).withValues(alpha: 0.8),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.compass, size: 13, color: Color(0xFF60A5FA)),
                          const SizedBox(width: 5),
                          Text(
                            _isMoving
                                ? (lang.lang == 'hi' ? 'पिन सेट किया जा रहा है...' : 'Positioning pin...')
                                : (lang.lang == 'hi' ? 'पिन केंद्र में सेट है' : 'Pin fixed at center'),
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_position != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0x3310B981) : const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '📍 ${_position!.latitude.toStringAsFixed(4)}°, ${_position!.longitude.toStringAsFixed(4)}°',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF15803D), fontWeight: FontWeight.w600),
                    ),
                    Text(
                      lang.lang == 'hi' ? 'पिन सेट' : 'Pin Placed',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF16A34A), fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: _position != null ? () => setState(() => _step = 'confirm') : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: Text(
                lang.lang == 'hi' ? 'स्थान कन्फ़र्म करें →' : 'Confirm Location →',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
              ),
            ),
          ],
        );

      case 'confirm':
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Mini Map Preview with Radius Geofence Circle - Matching WakeAlarmOptionsModal
            if (_position != null) ...[
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)),
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    SizedBox(
                      height: 140,
                      width: double.infinity,
                      child: AbsorbPointer(
                        absorbing: true,
                        child: FlutterMap(
                          options: MapOptions(
                            initialCenter: _position!,
                            initialZoom: 14,
                            interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                          ),
                          children: [
                            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                            CircleLayer(
                              circles: [
                                CircleMarker(
                                  point: _position!,
                                  radius: _thresholdKm * 1000,
                                  useRadiusInMeter: true,
                                  color: const Color(0xFF2563EB).withValues(alpha: 0.22),
                                  borderColor: const Color(0xFF2563EB),
                                  borderStrokeWidth: 2,
                                ),
                              ],
                            ),
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: _position!,
                                  width: 34,
                                  height: 34,
                                  child: const Icon(LucideIcons.mapPin, size: 32, color: Color(0xFF2563EB)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkSurface : Colors.white,
                        border: Border(
                          top: BorderSide(color: isDark ? AppColors.darkBorder : const Color(0xFFF1F5F9)),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '📍 ${_position!.latitude.toStringAsFixed(4)}°, ${_position!.longitude.toStringAsFixed(4)}°',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: textMuted),
                          ),
                          InkWell(
                            onTap: () => setState(() => _step = 'map'),
                            child: Text(
                              lang.lang == 'hi' ? 'पिन बदलें' : 'Change Pin',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Radius Options
            Text(
              lang.lang == 'hi' ? 'अलार्म दायरा चुनें (दूरी):' : 'Alert me when bus is within:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: textDark),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                ..._kmOptions.map((km) {
                  final isSelected = !_isCustomThreshold && _thresholdKm == km;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: InkWell(
                        onTap: () => setState(() {
                          _thresholdKm = km;
                          _isCustomThreshold = false;
                        }),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? (isDark ? const Color(0x332563EB) : const Color(0xFFEFF6FF))
                                : (isDark ? AppColors.darkSurface : Colors.white),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF2563EB) : (isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)),
                              width: isSelected ? 2 : 1.5,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${km.toInt()} km',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? const Color(0xFF2563EB) : textDark,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _isCustomThreshold = true),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _isCustomThreshold
                            ? (isDark ? const Color(0x332563EB) : const Color(0xFFEFF6FF))
                            : (isDark ? AppColors.darkSurface : Colors.white),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _isCustomThreshold ? const Color(0xFF2563EB) : (isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)),
                          width: _isCustomThreshold ? 2 : 1.5,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        lang.lang == 'hi' ? 'अन्य' : 'Custom',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: _isCustomThreshold ? const Color(0xFF2563EB) : textDark,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            if (_isCustomThreshold) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _customValue,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (val) {
                        final v = double.tryParse(val);
                        if (v != null && v > 0) setState(() => _thresholdKm = v);
                      },
                      style: TextStyle(color: textDark, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: lang.lang == 'hi' ? 'दूरी (किमी)' : 'Distance in km',
                        hintStyle: TextStyle(color: textMuted, fontSize: 13),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('km', style: TextStyle(fontWeight: FontWeight.bold, color: textDark)),
                ],
              ),
            ],

            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? const Color(0x331E40AF) : const Color(0xFFF0F7FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFDBEAFE)),
              ),
              child: Text(
                '⚡ ${lang.lang == 'hi' ? 'इसके बाद आपका GPS चालू रहना ज़रूरी नहीं है। सर्वर ऑटोमैटिक अलर्ट भेजेगा।' : 'Your GPS does not need to stay on. The server will alert you automatically.'}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF1E40AF), height: 1.4),
              ),
            ),

            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: _loading ? null : _confirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                    )
                  : Text(
                      lang.lang == 'hi' ? 'अलार्म सक्रिय करें' : 'Activate Wake-Up Alarm',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                    ),
            ),
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () => setState(() => _step = 'choose'),
                child: Text(
                  lang.lang == 'hi' ? '← वापस विकल्प पर जाएं' : '← Back to Options',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: textMuted),
                ),
              ),
            ),
          ],
        );

      case 'choose':
      default:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              lang.lang == 'hi'
                  ? 'अपना स्टॉप एक बार सेट करें। बाद में GPS बंद होने पर भी बस तय दायरे में आते ही अलार्म बज जाएगा।'
                  : 'Set your stop location once. Even if your GPS is off later, the alarm will alert you automatically.',
              style: TextStyle(fontSize: 12.5, color: textMuted, height: 1.5),
            ),
            const SizedBox(height: 16),

            // Option 1: Current GPS Card - 1:1 match with WakeAlarmOptionsModal
            InkWell(
              onTap: _useGps,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0x331E3A8A) : const Color(0xFFF0F7FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark ? const Color(0xFF1E40AF) : const Color(0xFFBFDBFE),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E3A8A) : const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.navigation, color: Color(0xFF1D4ED8), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lang.lang == 'hi' ? 'वर्तमान GPS का उपयोग करें' : 'Use Current GPS',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : const Color(0xFF1E3A8A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lang.lang == 'hi' ? 'अपनी वर्तमान लोकेशन अपने आप ढूंढें' : 'Auto-detect your current boarding location',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF3B82F6)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 18, color: Color(0xFF60A5FA)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Option 2: Live Map Card - 1:1 match with WakeAlarmOptionsModal
            InkWell(
              onTap: () {
                _position ??= _invertisCenter;
                setState(() => _step = 'map');
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0x3314532D) : const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark ? const Color(0xFF166534) : const Color(0xFFBBF7D0),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF14532D) : const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.mapPin, color: Color(0xFF15803D), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lang.lang == 'hi' ? 'मानचित्र पर स्टॉप चुनें' : 'Select on Live Map',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : const Color(0xFF14532D),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lang.lang == 'hi' ? 'मानचित्र पर अपना सही पिक-अप पॉइंट चुनें' : 'Drag a pin to your exact pickup point',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF16A34A)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 18, color: Color(0xFF4ADE80)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            Center(
              child: TextButton(
                onPressed: widget.onClose,
                child: Text(
                  lang.lang == 'hi' ? 'रद्द करें' : 'Cancel',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: textMuted,
                  ),
                ),
              ),
            ),
          ],
        );
    }
  }
}
