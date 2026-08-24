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
import '../services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ParentDashboardScreen extends StatefulWidget {
  const ParentDashboardScreen({super.key});

  @override
  State<ParentDashboardScreen> createState() => _ParentDashboardScreenState();
}

class _ParentDashboardScreenState extends State<ParentDashboardScreen> {
  final MapController _mapController = MapController();
  final String _feeStatus = 'paid'; // 'paid', 'unpaid', 'partial'
  List<dynamic> _attendanceLogs = [];
  bool _isLoadingAttendance = true;

  @override
  void initState() {
    super.initState();
    _fetchAttendance();
  }

  Future<void> _fetchAttendance() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userStr = prefs.getString('bus_saarthi_user');
      if (userStr != null) {
        final api = ApiService(prefs);
        final user = Provider.of<AuthProvider>(context, listen: false).user;
        final response = await api.getAttendanceForUser(user?.loginId ?? '');
        if (response.data['success'] == true) {
          setState(() {
            _attendanceLogs = response.data['logs'] ?? [];
            _isLoadingAttendance = false;
          });
        }
      }
    } catch (e) {
      setState(() => _isLoadingAttendance = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LangProvider>(context);
    final user = Provider.of<AuthProvider>(context).user;

    return FloatingBackground(
      iconColor: AppColors.parentPurple,
      child: Scaffold(
        backgroundColor: Colors.transparent,
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
                    _buildStatsRow(),
                    const SizedBox(height: 24),
                    _buildStudentCard(),
                    const SizedBox(height: 24),
                    _buildMapCard(),
                    const SizedBox(height: 24),
                    _buildAttendanceCalendar(),
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
                      color: AppColors.parentPurple,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.parentPurple.withValues(alpha: 0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: const Icon(LucideIcons.heart, color: Colors.white, size: 24),
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
                            color: AppColors.parentPurple,
                          ),
                          children: const [
                            TextSpan(text: 'PARENT '),
                            TextSpan(
                              text: 'PANEL',
                              style: TextStyle(color: AppColors.primaryBlue),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '${lang.t('welcome')}, ${user?.name ?? 'Parent'}',
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
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [AppColors.parentPurple, Color(0xFFEC4899)],
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
                            color: AppColors.parentPurple,
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

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            icon: LucideIcons.calendarCheck,
            label: 'Total Present',
            value: '42',
            sub: 'Days',
            color: Colors.green,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildStatCard(
            icon: LucideIcons.percent,
            label: 'Attendance',
            value: '92',
            sub: '%',
            color: AppColors.parentPurple,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({required IconData icon, required String label, required String value, required String sub, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
                      const SizedBox(width: 2),
                      Text(
                        sub,
                        style: GoogleFonts.inter(fontSize: 10, color: Colors.grey.shade500),
                      ),
                    ]
                  ],
                ),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildStudentCard() {
    Color badgeColor = Colors.green;
    Color badgeBgColor = const Color(0xFFE6FAE6);
    String badgeText = '✅ Fee Paid';

    if (_feeStatus == 'unpaid') {
      badgeColor = const Color(0xFFCF1322);
      badgeBgColor = const Color(0xFFFFF1F0);
      badgeText = '❌ Fee Unpaid';
    } else if (_feeStatus == 'partial') {
      badgeColor = const Color(0xFFD46B08);
      badgeBgColor = const Color(0xFFFFFBE6);
      badgeText = '⚠️ Partial Fee';
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12, offset: Offset(0, 2))],
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: AppColors.parentPurple.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Icon(LucideIcons.user, color: AppColors.parentPurple, size: 32),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Student Name', // Fetch from provider later
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.black87),
                ),
                const SizedBox(height: 4),
                Text(
                  'Route 1 • Bus UP14XX1234',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: badgeBgColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              badgeText,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: badgeColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.parentPurple.withValues(alpha: 0.2)),
        boxShadow: [BoxShadow(color: AppColors.parentPurple.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.parentPurple.withValues(alpha: 0.05),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(bottom: BorderSide(color: AppColors.parentPurple.withValues(alpha: 0.1))),
            ),
            child: Row(
              children: [
                Icon(LucideIcons.mapPin, color: AppColors.parentPurple, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Live Bus Location',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.parentPurple),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: SizedBox(
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
          )
        ],
      ),
    );
  }

  Widget _buildAttendanceCalendar() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'August 2026', // Dynamic in real app
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black87),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.parentPurple.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(LucideIcons.chevronLeft, size: 16, color: AppColors.parentPurple),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.parentPurple.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(LucideIcons.chevronRight, size: 16, color: AppColors.parentPurple),
                  ),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          // Simple mock grid
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => 
              SizedBox(width: 30, child: Center(child: Text(d, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade500))))
            ).toList(),
          ),
          const SizedBox(height: 8),
          _isLoadingAttendance ? const Center(child: CircularProgressIndicator(color: AppColors.parentPurple)) : GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 31, // days in month
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 4,
              mainAxisSpacing: 8,
              childAspectRatio: 1.0,
            ),
            itemBuilder: (context, index) {
              final day = index + 1;
              // Very basic mock check logic based on index for fallback if API returns empty
              bool isPresent = false;
              if (_attendanceLogs.isNotEmpty) {
                 isPresent = _attendanceLogs.any((log) {
                   if (log['date'] == null) return false;
                   try {
                     final d = DateTime.parse(log['date']);
                     return d.day == day;
                   } catch (_) { return false; }
                 });
              } else {
                 isPresent = day % 2 == 0; // fallback mock
              }

              return Container(
                decoration: BoxDecoration(
                  color: isPresent ? AppColors.parentPurple.withValues(alpha: 0.15) : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: isPresent ? null : Border.all(color: Colors.grey.shade200),
                ),
                child: Center(
                  child: Text(
                    '$day',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: isPresent ? FontWeight.w700 : FontWeight.w500,
                      color: isPresent ? AppColors.parentPurple : Colors.black87,
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          // Legend
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildLegend(const Color(0xFFE6FAE6), const Color(0xFF28A745), 'Present'),
              const SizedBox(width: 16),
              _buildLegend(const Color(0xFFFFF1F0), const Color(0xFFCF1322), 'Absent'),
              const SizedBox(width: 16),
              _buildLegend(AppColors.parentPurple, Colors.white, 'Today'),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildLegend(Color bg, Color border, String label) {
    return Row(
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade600),
        ),
      ],
    );
  }
}
