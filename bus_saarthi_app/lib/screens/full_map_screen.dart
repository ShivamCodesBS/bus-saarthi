import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../providers/language_provider.dart';
import '../providers/tracking_provider.dart';
import 'home_screen.dart';

/// Port of the web "Expanded Map Modal": fullscreen tracking with the
/// route polyline and destination marker. The TrackingProvider instance
/// is passed in because full-screen routes sit outside HomeScreen's
/// provider scope.
class FullMapScreen extends StatelessWidget {
  final TrackingProvider tracking;

  const FullMapScreen({super.key, required this.tracking});

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();

    return ChangeNotifierProvider.value(
      value: tracking,
      child: Scaffold(
        backgroundColor: const Color(0xF20F172A),
        body: SafeArea(
          child: Column(
            children: [
              Container(
                color: const Color(0xFF1D4ED8),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 20, color: Colors.white),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        lang.t('fullScreenTracking'),
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(LucideIcons.x, size: 24, color: Colors.white),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: LiveBusMap(tracking: tracking),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
