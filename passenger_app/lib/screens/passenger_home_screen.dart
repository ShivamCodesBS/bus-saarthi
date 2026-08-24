import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../core/colors.dart';
import '../providers/auth_provider.dart';
import '../providers/lang_provider.dart';
import '../services/socket_service.dart';
import '../widgets/hamburger_menu.dart';
import '../widgets/floating_background.dart';

class PassengerHomeScreen extends StatefulWidget {
  const PassengerHomeScreen({super.key});

  @override
  State<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}

class _PassengerHomeScreenState extends State<PassengerHomeScreen> {
  final MapController _mapController = MapController();
  bool _sosActive = false;
  int? _sosTimer;
  bool _alarmSet = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final socket = Provider.of<SocketService>(context, listen: false);
      // Replace with actual backend URL
      socket.connect('http://localhost:3000', auth.user?.token ?? '');
    });
  }

  void _toggleSos() {
    setState(() {
      _sosActive = !_sosActive;
    });
    // Add logic to emit SOS to socket
  }

  void _toggleAlarm() {
    setState(() {
      _alarmSet = !_alarmSet;
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LangProvider>(context);
    final user = Provider.of<AuthProvider>(context).user;
    final socket = Provider.of<SocketService>(context);

    final LatLng busLocation = socket.telemetry['location'] != null
        ? LatLng(socket.telemetry['location']['lat'], socket.telemetry['location']['lng'])
        : const LatLng(28.3180, 79.4670);

    return FloatingBackground(
      iconColor: AppColors.primaryBlue,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        endDrawer: const HamburgerMenu(),
        body: SafeArea(
          child: Column(
          children: [
            _buildHeader(user, lang),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildActionButtons(lang),
                    const SizedBox(height: 24),
                    _buildTelemetryGrid(socket, lang),
                    const SizedBox(height: 24),
                    _buildRouteDetailsCard(socket, lang),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ));
  }

  Widget _buildHeader(UserModel? user, LangProvider lang) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.8),
            border: Border(bottom: BorderSide(color: Colors.grey.withValues(alpha: 0.2))),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBlue,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primaryBlue.withValues(alpha: 0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: const Icon(LucideIcons.bus, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      RichText(
                        text: TextSpan(
                          style: GoogleFonts.inter(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryBlue,
                          ),
                          children: const [
                            TextSpan(text: 'INVERTIS '),
                            TextSpan(
                              text: 'BUS SAARTHI',
                              style: TextStyle(color: AppColors.secondaryOrange),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '${lang.t('welcome')}, ${user?.name ?? 'Passenger'}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(LucideIcons.bell, color: Colors.black87),
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  Builder(
                    builder: (context) => GestureDetector(
                      onTap: () => Scaffold.of(context).openEndDrawer(),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        padding: const EdgeInsets.all(2),
                        child: Container(
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                          ),
                          child: Center(
                            child: Text(
                              (user?.name ?? 'P')[0].toUpperCase(),
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primaryBlue,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons(LangProvider lang) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onLongPress: () {
              // start 3s SOS timer
              _toggleSos();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 56,
              decoration: BoxDecoration(
                color: _sosActive ? const Color(0xFFFEF2F2) : const Color(0xFFE52B36),
                borderRadius: BorderRadius.circular(16),
                border: _sosActive ? Border.all(color: Colors.red) : null,
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.alertOctagon, size: 18, color: _sosActive ? Colors.red : Colors.white),
                  const SizedBox(width: 8),
                  Text(
                    _sosActive ? 'CANCEL SOS' : 'EMERGENCY',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _sosActive ? Colors.red : Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: _toggleAlarm,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 56,
              decoration: BoxDecoration(
                color: _alarmSet ? const Color(0xFFEEF6FF) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _alarmSet ? const Color(0xFF1D63ED) : Colors.grey.shade300),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.alarmClock, size: 18, color: _alarmSet ? const Color(0xFF1D63ED) : Colors.black87),
                  const SizedBox(width: 8),
                  Text(
                    _alarmSet ? 'Alarm On' : 'Wake Alarm',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _alarmSet ? const Color(0xFF1D63ED) : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTelemetryGrid(SocketService socket, LangProvider lang) {
    final speed = socket.telemetry['speed'] ?? 0;
    
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            icon: LucideIcons.gauge,
            label: 'Current Speed',
            value: '$speed',
            sub: 'km/h',
            color: const Color(0xFF3B82F6), // blue
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildStatCard(
            icon: LucideIcons.compass,
            label: 'Direction',
            value: 'North',
            sub: '',
            color: const Color(0xFF8B5CF6), // purple
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({required IconData icon, required String label, required String value, required String sub, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12, offset: Offset(0, 2))],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    value,
                    style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.black87),
                  ),
                  if (sub.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Text(
                      sub,
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade500),
                    ),
                  ]
                ],
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildRouteDetailsCard(SocketService socket, LangProvider lang) {
    final crowdStatus = socket.crowdStatus['status'] ?? 'Low';
    final filled = socket.crowdStatus['filled'] ?? 0;
    final total = socket.crowdStatus['total'] ?? 40;
    final fillRatio = total > 0 ? filled / total : 0.0;
    
    Color crowdColor = Colors.green;
    if (crowdStatus == 'Medium') crowdColor = Colors.orange;
    if (crowdStatus == 'Over Crowd') crowdColor = Colors.red;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Your Route Details',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primaryBlue),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    'Boarded',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.green.shade700),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Crowd predictor
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.orange.shade100),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(LucideIcons.users, size: 16, color: Colors.orange.shade600),
                              const SizedBox(width: 8),
                              Text('Live Crowd Status', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.orange.shade700)),
                            ],
                          ),
                          Text(crowdStatus, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: crowdColor)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: fillRatio,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation<Color>(crowdColor),
                        borderRadius: BorderRadius.circular(4),
                        minHeight: 8,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$filled/$total Seats Filled • ${crowdStatus == 'Over Crowd' ? 'Likely Standing' : 'Seats Available'}',
                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                // Map
                SizedBox(
                  height: 250,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: const LatLng(28.3180, 79.4670),
                        initialZoom: 15.0,
                        interactionOptions: const InteractionOptions(
                          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                        ),
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.invertis.bussaarthi',
                        ),
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: const LatLng(28.3180, 79.4670),
                              width: 40,
                              height: 40,
                              child: Image.network('https://cdn-icons-png.flaticon.com/512/3448/3448339.png'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
