import 'package:audioplayers/audioplayers.dart';
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

/// Port of the web WakeAlarmModal: choose GPS or map → pick point →
/// threshold (1/2/5/custom km) → PUT /api/users/me/wake-alarm.
class WakeAlarmModal extends StatefulWidget {
  final VoidCallback onClose;

  const WakeAlarmModal({super.key, required this.onClose});

  @override
  State<WakeAlarmModal> createState() => _WakeAlarmModalState();
}

class _WakeAlarmModalState extends State<WakeAlarmModal> {
  String _step = 'choose'; // choose | gps | map | confirm
  LatLng? _position;
  double _thresholdKm = 2;
  bool _isCustomThreshold = false;
  final TextEditingController _customValue = TextEditingController();
  bool _loading = false;
  String _gpsStatus = 'idle'; // idle | loading | error
  final AudioPlayer _player = AudioPlayer();

  static const LatLng _invertisCenter = LatLng(28.3180, 79.4670);

  @override
  void dispose() {
    _customValue.dispose();
    _player.dispose();
    super.dispose();
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
          ApiClient.toast(context, 'Could not detect location. Try setting it on map.',
              kind: ToastKind.error);
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      if (!mounted) return;
      setState(() {
        _position = LatLng(pos.latitude, pos.longitude);
        _step = 'confirm';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _gpsStatus = 'error');
      ApiClient.toast(context, 'Could not detect location. Try setting it on map.',
          kind: ToastKind.error);
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
      ApiClient.toast(context,
          "⏰ Alarm set! We'll notify you when bus is within ${_thresholdKm % 1 == 0 ? _thresholdKm.toStringAsFixed(0) : _thresholdKm}km.",
          kind: ToastKind.success);
      widget.onClose();
    } else {
      ApiClient.toast(context,
          lang.lang == 'hi' ? 'अलार्म सेट नहीं हो सका। फिर कोशिश करें।' : 'Failed to set alarm. Please try again.',
          kind: ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final Color textDark = isDark ? AppColors.darkText : const Color(0xFF1E293B);
    final Color textMuted = isDark ? AppColors.darkTextMuted : const Color(0xFF64748B);
    final Color cardBg = isDark ? AppColors.darkCard : Colors.white;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 560),
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [BoxShadow(color: Color(0x80000000), blurRadius: 50, offset: Offset(0, 25))],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Header ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: isDark ? AppColors.darkBorder : const Color(0xFFF1F5F9))),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkSecondary : const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(LucideIcons.alarmClock, size: 20, color: Color(0xFF3B82F6)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.t('wakeAlarm'),
                              style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: textDark)),
                          Text(
                            lang.lang == 'hi' ? 'बस के पास आने पर सूचना पाएं' : 'Get notified when bus is near',
                            style: TextStyle(fontSize: 11.5, color: textMuted),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onClose,
                      icon: Icon(LucideIcons.x, size: 20, color: isDark ? AppColors.darkTextMuted : const Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),

              // ── Steps ──
              Flexible(
                child: SingleChildScrollView(
                  child: _buildStep(context, lang, isDark, textDark, textMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context, LanguageProvider lang, bool isDark, Color textDark, Color textMuted) {
    switch (_step) {
      case 'gps':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 44, horizontal: 24),
          child: _gpsStatus == 'loading'
              ? Column(
                  children: [
                    const Text('📡', style: TextStyle(fontSize: 40)),
                    const SizedBox(height: 12),
                    Text('Detecting your location...',
                        style: TextStyle(color: textMuted, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('Please allow location access when prompted',
                        style: TextStyle(color: textMuted.withValues(alpha: 0.7), fontSize: 12)),
                  ],
                )
              : Column(
                  children: [
                    const Text('❌', style: TextStyle(fontSize: 40)),
                    const SizedBox(height: 12),
                    const Text("Couldn't detect location",
                        style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w600)),
                    const SizedBox(height: 14),
                    Material(
                      color: const Color(0xFF3B82F6),
                      borderRadius: BorderRadius.circular(10),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: _useGps,
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                          child: Text('Try Again',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ),
                  ],
                ),
            );
      case 'map':
        return Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              color: isDark ? AppColors.darkSurface : const Color(0xFFF8FAFC),
              child: Text(
                lang.lang == 'hi'
                    ? 'अपना स्थान सेट करने के लिए मैप पर **टैप** करें या पिन को **खींचें**'
                    : 'Tap anywhere on the map or drag the pin to set your location',
                style: TextStyle(fontSize: 12, color: textMuted),
              ),
            ),
            SizedBox(
              height: 300,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: _position ?? _invertisCenter,
                  initialZoom: 15,
                  onTap: (_, latlng) => setState(() => _position = latlng),
                ),
                children: [
                  TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                  if (_position != null)
                    MarkerLayer(markers: [
                      Marker(
                        point: _position!,
                        width: 30,
                        height: 30,
                        child: const Icon(LucideIcons.mapPin, size: 28, color: Color(0xFF22C55E)),
                      ),
                    ]),
                ],
              ),
            ),
            if (_position != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                color: isDark ? AppColors.darkSecondary : const Color(0xFFF0FDF4),
                child: Text(
                  '📍 ${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                child: Material(
                  color: _position != null ? const Color(0xFF22C55E) : (isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: _position != null ? () => setState(() => _step = 'confirm') : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      child: Text(
                        lang.lang == 'hi' ? 'स्थान की पुष्टि करें →' : 'Confirm Location →',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _position != null ? Colors.white : const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w700,
                          fontSize: 14.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      case 'confirm':
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Location preview
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSecondary : const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.checkCircle, size: 18, color: Color(0xFF22C55E)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.lang == 'hi' ? 'स्थान सेट हो गया' : 'Location Set',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: textDark)),
                          Text(
                            '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
                            style: const TextStyle(color: Color(0xFF16A34A), fontSize: 11.5),
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      onTap: () => setState(() => _step = 'choose'),
                      child: Text(lang.lang == 'hi' ? 'बदलें' : 'Change',
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: textMuted)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Threshold
              Text(
                lang.lang == 'hi' ? 'मुझे सूचित करें जब बस इतने पास हो:' : 'Alert me when bus is within:',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textDark),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final km in const [1, 2, 5]) ...[
                    Expanded(child: _thresholdChip(km.toDouble(), isDark, textDark)),
                    if (km != 5) const SizedBox(width: 10),
                  ],
                  const SizedBox(width: 10),
                  Expanded(child: _customChip(isDark, textDark)),
                ],
              ),
              if (_isCustomThreshold) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _customValue,
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (v) {
                          final d = double.tryParse(v);
                          if (d != null && d > 0) setState(() => _thresholdKm = d);
                        },
                        decoration: InputDecoration(
                          hintText: 'Enter distance',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text('km', style: TextStyle(fontWeight: FontWeight.w600, color: textMuted)),
                  ],
                ),
              ],
              const SizedBox(height: 16),

              // Info box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSecondary : const Color(0xFFFEFCE8),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isDark ? AppColors.darkBorder : const Color(0xFFFDE68A)),
                ),
                child: Text(
                  lang.lang == 'hi'
                      ? "⚡ इसके बाद आपका GPS चालू रखने की ज़रूरत नहीं। सर्वर बस को ट्रैक करता है और आपके डिवाइस पर अपने आप पुश नोटिफिकेशन भेजता है।"
                      : "⚡ Your GPS doesn't need to be on after this. Our server tracks the bus and sends a push notification to your device automatically.",
                  style: TextStyle(
                      fontSize: 11.5, color: isDark ? AppColors.darkTextMuted : const Color(0xFF92400E), height: 1.5),
                ),
              ),
              const SizedBox(height: 16),

              // Confirm button
              Material(
                borderRadius: BorderRadius.circular(14),
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: _loading ? null : _confirm,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      gradient: _loading
                          ? const LinearGradient(colors: [Color(0xFF93C5FD), Color(0xFF93C5FD)])
                          : const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)]),
                    ),
                    child: Center(
                      child: _loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2.4, valueColor: AlwaysStoppedAnimation(Colors.white)))
                          : Text(
                              lang.lang == 'hi' ? '⏰ अलार्म सेट करें' : '⏰ Set Wake Alarm',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      default: // choose
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                lang.lang == 'hi'
                    ? 'अपना स्थान **एक बार** सेट करें। बाद में आपका GPS बंद हो तो भी, बस जब आपकी सेट त्रिज्या में आएगी तो अलार्म अपने आप बज जाएगा।'
                    : 'Set your location once. Even if your GPS is off later, the alarm fires automatically when the bus enters your set radius.',
                style: TextStyle(fontSize: 13, color: textMuted, height: 1.6),
              ),
              const SizedBox(height: 16),
              _MethodCard(
                icon: LucideIcons.navigation,
                iconBg: const Color(0xFF3B82F6),
                border: const Color(0xFFDBEAFE),
                bg: const Color(0xFFEFF6FF),
                title: '📍 ${lang.lang == 'hi' ? 'मेरा GPS उपयोग करें' : 'Use My GPS'}',
                subtitle: lang.lang == 'hi'
                    ? 'अपना वर्तमान स्थान अपने आप पहचानें'
                    : 'Auto-detect your current location',
                onTap: _useGps,
              ),
              const SizedBox(height: 12),
              _MethodCard(
                icon: LucideIcons.mapPin,
                iconBg: const Color(0xFF22C55E),
                border: const Color(0xFFDCFCE7),
                bg: const Color(0xFFF0FDF4),
                title: '🗺️ ${lang.lang == 'hi' ? 'मैप पर सेट करें' : 'Set on Map'}',
                subtitle: lang.lang == 'hi'
                    ? 'अपने सटीक बोर्डिंग स्थान पर पिन लगाएं'
                    : 'Drag a pin to your exact boarding spot',
                onTap: () => setState(() {
                  _position = _invertisCenter;
                  _step = 'map';
                }),
              ),
            ],
          ),
        );
    }
  }

  Widget _thresholdChip(double km, bool isDark, Color textDark) {
    final bool active = !_isCustomThreshold && _thresholdKm == km;
    return Material(
      color: active ? const Color(0xFFEFF6FF) : (isDark ? AppColors.darkCard : Colors.white),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => setState(() {
          _thresholdKm = km;
          _isCustomThreshold = false;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? const Color(0xFF3B82F6) : (isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)), width: 2),
          ),
          child: Center(
            child: Text('${km % 1 == 0 ? km.toStringAsFixed(0) : km} km',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: active ? const Color(0xFF1D4ED8) : textDark.withValues(alpha: 0.75))),
          ),
        ),
      ),
    );
  }

  Widget _customChip(bool isDark, Color textDark) {
    final bool active = _isCustomThreshold;
    return Material(
      color: active ? const Color(0xFFEFF6FF) : (isDark ? AppColors.darkCard : Colors.white),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => setState(() => _isCustomThreshold = true),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? const Color(0xFF3B82F6) : (isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0)), width: 2),
          ),
          child: Center(
            child: Text('Custom',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: active ? const Color(0xFF1D4ED8) : textDark.withValues(alpha: 0.75))),
          ),
        ),
      ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color border;
  final Color bg;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MethodCard({
    required this.icon,
    required this.iconBg,
    required this.border,
    required this.bg,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border, width: 2),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: Color(0xFF1E293B))),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Plays the wake-alarm beep loop (web used a WebAudio oscillator).
Future<void> playWakeAlarmSound() async {
  final player = AudioPlayer();
  await player.play(AssetSource('sounds/wake_alarm.wav'));
}

/// Plays the broadcast beep.
Future<void> playBroadcastSound() async {
  final player = AudioPlayer();
  await player.play(AssetSource('sounds/broadcast_beep.wav'));
}
