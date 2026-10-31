import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../providers/language_provider.dart';
import '../providers/tracking_provider.dart';
import '../services/api_client.dart';

/// Active alarm options modal: display current target location on a mini map,
/// change location, or turn off the alarm.
/// Styled 1:1 with the Web WakeAlarmOptionsModal and mobile WakeAlarmModal.
class WakeAlarmOptionsModal extends StatelessWidget {
  final VoidCallback onClose;
  final VoidCallback onChangeLocation;

  const WakeAlarmOptionsModal({
    super.key,
    required this.onClose,
    required this.onChangeLocation,
  });

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final tracking = context.watch<TrackingProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final cardBg = isDark ? AppColors.darkCard : Colors.white;
    final textDark = isDark ? AppColors.darkText : const Color(0xFF0F172A);
    final textMuted = isDark ? AppColors.darkTextMuted : const Color(0xFF64748B);
    final borderColor = isDark ? AppColors.darkBorder : const Color(0xFFE2E8F0);

    final alarmData = tracking.alarmData;
    final hasCoords = alarmData != null &&
        alarmData['lat'] != null &&
        alarmData['lng'] != null;

    final double lat = hasCoords ? (alarmData['lat'] as num).toDouble() : 0.0;
    final double lng = hasCoords ? (alarmData['lng'] as num).toDouble() : 0.0;
    final double thresholdKm = alarmData?['thresholdKm'] != null
        ? (alarmData!['thresholdKm'] as num).toDouble()
        : 2.0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
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
              // ── Header ──
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
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
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
                        Positioned(
                          top: 2,
                          right: 2,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              shape: BoxShape.circle,
                              border: Border.all(color: cardBg, width: 1.5),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lang.t('alarmActiveTitle'),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: textDark,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lang.t('alarmActiveSubtitle'),
                            style: TextStyle(
                              fontSize: 12,
                              color: textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: onClose,
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
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Mini Map Preview Card
                    if (hasCoords) ...[
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isDark
                                ? AppColors.darkBorder
                                : const Color(0xFFE2E8F0),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
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
                                    initialCenter: LatLng(lat, lng),
                                    initialZoom: 14,
                                    interactionOptions: const InteractionOptions(
                                      flags: InteractiveFlag.none,
                                    ),
                                  ),
                                  children: [
                                    TileLayer(
                                      urlTemplate:
                                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    ),
                                    CircleLayer(
                                      circles: [
                                        CircleMarker(
                                          point: LatLng(lat, lng),
                                          radius: thresholdKm * 1000,
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
                                          point: LatLng(lat, lng),
                                          width: 34,
                                          height: 34,
                                          child: const Icon(
                                            LucideIcons.mapPin,
                                            size: 32,
                                            color: Color(0xFF2563EB),
                                          ),
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
                                color: isDark
                                    ? AppColors.darkSurface
                                    : Colors.white,
                                border: Border(
                                  top: BorderSide(
                                    color: isDark
                                        ? AppColors.darkBorder
                                        : const Color(0xFFF1F5F9),
                                  ),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '📍 ${lat.toStringAsFixed(4)}°, ${lng.toStringAsFixed(4)}°',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: textMuted,
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF10B981),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 5),
                                      const Text(
                                        'Active Geofence',
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF10B981),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Option 1: Change Location
                    InkWell(
                      onTap: onChangeLocation,
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0x331E3A8A)
                              : const Color(0xFFF0F7FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFF1E40AF)
                                : const Color(0xFFBFDBFE),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: isDark
                                    ? const Color(0xFF1E3A8A)
                                    : const Color(0xFFDBEAFE),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                LucideIcons.mapPin,
                                color: Color(0xFF1D4ED8),
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lang.t('changeLocation'),
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? Colors.white : const Color(0xFF1E3A8A),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    lang.t('changeLocationSubtitle'),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF3B82F6),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              LucideIcons.chevronRight,
                              size: 18,
                              color: Color(0xFF60A5FA),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Option 2: Turn Off Alarm
                    InkWell(
                      onTap: () async {
                        onClose();
                        final ok = await tracking.cancelWakeAlarm();
                        if (context.mounted) {
                          ApiClient.toast(
                            context,
                            ok
                                ? '🔕 Wake alarm cancelled.'
                                : 'We could not cancel the alarm. Please try again.',
                            kind: ok ? ToastKind.success : ToastKind.error,
                          );
                        }
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0x33450A0A)
                              : const Color(0xFFFFF5F5),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFF7F1D1D)
                                : const Color(0xFFFECACA),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: isDark
                                    ? const Color(0xFF7F1D1D)
                                    : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                LucideIcons.bellOff,
                                color: Color(0xFFDC2626),
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lang.t('turnOffAlarm'),
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? Colors.white : const Color(0xFF991B1B),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    lang.t('turnOffAlarmSubtitle'),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFFEF4444),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              LucideIcons.chevronRight,
                              size: 18,
                              color: Color(0xFFF87171),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Dismiss / Keep Active Link
                    Center(
                      child: TextButton(
                        onPressed: onClose,
                        child: Text(
                          lang.t('keepAlarmActive'),
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: textMuted,
                          ),
                        ),
                      ),
                    ),
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
