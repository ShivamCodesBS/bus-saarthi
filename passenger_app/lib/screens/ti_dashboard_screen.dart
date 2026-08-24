import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/colors.dart';
import '../providers/auth_provider.dart';
import '../providers/lang_provider.dart';
import '../widgets/floating_background.dart';

class TiDashboardScreen extends StatefulWidget {
  const TiDashboardScreen({super.key});

  @override
  State<TiDashboardScreen> createState() => _TiDashboardScreenState();
}

class _TiDashboardScreenState extends State<TiDashboardScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LangProvider>(context);
    final user = Provider.of<AuthProvider>(context).user;

    final tabs = [
      _buildOverviewTab(),
      _buildRoutesTab(),
      _buildAlertsTab(),
    ];

    return FloatingBackground(
      iconColor: AppColors.tiGreen,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(65),
          child: _buildHeader(user, lang),
        ),
      body: tabs[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            )
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.tiGreen,
          unselectedItemColor: Colors.grey.shade500,
          selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 11),
          items: const [
            BottomNavigationBarItem(icon: Icon(LucideIcons.layoutDashboard), label: 'Live Operations'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.map), label: 'Active Routes'),
            BottomNavigationBarItem(icon: Icon(LucideIcons.alertOctagon), label: 'SOS Alerts'),
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
          padding: const EdgeInsets.symmetric(horizontal: 20),
          alignment: Alignment.bottomCenter,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            border: Border(bottom: BorderSide(color: AppColors.tiGreen.withValues(alpha: 0.5), width: 3)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12, top: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.tiGreen,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.tiGreen.withValues(alpha: 0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            )
                          ],
                        ),
                        child: const Icon(LucideIcons.car, color: Colors.white, size: 20), // T.I Icon
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'T.I. PANEL',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: const Icon(LucideIcons.bell, color: Colors.black87, size: 22),
                        onPressed: () {},
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.tiGreen,
                        ),
                        child: Center(
                          child: Text(
                            (user?.name ?? 'T')[0].toUpperCase(),
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              fontSize: 14,
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
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: _buildStatCard(LucideIcons.userCheck, 'Boarded Today', '458', Colors.green)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard(LucideIcons.activity, 'Active Trips', '4', Colors.blue)),
            ],
          ),
          const SizedBox(height: 24),
          _buildLiveAttendanceFeed(),
          const SizedBox(height: 24),
          _buildTiMapCard(),
        ],
      ),
    );
  }

  Widget _buildStatCard(IconData icon, String label, String value, Color iconColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveAttendanceFeed() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(bottom: BorderSide(color: Colors.green.shade100)),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.radio, color: AppColors.tiGreen, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Live Boarding Feed',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.green.shade800),
                ),
              ],
            ),
          ),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 3,
            itemBuilder: (context, index) {
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: const Center(child: Icon(LucideIcons.scanFace, color: Colors.blue, size: 20)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Passenger ${1234 + index}', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                          Text('Boarded Bus UP14XX1234', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600)),
                        ],
                      ),
                    ),
                    Text('Just now', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade500)),
                  ],
                ),
              );
            },
          )
        ],
      ),
    );
  }

  Widget _buildTiMapCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.tiGreen.withValues(alpha: 0.2)),
        boxShadow: [BoxShadow(color: AppColors.tiGreen.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.tiGreen.withValues(alpha: 0.05),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(bottom: BorderSide(color: AppColors.tiGreen.withValues(alpha: 0.1))),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.activity, color: AppColors.tiGreen, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Global Fleet Map',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.tiGreen),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              height: 250,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: const LatLng(28.3180, 79.4670),
                    initialZoom: 13.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.invertis.bussaarthi',
                    ),
                  ],
                ),
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildRoutesTab() {
    return Center(
      child: Text('T.I. Routes Management', style: GoogleFonts.inter(fontSize: 16)),
    );
  }

  Widget _buildAlertsTab() {
    return Center(
      child: Text('SOS Alerts Live Monitor', style: GoogleFonts.inter(fontSize: 16)),
    );
  }
}
