import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/auth_provider.dart';
import '../providers/sensor_provider.dart';
import '../providers/connection_provider.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import 'widgets/camera_preview_widget.dart';
import 'widgets/sensor_dashboard_widget.dart';
import 'widgets/loading_overlay.dart';
import 'settings_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key, this.mode}) : super(key: key);

  /// How this phone is being used:
  ///   driver     the driver's own phone — dashboard and navigation aid
  ///   busDevice  a device fixed inside the bus — sensors + face scanner
  final String? mode;

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

  /// True when this build runs as the device fixed inside the bus
  /// (sensors + face scanner) rather than as the driver's own phone.
  bool get _isBusDevice =>
      (widget.mode ?? AppConstants.appMode) == AppConstants.modeBusDevice;

  Future<void> _requestPermissionsAndStart() async {
    // The camera is only needed by the in-bus device, which runs the face
    // scanner. A driver's phone does not.
    if (_isBusDevice) {
      await Permission.camera.request();
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      await Geolocator.requestPermission();
    }

    await Permission.notification.request();

    if (_isBusDevice) {
      await Permission.sensors.request();
    }

    if (mounted) {
      setState(() { _permissionsGranted = true; });

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final sensors = Provider.of<SensorProvider>(context, listen: false);
      final routeId = auth.user?.routeId ?? AppConstants.defaultRouteId;
      // NOTE: Do NOT call sensors.socketService.connect() here.
      // The background isolate owns and manages the socket exclusively.
      // startSensors() sends a signal to the background service which
      // calls socketService.connect() inside the background isolate.
      if (_isBusDevice) {
        sensors.startSensors(routeId);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;

    // ── Driver phone ──────────────────────────────────────────────
    // The driver's own phone does not scan faces or run the bus
    // sensors — it is a dashboard and a navigation aid. Showing the
    // camera there would just drain the battery for nothing.
    if (!_isBusDevice) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(
          backgroundColor: AppTheme.background,
          elevation: 0,
          centerTitle: true,
          title: const Text(
            'Driver Panel',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppTheme.black,
            ),
          ),
        ),
        body: SafeArea(
          child: Consumer2<AuthProvider, ConnectionProvider>(
            builder: (context, auth, connection, _) {
              final user = auth.user;
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _DriverInfoCard(
                    name: user?.name ?? 'Driver',
                    loginId: user?.loginId ?? '',
                    routeId: user?.routeId ?? AppConstants.defaultRouteId,
                  ),
                  const SizedBox(height: 16),
                  _DriverStatusRow(
                    connected: connection.isConnected,
                  ),
                  const SizedBox(height: 16),
                  const _DriverModeNote(),
                ],
              );
            },
          ),
        ),
      );
    }

    // ── In-bus device ─────────────────────────────────────────────
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
          // Invertis University Logo + Brand
          Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  'assets/images/logo.png',
                  height: 26,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.school, color: AppTheme.orange, size: 20),
                ),
                const SizedBox(width: 6),
                const Text(
                  'BUS SARTHI',
                  style: TextStyle(
                    color: AppTheme.orange,
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),

          const Spacer(),

          // Switch to Driver Phone button
          GestureDetector(
            onTap: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.35),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white24),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.phone_android, size: 14, color: Colors.white),
                  SizedBox(width: 4),
                  Text(
                    'Driver Phone',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 10),

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

// ── Driver-mode widgets ─────────────────────────────────────────────
// These appear on the driver's own phone. The in-bus device uses the
// camera + telemetry layout instead.

class _DriverInfoCard extends StatelessWidget {
  const _DriverInfoCard({
    required this.name,
    required this.loginId,
    required this.routeId,
  });

  final String name;
  final String loginId;
  final String routeId;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 16,
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
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppTheme.accentColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.person,
                  color: AppTheme.accentColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.black,
                      ),
                    ),
                    Text(
                      loginId,
                      style: const TextStyle(
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
          const Divider(height: 1),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(
                Icons.directions_bus,
                size: 18,
                color: AppTheme.blackSoft,
              ),
              const SizedBox(width: 8),
              Text(
                'Assigned route',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.blackSoft,
                ),
              ),
              const Spacer(),
              Text(
                'Route $routeId',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.black,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DriverStatusRow extends StatelessWidget {
  const _DriverStatusRow({required this.connected});

  final bool connected;

  @override
  Widget build(BuildContext context) {
    final color = connected ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              connected
                  ? 'Connected to the transport server'
                  : 'Waiting for the transport server',
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.black,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DriverModeNote extends StatelessWidget {
  const _DriverModeNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.accentColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accentColor.withOpacity(0.25)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 18, color: AppTheme.blackSoft),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Running in driver mode. The sensors and the face scanner run on '
              'the device fitted inside the bus.',
              style: TextStyle(
                fontSize: 12.5,
                color: AppTheme.blackSoft,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
