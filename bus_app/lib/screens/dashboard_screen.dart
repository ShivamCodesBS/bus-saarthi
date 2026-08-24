import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/auth_provider.dart';
import '../providers/sensor_provider.dart';
import '../providers/connection_provider.dart';
import '../core/theme.dart';
import 'widgets/camera_preview_widget.dart';
import 'widgets/sensor_dashboard_widget.dart';
import 'widgets/loading_overlay.dart';
import 'settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _permissionsGranted = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _requestPermissionsAndStart();
  }

  Future<void> _requestPermissionsAndStart() async {
    await Permission.camera.request();

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      await Geolocator.requestPermission();
    }

    await Permission.notification.request();
    await Permission.sensors.request();

    if (mounted) {
      setState(() { _permissionsGranted = true; });

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final sensors = Provider.of<SensorProvider>(context, listen: false);
      final routeId = auth.user?.routeId ?? '4';
      // NOTE: Do NOT call sensors.socketService.connect() here.
      // The background isolate owns and manages the socket exclusively.
      // startSensors() sends a signal to the background service which
      // calls socketService.connect() inside the background isolate.
      sensors.startSensors(routeId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Stack(
        children: [
          // ── Top: Camera face-scan section ──────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            // ✅ Camera takes 58% of screen — more visible face-scan area
            height: screenH * 0.58,
            child: _CameraSectionHeader(permissionsGranted: _permissionsGranted),
          ),

          // ── Bottom: Live Telemetry panel ───────────────────────────
          // ✅ Pushed lower to 55% — so camera scan area is fully visible
          Positioned(
            top: screenH * 0.55,
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 24,
                    spreadRadius: 0,
                    offset: const Offset(0, -6),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                child: const SensorDashboardWidget(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────
//  Camera Section — AppBar overlay + face scan camera feed
// ────────────────────────────────────────────────────────────
class _CameraSectionHeader extends StatelessWidget {
  final bool permissionsGranted;
  const _CameraSectionHeader({required this.permissionsGranted});

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera feed (black bg while loading)
        Container(
          color: const Color(0xFF111111),
          child: permissionsGranted
              ? const CameraPreviewWidget()
              : const Center(
                  child: BusSarthiLoader(
                    size: 72,
                    label: 'Requesting Permissions',
                    ringColor: Color(0xFFFF6B00),
                    dotColor: Color(0xFFFF6B00),
                  ),
                ),
        ),

        // Top gradient overlay for AppBar readability
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 110,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xCC000000), Colors.transparent],
              ),
            ),
          ),
        ),

        // AppBar content
        Positioned(
          top: MediaQuery.of(context).padding.top + 8,
          left: 0,
          right: 0,
          child: _buildAppBar(context),
        ),

        // Bottom fade to white
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [Colors.white, Colors.transparent],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Logo / Brand
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.orange,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              'BUS SARTHI',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 13,
                letterSpacing: 1.5,
              ),
            ),
          ),

          const Spacer(),

          // Connection badge
          _buildConnectionBadge(context),

          const SizedBox(width: 10),

          // Settings button
          GestureDetector(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.35),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white24),
              ),
              child: const Icon(Icons.settings_rounded, size: 20, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConnectionBadge(BuildContext context) {
    return Consumer<ConnectionProvider>(
      builder: (context, connection, _) {
        final isConnected = connection.isConnected;
        final color = isConnected ? const Color(0xFF22C55E) : const Color(0xFFEF4444);

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.35),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withOpacity(0.6)),
            boxShadow: isConnected
                ? [BoxShadow(color: color.withOpacity(0.25), blurRadius: 8)]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pulsing dot
              _PulsingDot(color: color, active: isConnected),
              const SizedBox(width: 7),
              Text(
                isConnected ? 'LIVE' : 'OFFLINE',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w900,
                  fontSize: 11,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ──────────────────────────────────────────────
//  Animated pulsing status dot
// ──────────────────────────────────────────────
class _PulsingDot extends StatefulWidget {
  final Color color;
  final bool active;
  const _PulsingDot({required this.color, required this.active});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return Container(
        width: 8, height: 8,
        decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color),
      );
    }
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: 8, height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: widget.color.withOpacity(_anim.value),
          boxShadow: [
            BoxShadow(color: widget.color.withOpacity(_anim.value * 0.5), blurRadius: 4, spreadRadius: 1),
          ],
        ),
      ),
    );
  }
}
