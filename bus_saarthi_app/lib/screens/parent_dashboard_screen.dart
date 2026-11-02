import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/stop_coords.dart';
import '../core/theme.dart';
import '../models/grievance_model.dart';
import '../models/route_model.dart';
import '../providers/auth_provider.dart';
import '../providers/parent_provider.dart';
import '../providers/theme_provider.dart';
import '../widgets/floating_icons_background.dart';
import '../widgets/user_avatar.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

const Color kPurple = Color(0xFF7C3AED);
const Color kPurpleLight = Color(0xFFF3E8FF);
const Color kPurpleDark = Color(0xFF6D28D9);

/// 100% 1:1 Port of Web ParentDashboard.jsx:
/// - Header: Parent Portal, Welcome subtitle, User Avatar dropdown sheet
/// - Multi-Student Switcher with active pill & "● On Bus" live status badge
/// - Mobile 5-Tab Bottom Nav: Overview, Attendance, Complaints, Notices, Analytics
/// - Overview: Merge banner, 3-state Hero card, Upfront Driver card with Direct Call buttons & Stop chips, Collapsible Live Map with collapsed HUD preview, 4-stat 2x2 grid
/// - Attendance: 3-stat summary (Present, Absent, %), Monthly Calendar, Mark Leave for Student, Recent Attendance Log
/// - Complaints: Grievance lifecycle states (Pending, In Progress, Awaiting Confirmation, Reopened, Closed), Admin response, Yes Fixed & Reopen actions
/// - Notices: Broadcast meta tags (Urgent Alert, Route Update, Notice) with urgency badges
/// - Analytics: Date picker, FL Chart speed curve with speed limit reference line, Current Journey Status 2x2 grid
class ParentDashboardScreen extends StatelessWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const LoginScreen();
    }
    return ChangeNotifierProvider(
      create: (_) {
        final p = ParentProvider(user);
        WidgetsBinding.instance.addPostFrameCallback((_) => p.load());
        return p;
      },
      child: const _ParentView(),
    );
  }
}

class _ParentView extends StatefulWidget {
  const _ParentView();

  @override
  State<_ParentView> createState() => _ParentViewState();
}

class _ParentViewState extends State<_ParentView> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ParentProvider>().attachToastContext(context);
    });
  }

  void _onTabSelected(int index) {
    setState(() => _currentIndex = index);
    if (index == 4) {
      final now = DateTime.now();
      final date =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      context.read<ParentProvider>().fetchSpeedAnalytics(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final parent = context.watch<ParentProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkBg : AppColors.lightBg;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;

    if (parent.isLoading && parent.children.isEmpty) {
      return Scaffold(
        backgroundColor: bg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 44,
                height: 44,
                child: CircularProgressIndicator(
                  strokeWidth: 3.5,
                  color: kPurple,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Loading Parent Portal...',
                style: TextStyle(
                  color: kPurple,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final activeGrievancesCount = parent.childGrievances
        .where((g) => g.status != 'closed')
        .length;

    return Scaffold(
      backgroundColor: bg,
      body: Column(
        children: [
          // ── HEADER (Consistent with Web Header) ──
          Container(
            decoration: BoxDecoration(
              color: cardBg,
              border: Border(bottom: BorderSide(color: borderColor)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    // University Logo
                    Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorder
                              : const Color(0xFFE2E8F0),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Image.asset(
                        'assets/images/logo.png',
                        errorBuilder: (_, __, ___) => const Icon(
                          LucideIcons.bus,
                          color: kPurple,
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Portal Title & Welcome Subtitle
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(
                            TextSpan(
                              text: 'Parent ',
                              style: TextStyle(
                                color: textDark,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                              ),
                              children: const [
                                TextSpan(
                                  text: 'Portal',
                                  style: TextStyle(color: kPurple),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Welcome, ${parent.user.name.isNotEmpty ? parent.user.name : "Guardian"}',
                            style: TextStyle(
                              color: textLight,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Profile Avatar with gradient ring
                    InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: () => _showProfileMenu(context, parent),
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [
                              kPurple,
                              Color(0xFFA855F7),
                              Color(0xFFEC4899),
                            ],
                          ),
                        ),
                        child: UserAvatar(
                          src: null,
                          name: parent.user.name.isNotEmpty
                              ? parent.user.name
                              : 'Guardian',
                          size: 34,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── MULTI-STUDENT SWITCHER (Web Horizontal Pill Bar) ──
          if (parent.childCount > 1) ...[
            Container(
              decoration: BoxDecoration(
                color: cardBg,
                border: Border(bottom: BorderSide(color: borderColor)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text(
                    'STUDENTS:',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: textLight,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: List.generate(parent.childCount, (idx) {
                          final ch = parent.children[idx];
                          final isSelected = idx == parent.selectedChildIndex;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(20),
                              onTap: () => parent.selectChild(idx),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? kPurple.withValues(alpha: 0.16)
                                      : (isDark
                                            ? AppColors.darkSurface
                                            : const Color(0xFFF1F5F9)),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? kPurple : borderColor,
                                    width: isSelected ? 1.8 : 1,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      ch.name,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: isSelected
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: isSelected ? kPurple : textDark,
                                      ),
                                    ),
                                    if (ch.routeId != null) ...[
                                      const SizedBox(width: 4),
                                      Text(
                                        '· R${ch.routeId}',
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          color: isSelected
                                              ? kPurple
                                              : textLight,
                                        ),
                                      ),
                                    ],
                                    if (ch.boardedToday) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 5,
                                          vertical: 1.5,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(
                                            0xFF22C55E,
                                          ).withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(
                                            6,
                                          ),
                                        ),
                                        child: const Text(
                                          '● On Bus',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF16A34A),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── TAB CONTENT ──
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: FloatingIconsBackground(
                    isDark: isDark,
                    iconColor: const Color(0xFF8B5CF6),
                  ),
                ),
                IndexedStack(
                  index: _currentIndex,
                  children: [
                    _OverviewTab(
                      parent: parent,
                      isDark: isDark,
                      textDark: textDark,
                      textLight: textLight,
                      borderColor: borderColor,
                      cardBg: cardBg,
                      onNavigateToTab: _onTabSelected,
                    ),
                    _AttendanceTab(
                      parent: parent,
                      isDark: isDark,
                      textDark: textDark,
                      textLight: textLight,
                      borderColor: borderColor,
                      cardBg: cardBg,
                    ),
                    _ComplaintsTab(
                      parent: parent,
                      isDark: isDark,
                      textDark: textDark,
                      textLight: textLight,
                      borderColor: borderColor,
                      cardBg: cardBg,
                    ),
                    _AnnouncementsTab(
                      parent: parent,
                      isDark: isDark,
                      textDark: textDark,
                      textLight: textLight,
                      borderColor: borderColor,
                      cardBg: cardBg,
                    ),
                    _AnalyticsTab(
                      parent: parent,
                      isDark: isDark,
                      textDark: textDark,
                      textLight: textLight,
                      borderColor: borderColor,
                      cardBg: cardBg,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),

      // ── MOBILE BOTTOM NAVIGATION (Matching Web Order: Overview, Attendance, Complaints, Notices, Analytics) ──
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: cardBg,
          border: Border(top: BorderSide(color: borderColor)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.08),
              blurRadius: 16,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, LucideIcons.bus, 'Overview'),
                _buildNavItem(1, LucideIcons.calendar, 'Attendance'),
                _buildNavItem(
                  2,
                  LucideIcons.messageSquareWarning,
                  'Complaints',
                  badgeCount: activeGrievancesCount,
                ),
                _buildNavItem(
                  3,
                  LucideIcons.megaphone,
                  'Notices',
                  badgeCount: parent.broadcasts.length,
                ),
                _buildNavItem(4, LucideIcons.activity, 'Analytics'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    int index,
    IconData icon,
    String label, {
    int badgeCount = 0,
  }) {
    final isSelected = _currentIndex == index;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textMuted = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;

    return InkWell(
      onTap: () => _onTabSelected(index),
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? kPurple.withValues(alpha: 0.25) : kPurpleLight)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 19, color: isSelected ? kPurple : textMuted),
                if (badgeCount > 0)
                  Positioned(
                    right: -7,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 14,
                        minHeight: 14,
                      ),
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                color: isSelected ? kPurple : textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showProfileMenu(BuildContext context, ParentProvider parent) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: borderColor),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  UserAvatar(src: null, name: parent.user.name, size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          parent.user.name,
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: textDark,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Parent / Guardian · ${parent.user.loginId}',
                          style: TextStyle(
                            fontSize: 12,
                            color: textLight,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Divider(color: borderColor),
              const SizedBox(height: 8),

              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: kPurple.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isDark ? LucideIcons.moon : LucideIcons.sun,
                    color: kPurple,
                    size: 20,
                  ),
                ),
                title: Text(
                  'Dark Mode',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                    color: textDark,
                  ),
                ),
                trailing: Switch(
                  value: isDark,
                  activeColor: kPurple,
                  onChanged: (val) {
                    context.read<ThemeProvider>().setDarkMode(val);
                  },
                ),
              ),

              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    LucideIcons.settings,
                    color: Color(0xFF2563EB),
                    size: 20,
                  ),
                ),
                title: Text(
                  'Settings & Preferences',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                    color: textDark,
                  ),
                ),
                trailing: const Icon(LucideIcons.chevronRight, size: 18),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),

              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    LucideIcons.logOut,
                    color: Color(0xFFEF4444),
                    size: 20,
                  ),
                ),
                title: const Text(
                  'Sign Out',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                    color: Color(0xFFEF4444),
                  ),
                ),
                onTap: () async {
                  Navigator.pop(ctx);
                  await context.read<AuthProvider>().logout();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW TAB
// ═════════════════════════════════════════════════════════════════════════

class _OverviewTab extends StatefulWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;
  final ValueChanged<int> onNavigateToTab;

  const _OverviewTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
    required this.onNavigateToTab,
  });

  @override
  State<_OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends State<_OverviewTab> {
  bool _isMapExpanded = false;

  @override
  Widget build(BuildContext context) {
    final parent = widget.parent;
    final child = parent.child;
    final isSunday = DateTime.now().weekday == DateTime.sunday;
    final boarded = child?.boardedToday ?? false;

    return RefreshIndicator(
      color: kPurple,
      onRefresh: () => parent.refresh(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          // ── Merge Notification Banner ──
          if (parent.mergeInfo != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFF97316), Color(0xFFEA580C)],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF97316).withValues(alpha: 0.25),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    LucideIcons.gitMerge,
                    size: 24,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '🚌 Bus Route Changed Today',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          "Your child's regular bus was merged into Bus ${parent.mergeInfo!.targetBusNumber} (${parent.mergeInfo!.targetRouteName}) today. Live tracking is automatically showing the active bus.",
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.95),
                            fontSize: 12,
                            height: 1.4,
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

          // ── Today's Status Hero Card (3 States with Web RGBA Safeguards) ──
          Builder(
            builder: (context) {
              Color heroBg;
              Color heroBorder;
              Color iconBg;
              IconData iconData;
              String title;
              String subtitle;
              Color subColor;

              if (boarded) {
                heroBg = const Color(0xFF22C55E).withValues(alpha: 0.12);
                heroBorder = const Color(0xFF22C55E).withValues(alpha: 0.40);
                iconBg = const Color(0xFF16A34A);
                iconData = LucideIcons.checkCircle2;
                title = 'Child Boarded the Bus';
                subtitle =
                    'Face recognized at ${_fmtTime(child?.boardedAt)} today';
                subColor = const Color(0xFF16A34A);
              } else if (isSunday) {
                heroBg = kPurple.withValues(alpha: 0.08);
                heroBorder = kPurple.withValues(alpha: 0.25);
                iconBg = kPurple;
                iconData = LucideIcons.calendar;
                title = 'Weekend — No Scheduled Bus Today';
                subtitle =
                    "It's Sunday! Regular campus transit service resumes Monday morning.";
                subColor = widget.textLight;
              } else {
                heroBg = const Color(0xFFEF4444).withValues(alpha: 0.10);
                heroBorder = const Color(0xFFEF4444).withValues(alpha: 0.35);
                iconBg = const Color(0xFFEF4444);
                iconData = LucideIcons.xCircle;
                title = 'Not Boarded Yet';
                subtitle = 'Not marked present on the bus yet today';
                subColor = const Color(0xFFEF4444);
              }

              return Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: heroBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: heroBorder, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: iconBg,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: iconBg.withValues(alpha: 0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Icon(iconData, size: 28, color: Colors.white),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: widget.textDark,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: subColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 14),

          // ── Route & Assigned Driver Card (UP FRONT for quick access) ──
          if (parent.routeInfo != null || child?.routeId != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: widget.cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: widget.borderColor),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Bus & Route strip with Live indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: kPurple.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                LucideIcons.bus,
                                color: kPurple,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    parent.mergeInfo != null
                                        ? 'Bus ${parent.mergeInfo!.targetBusNumber}'
                                        : (parent.routeInfo?.busNumber != null
                                              ? 'Bus ${parent.routeInfo!.busNumber}'
                                              : 'Route ${child?.routeId ?? ''}'),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14.5,
                                      letterSpacing: -0.2,
                                      color: widget.textDark,
                                    ),
                                  ),
                                  Text(
                                    parent.mergeInfo?.targetRouteName ??
                                        parent.routeInfo?.routeName ??
                                        'Assigned Transit Route',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w500,
                                      color: widget.textLight,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color:
                              parent.telemetry != null && !parent.telemetryStale
                              ? const Color(0xFF22C55E).withValues(alpha: 0.15)
                              : widget.textLight.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    parent.telemetry != null &&
                                        !parent.telemetryStale
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFF9CA3AF),
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              parent.telemetry != null && !parent.telemetryStale
                                  ? 'Active'
                                  : 'Offline',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color:
                                    parent.telemetry != null &&
                                        !parent.telemetryStale
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Assigned Driver sub-card
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: widget.isDark
                          ? AppColors.darkSurface
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: widget.borderColor),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: kPurple.withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: kPurple.withValues(alpha: 0.3),
                                ),
                              ),
                              child: const Icon(
                                LucideIcons.user,
                                size: 18,
                                color: kPurple,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'ASSIGNED DRIVER',
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w800,
                                      color: widget.textLight,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  Text(
                                    parent.routeInfo?.driver?.name ??
                                        'Assigned Driver',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                      color: widget.textDark,
                                    ),
                                  ),
                                  Text(
                                    parent.routeInfo?.driver?.phone ??
                                        'Contact via Transport Office',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      color: widget.textLight,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Direct CTA Buttons
                        Row(
                          children: [
                            if (parent.routeInfo?.driver?.phone != null &&
                                parent
                                    .routeInfo!
                                    .driver!
                                    .phone!
                                    .isNotEmpty) ...[
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF16A34A),
                                    foregroundColor: Colors.white,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 9,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                  onPressed: () => _dialPhone(
                                    parent.routeInfo!.driver!.phone!,
                                  ),
                                  icon: const Icon(LucideIcons.phone, size: 14),
                                  label: const Text(
                                    'Call Driver',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 9,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                onPressed: () => _dialPhone('+915812460442'),
                                icon: const Icon(
                                  LucideIcons.phoneCall,
                                  size: 14,
                                ),
                                label: const Text(
                                  'Transport Desk',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Route Stops Chips
                  if (parent.routeInfo != null &&
                      parent.routeInfo!.stopsList.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      'ROUTE STOPS (${parent.routeInfo!.stopsList.length})',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: widget.textLight,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    SizedBox(
                      height: 32,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: parent.routeInfo!.stopsList.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 6),
                        itemBuilder: (ctx, i) {
                          final stop = parent.routeInfo!.stopsList[i];
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: kPurple.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: kPurple.withValues(alpha: 0.20),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '${i + 1}. $stop',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: kPurple,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // ── Collapsible Live Bus Map (Clean, Simple & Single Control) ──
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: widget.cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: widget.borderColor),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: _isMapExpanded
                ? Column(
                    children: [
                      // Header with Hide Map button when expanded
                      InkWell(
                        onTap: () => setState(() => _isMapExpanded = false),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 13,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    LucideIcons.mapPin,
                                    size: 18,
                                    color: kPurple,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Live Bus Location',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: widget.textDark,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 7,
                                      vertical: 2.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color:
                                          parent.telemetry != null &&
                                              !parent.telemetryStale
                                          ? const Color(0xFF22C55E)
                                              .withValues(alpha: 0.15)
                                          : widget.textLight
                                              .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      parent.telemetry != null &&
                                              !parent.telemetryStale
                                          ? '● LIVE'
                                          : '○ OFFLINE',
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color:
                                            parent.telemetry != null &&
                                                !parent.telemetryStale
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFF6B7280),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: widget.textLight.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      'Hide Map',
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                        color: widget.textDark,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Icon(
                                      LucideIcons.chevronUp,
                                      size: 14,
                                      color: widget.textDark,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Divider(height: 1, color: widget.borderColor),
                      SizedBox(
                        height: 290,
                        child: Stack(
                          children: [
                            _ParentMap(parent: parent),

                            // Auto-follow toggle checkbox
                            Positioned(
                              bottom: 10,
                              right: 10,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.95),
                                  borderRadius: BorderRadius.circular(999),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.15),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: Checkbox(
                                        value: parent.autoFollow,
                                        onChanged: (v) =>
                                            parent.setAutoFollow(v ?? true),
                                        activeColor: kPurple,
                                        materialTapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    const Text(
                                      'Auto-follow bus',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Floating telemetry HUD
                            if (parent.telemetry != null)
                              Positioned(
                                bottom: 10,
                                left: 10,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.75),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        LucideIcons.gauge,
                                        size: 13,
                                        color: Color(0xFF4ADE80),
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        '${parent.telemetry!.speed.toStringAsFixed(0)} km/h',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 11,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _getHeadingLabel(parent.telemetry!.heading),
                                        style: TextStyle(
                                          color: Colors.white.withValues(
                                            alpha: 0.8,
                                          ),
                                          fontSize: 10.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  )
                : InkWell(
                    onTap: () => setState(() => _isMapExpanded = true),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: kPurple.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              LucideIcons.mapPin,
                              color: kPurple,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      'Live Bus Location',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                        color: widget.textDark,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 7,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: parent.telemetry != null &&
                                                !parent.telemetryStale
                                            ? const Color(0xFF22C55E)
                                                .withValues(alpha: 0.15)
                                            : widget.textLight
                                                .withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        parent.telemetry != null &&
                                                !parent.telemetryStale
                                            ? '● LIVE'
                                            : '○ OFFLINE',
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w800,
                                          color: parent.telemetry != null &&
                                                  !parent.telemetryStale
                                              ? const Color(0xFF16A34A)
                                              : const Color(0xFF6B7280),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  parent.telemetry != null &&
                                          !parent.telemetryStale
                                      ? 'Moving at ${parent.telemetry!.speed.round()} km/h'
                                      : 'GPS Standby · Tap to view live map',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: widget.textLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 9,
                            ),
                            decoration: BoxDecoration(
                              color: kPurple,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [
                                BoxShadow(
                                  color: kPurple.withValues(alpha: 0.25),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Open Map',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12.5,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(
                                  LucideIcons.chevronDown,
                                  size: 15,
                                  color: Colors.white,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
          const SizedBox(height: 14),

          // ── QUICK STATS 2x2 GRID (Exact Web Parity: This Month, Fee Status, Bus Speed, Direction) ──
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.85,
            children: [
              _QuickStatCard(
                isDark: widget.isDark,
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textDark: widget.textDark,
                textLight: widget.textLight,
                icon: LucideIcons.calendar,
                iconColor: kPurple,
                label: 'This Month',
                value: '${parent.attendancePercent ?? '—'}%',
                sub:
                    '${parent.monthlyAttendance ?? 0}/${parent.workingDays ?? 0} days',
              ),
              _QuickStatCard(
                isDark: widget.isDark,
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textDark: widget.textDark,
                textLight: widget.textLight,
                icon: LucideIcons.creditCard,
                iconColor: child?.feeStatus == 'paid'
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFEF4444),
                label: 'Fee Status',
                value: child?.feeStatus != null
                    ? child!.feeStatus![0].toUpperCase() +
                          child!.feeStatus!.substring(1)
                    : '—',
                sub: 'Academic transit',
              ),
              _QuickStatCard(
                isDark: widget.isDark,
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textDark: widget.textDark,
                textLight: widget.textLight,
                icon: LucideIcons.gauge,
                iconColor: const Color(0xFFF97316),
                label: 'Bus Speed',
                value: parent.telemetry != null && !parent.telemetryStale
                    ? '${parent.telemetry!.speed.round()} km/h'
                    : 'No Signal',
                sub: parent.telemetryStale ? 'Standby' : 'Live sensor',
              ),
              _QuickStatCard(
                isDark: widget.isDark,
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textDark: widget.textDark,
                textLight: widget.textLight,
                icon: LucideIcons.compass,
                iconColor: const Color(0xFF06B6D4),
                label: 'Direction',
                value: parent.telemetry != null && !parent.telemetryStale
                    ? _getHeadingLabel(parent.telemetry!.heading)
                    : '—',
                sub: parent.telemetry?.comfort ?? 'Tracking',
              ),
            ],
          ),
          const SizedBox(height: 14),

          // ── QUICK ACTIONS SHORTCUTS ──
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: widget.cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: widget.borderColor),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'QUICK ACTIONS',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: widget.textLight,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _ActionShortcutButton(
                        icon: LucideIcons.calendarPlus,
                        label: 'Apply Leave',
                        color: kPurple,
                        onTap: () => widget.onNavigateToTab(1),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _ActionShortcutButton(
                        icon: LucideIcons.messageSquareWarning,
                        label: 'Complaints',
                        color: const Color(0xFFEF4444),
                        onTap: () => widget.onNavigateToTab(2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _ActionShortcutButton(
                        icon: LucideIcons.gauge,
                        label: 'Analytics',
                        color: const Color(0xFFF97316),
                        onTap: () => widget.onNavigateToTab(4),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static void _dialPhone(String phone) async {
    final clean = phone.replaceAll(RegExp(r'\s+'), '');
    final uri = Uri.parse('tel:$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static String _fmtTime(DateTime? d) {
    if (d == null) return '—';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final amPm = d.hour >= 12 ? 'PM' : 'AM';
    return '$h:${d.minute.toString().padLeft(2, '0')} $amPm';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 2. ATTENDANCE TAB
// ═════════════════════════════════════════════════════════════════════════

class _AttendanceTab extends StatefulWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;

  const _AttendanceTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
  });

  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  DateTime _calMonth = DateTime.now();
  DateTime _leaveDate = DateTime.now();
  String _leaveReason = 'Sick / Medical Leave';
  bool _isSubmittingLeave = false;

  final List<String> _leaveReasons = [
    'Sick / Medical Leave',
    'Family Function / Event',
    'Out of Station',
    'Personal / Other Reason',
  ];

  @override
  Widget build(BuildContext context) {
    final parent = widget.parent;
    final presentDays = <String>{
      for (final r in parent.attendanceDays)
        _dateKey(_parseDate(r['timestamp'] ?? r['date'])),
    };

    final year = _calMonth.year;
    final month = _calMonth.month;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstWeekday = DateTime(year, month, 1).weekday % 7; // Sunday-first
    final today = DateTime.now();

    final cells = <int?>[
      for (var i = 0; i < firstWeekday; i++) null,
      for (var d = 1; d <= daysInMonth; d++) d,
    ];

    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    final monthLabel = '${months[month - 1]} $year';

    final presentCount = parent.monthlyAttendance ?? 0;
    final workingDaysCount = parent.workingDays ?? 0;
    final absentCount = math.max(0, workingDaysCount - presentCount);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── TOP 3 SUMMARY CARDS (Matching Web Attendance Tab) ──
        Row(
          children: [
            Expanded(
              child: _SummaryBox(
                icon: '✅',
                value: '$presentCount',
                label: 'Present',
                color: const Color(0xFF16A34A),
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textLight: widget.textLight,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SummaryBox(
                icon: '❌',
                value: '$absentCount',
                label: 'Absent',
                color: const Color(0xFFEF4444),
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textLight: widget.textLight,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SummaryBox(
                icon: '📊',
                value: '${parent.attendancePercent ?? 0}%',
                label: 'Attendance %',
                color: kPurple,
                cardBg: widget.cardBg,
                borderColor: widget.borderColor,
                textLight: widget.textLight,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // ── ATTENDANCE CALENDAR CARD ──
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: widget.borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _CalNav(
                    icon: LucideIcons.chevronLeft,
                    onTap: () => setState(
                      () => _calMonth = DateTime(year, month - 1, 1),
                    ),
                  ),
                  Text(
                    monthLabel,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: widget.textDark,
                    ),
                  ),
                  _CalNav(
                    icon: LucideIcons.chevronRight,
                    onTap: () => setState(
                      () => _calMonth = DateTime(year, month + 1, 1),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Days of week header
              Row(
                children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                    .map(
                      (d) => Expanded(
                        child: Center(
                          child: Text(
                            d,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: d == 'Su'
                                  ? const Color(0xFFEF4444)
                                  : widget.textLight,
                            ),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 6),

              // Days grid (With Sunday safeguards matching web)
              for (var week = 0; week < (cells.length / 7).ceil(); week++)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      for (var i = 0; i < 7; i++)
                        Expanded(
                          child: Builder(
                            builder: (_) {
                              final idx = week * 7 + i;
                              if (idx >= cells.length || cells[idx] == null) {
                                return const SizedBox();
                              }
                              final d = cells[idx]!;
                              final cellDate = DateTime(year, month, d);
                              final isSunday =
                                  cellDate.weekday == DateTime.sunday;
                              final isToday =
                                  cellDate.year == today.year &&
                                  cellDate.month == today.month &&
                                  cellDate.day == today.day;
                              final isFuture = cellDate.isAfter(today);
                              final present = presentDays.contains(
                                _dateKey(cellDate),
                              );

                              Color bg;
                              Color fg;
                              Border? border;

                              if (isToday) {
                                bg = kPurple;
                                fg = Colors.white;
                                border = Border.all(
                                  color: kPurpleDark,
                                  width: 2,
                                );
                              } else if (present) {
                                bg = const Color(
                                  0xFF22C55E,
                                ).withValues(alpha: 0.15);
                                fg = const Color(0xFF16A34A);
                                border = Border.all(
                                  color: const Color(
                                    0xFF22C55E,
                                  ).withValues(alpha: 0.3),
                                );
                              } else if (isSunday) {
                                bg = Colors.transparent;
                                fg = widget.textLight.withValues(alpha: 0.45);
                              } else if (isFuture) {
                                bg = Colors.transparent;
                                fg = widget.textLight;
                              } else {
                                bg = const Color(
                                  0xFFEF4444,
                                ).withValues(alpha: 0.10);
                                fg = const Color(0xFFEF4444);
                                border = Border.all(
                                  color: const Color(
                                    0xFFEF4444,
                                  ).withValues(alpha: 0.25),
                                );
                              }

                              return Container(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: bg,
                                  borderRadius: BorderRadius.circular(8),
                                  border: border,
                                ),
                                child: Center(
                                  child: Text(
                                    '$d',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: isToday
                                          ? FontWeight.w800
                                          : FontWeight.w600,
                                      color: fg,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),

              // Calendar Legend
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _LegendDot(
                    bg: const Color(0xFF22C55E).withValues(alpha: 0.15),
                    border: const Color(0xFF16A34A),
                    label: 'Present',
                    labelColor: widget.textLight,
                  ),
                  const SizedBox(width: 12),
                  _LegendDot(
                    bg: const Color(0xFFEF4444).withValues(alpha: 0.10),
                    border: const Color(0xFFEF4444),
                    label: 'Absent',
                    labelColor: widget.textLight,
                  ),
                  const SizedBox(width: 12),
                  _LegendDot(
                    bg: kPurple,
                    border: kPurpleDark,
                    label: 'Today',
                    labelColor: widget.textLight,
                  ),
                  const SizedBox(width: 12),
                  _LegendDot(
                    bg: Colors.transparent,
                    border: widget.textLight.withValues(alpha: 0.5),
                    label: 'Sunday',
                    labelColor: widget.textLight,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── MARK LEAVE FOR STUDENT CARD (Web Style Inline Card) ──
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: widget.borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('📝', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Text(
                    'Mark Leave for Student',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: widget.textDark,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                "Notify the transport department about your child's planned leave so the bus does not wait at the stop.",
                style: TextStyle(
                  fontSize: 12,
                  color: widget.textLight,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),

              // Date Picker Field
              Text(
                'Leave Date',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: widget.textLight,
                ),
              ),
              const SizedBox(height: 4),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _leaveDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 60)),
                  );
                  if (picked != null) {
                    setState(() => _leaveDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: widget.borderColor),
                    color: widget.isDark
                        ? AppColors.darkSurface
                        : const Color(0xFFF8FAFC),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_leaveDate.year}-${_leaveReason != '' ? _leaveDate.month.toString().padLeft(2, '0') : ''}-${_leaveDate.day.toString().padLeft(2, '0')}',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: widget.textDark,
                        ),
                      ),
                      const Icon(
                        LucideIcons.calendar,
                        size: 16,
                        color: kPurple,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Reason Select Dropdown
              Text(
                'Reason',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: widget.textLight,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: widget.borderColor),
                  color: widget.isDark
                      ? AppColors.darkSurface
                      : const Color(0xFFF8FAFC),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _leaveReason,
                    isExpanded: true,
                    dropdownColor: widget.cardBg,
                    items: _leaveReasons
                        .map(
                          (r) => DropdownMenuItem(
                            value: r,
                            child: Text(
                              r,
                              style: TextStyle(
                                fontSize: 13,
                                color: widget.textDark,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _leaveReason = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPurple,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  onPressed: _isSubmittingLeave
                      ? null
                      : () async {
                          setState(() => _isSubmittingLeave = true);
                          final iso =
                              '${_leaveDate.year}-${_leaveDate.month.toString().padLeft(2, '0')}-${_leaveDate.day.toString().padLeft(2, '0')}';
                          await parent.markLeave(iso, reason: _leaveReason);
                          if (mounted)
                            setState(() => _isSubmittingLeave = false);
                        },
                  child: Text(
                    _isSubmittingLeave ? 'Marking...' : 'Mark Leave',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── RECENT ATTENDANCE LOG (Matching Web Log) ──
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: widget.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.clock, size: 17, color: kPurple),
                  const SizedBox(width: 8),
                  Text(
                    'Recent Attendance Log',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14.5,
                      color: widget.textDark,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (parent.attendanceDays.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'No attendance records yet',
                      style: TextStyle(color: widget.textLight, fontSize: 13),
                    ),
                  ),
                )
              else
                ...parent.attendanceDays.take(15).map((r) {
                  final dt = _parseDate(r['timestamp'] ?? r['date']);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              LucideIcons.checkCircle2,
                              size: 16,
                              color: Color(0xFF22C55E),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              dt != null
                                  ? '${_weekdayName(dt.weekday)}, ${dt.day} ${_monthShortName(dt.month)}'
                                  : '—',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: widget.textDark,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          dt != null ? _fmtTime(dt) : '',
                          style: TextStyle(
                            fontSize: 12,
                            color: widget.textLight,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ],
    );
  }

  static DateTime? _parseDate(Object? v) =>
      v == null ? null : DateTime.tryParse(v.toString());

  static String _dateKey(DateTime? d) =>
      d == null ? '' : '${d.year}-${d.month}-${d.day}';

  static String _weekdayName(int d) {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return (d >= 1 && d <= 7) ? names[d - 1] : '';
  }

  static String _monthShortName(int m) {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return (m >= 1 && m <= 12) ? names[m - 1] : '';
  }

  static String _fmtTime(DateTime? d) {
    if (d == null) return '—';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final amPm = d.hour >= 12 ? 'PM' : 'AM';
    return '$h:${d.minute.toString().padLeft(2, '0')} $amPm';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 3. COMPLAINTS (GRIEVANCES) TAB
// ═════════════════════════════════════════════════════════════════════════

class _ComplaintsTab extends StatefulWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;

  const _ComplaintsTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
  });

  @override
  State<_ComplaintsTab> createState() => _ComplaintsTabState();
}

class _ComplaintsTabState extends State<_ComplaintsTab> {
  String? _rejectingGrievanceId;
  final TextEditingController _reopenReasonController = TextEditingController();

  @override
  void dispose() {
    _reopenReasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final grievances = widget.parent.childGrievances;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Text(
          '${grievances.length} complaint${grievances.length == 1 ? '' : 's'} raised by your child',
          style: TextStyle(
            fontSize: 12.5,
            color: widget.textLight,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),

        if (grievances.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    LucideIcons.messageSquare,
                    size: 44,
                    color: widget.textLight.withValues(alpha: 0.4),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'No complaints raised yet',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: widget.textDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Complaints submitted by your child will appear here.',
                    style: TextStyle(fontSize: 12, color: widget.textLight),
                  ),
                ],
              ),
            ),
          )
        else
            ...grievances.map((g) {
              final meta = _GrievanceStatusMeta.of(g.status);
              final busy = widget.parent.isGrievanceBusy(g.id);
              final isRejecting = _rejectingGrievanceId == g.id;

              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: widget.cardBg,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: widget.borderColor),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(5),
                                decoration: BoxDecoration(
                                  color: meta.bg,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Icon(
                                  meta.icon,
                                  size: 14,
                                  color: meta.color,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      widget.parent.child?.name ?? 'Student',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w800,
                                        color: widget.textDark,
                                      ),
                                    ),
                                    Text(
                                      '#${g.id.length > 6 ? g.id.substring(0, 6).toUpperCase() : g.id}${g.category != null ? " · ${g.category}" : ""}${g.busNumber != null ? " · Bus ${g.busNumber}" : ""}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: widget.textLight,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3.5,
                          ),
                          decoration: BoxDecoration(
                            color: meta.bg,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            meta.label,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: meta.color,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Complaint text
                    Text(
                      g.text,
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.5,
                        color: widget.textDark,
                      ),
                    ),

                    // Admin Response Block
                    if (g.adminResponse != null &&
                        g.adminResponse!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF2563EB,
                          ).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: const Border(
                            left: BorderSide(
                              color: Color(0xFF2563EB),
                              width: 3,
                            ),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'RESPONSE FROM TRANSPORT OFFICE',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF2563EB),
                                letterSpacing: 0.4,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              g.adminResponse!,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: widget.textDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // In-progress status banner when transport team is active
                    if (g.status == 'in_progress' &&
                        (g.adminResponse == null ||
                            g.adminResponse!.isEmpty)) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF97316).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: const Color(0xFFF97316).withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              LucideIcons.wrench,
                              size: 13,
                              color: Color(0xFFEA580C),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: Text(
                                'Transport team is actively working on resolving this issue.',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: widget.isDark
                                      ? const Color(0xFFFDBA74)
                                      : const Color(0xFFC2410C),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Reopened count flag
                    if (g.reopenCount > 0) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Reopened ${g.reopenCount} time${g.reopenCount == 1 ? '' : 's'} — still not resolved',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFEF4444),
                        ),
                      ),
                    ],

                    // ── Parent Decision Actions (when resolved) ──
                    if (g.status == 'resolved') ...[
                      const SizedBox(height: 14),
                      Text(
                        'Has this been fixed? Your answer decides whether the complaint closes.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: widget.textLight,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF16A34A),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 9,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              elevation: 0,
                            ),
                            onPressed: busy
                                ? null
                                : () => widget.parent.confirmGrievance(g.id),
                            icon: const Icon(LucideIcons.check, size: 14),
                            label: const Text(
                              'Yes, Fixed',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEF4444),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 9,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              elevation: 0,
                            ),
                            onPressed: busy
                                ? null
                                : () {
                                    setState(() {
                                      _rejectingGrievanceId = isRejecting
                                          ? null
                                          : g.id;
                                      _reopenReasonController.clear();
                                    });
                                  },
                            icon: const Icon(LucideIcons.rotateCcw, size: 14),
                            label: const Text(
                              'Not Fixed Yet',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],

                    // Expandable Reopen Box
                    if (isRejecting) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFEF4444,
                          ).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(
                              0xFFEF4444,
                            ).withValues(alpha: 0.25),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'What is still not fixed?',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12.5,
                                color: widget.textDark,
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _reopenReasonController,
                              maxLines: 2,
                              style: TextStyle(
                                color: widget.textDark,
                                fontSize: 13,
                              ),
                              decoration: InputDecoration(
                                hintText:
                                    'e.g. AC is still not functioning properly...',
                                hintStyle: TextStyle(
                                  color: widget.textLight,
                                  fontSize: 12.5,
                                ),
                                filled: true,
                                fillColor: widget.cardBg,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide(
                                    color: widget.borderColor,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide(
                                    color: widget.borderColor,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () => setState(
                                    () => _rejectingGrievanceId = null,
                                  ),
                                  child: Text(
                                    'Cancel',
                                    style: TextStyle(color: widget.textLight),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFDC2626),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 8,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    elevation: 0,
                                  ),
                                  onPressed: () {
                                    final reason = _reopenReasonController.text
                                        .trim();
                                    widget.parent.reopenGrievance(g.id, reason);
                                    setState(
                                      () => _rejectingGrievanceId = null,
                                    );
                                  },
                                  child: const Text(
                                    'Reopen Complaint',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
        ],
      );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 4. ANNOUNCEMENTS (NOTICES) TAB
// ═════════════════════════════════════════════════════════════════════════

class _AnnouncementsTab extends StatelessWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;

  const _AnnouncementsTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
  });

  @override
  Widget build(BuildContext context) {
    final broadcasts = parent.broadcasts;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '${broadcasts.length} announcements from administration',
          style: TextStyle(
            fontSize: 12.5,
            color: textLight,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),

        if (broadcasts.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    LucideIcons.megaphone,
                    size: 40,
                    color: textLight.withValues(alpha: 0.4),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No announcements yet',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: textLight,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ...broadcasts.map((b) {
            final meta = _BroadcastMeta.of(b);
            final title = (b['title'] ?? '').toString();
            final message = (b['message'] ?? '').toString();

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: meta.bg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      LucideIcons.megaphone,
                      size: 16,
                      color: meta.border,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (title.isNotEmpty)
                              Expanded(
                                child: Text(
                                  title,
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w800,
                                    color: textDark,
                                  ),
                                ),
                              ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: meta.badgeBg,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                meta.tag,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: meta.badgeColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          message,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.45,
                            color: textLight,
                          ),
                        ),
                        if (b['createdAt'] != null ||
                            b['timestamp'] != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            (b['createdAt'] ?? b['timestamp']).toString(),
                            style: TextStyle(
                              fontSize: 10.5,
                              color: textLight.withValues(alpha: 0.8),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 5. ANALYTICS TAB
// ═════════════════════════════════════════════════════════════════════════

class _AnalyticsTab extends StatefulWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;

  const _AnalyticsTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
  });

  @override
  State<_AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<_AnalyticsTab> {
  DateTime _selectedDate = DateTime.now();

  @override
  Widget build(BuildContext context) {
    final speed = widget.parent.speedData;
    final telemetry = widget.parent.telemetry;
    final telemetryList = speed?['telemetry'] is List
        ? (speed!['telemetry'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
        : <Map<String, dynamic>>[];

    final spots = <FlSpot>[];
    final xLabels = <int, String>{};
    for (var i = 0; i < telemetryList.length; i++) {
      final v = double.tryParse('${telemetryList[i]['speed'] ?? 0}') ?? 0;
      spots.add(FlSpot(i.toDouble(), v));

      final timeStr =
          telemetryList[i]['time']?.toString() ??
          telemetryList[i]['timestamp']?.toString();
      if (timeStr != null && timeStr.isNotEmpty) {
        try {
          final dt = DateTime.tryParse(timeStr);
          if (dt != null) {
            xLabels[i] =
                '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          }
        } catch (_) {
          xLabels[i] = '${i + 1}';
        }
      } else {
        xLabels[i] = '${i + 1}';
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Main Speed Analytics Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: widget.borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Title & Date Picker Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        LucideIcons.activity,
                        size: 18,
                        color: kPurple,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Speed Analytics',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: widget.textDark,
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime.now().subtract(
                          const Duration(days: 90),
                        ),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) {
                        setState(() => _selectedDate = picked);
                        final iso =
                            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                        widget.parent.fetchSpeedAnalytics(iso);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: widget.isDark
                            ? AppColors.darkSurface
                            : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: widget.borderColor),
                      ),
                      child: Row(
                        children: [
                          Text(
                            '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: widget.textDark,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(
                            LucideIcons.calendar,
                            size: 14,
                            color: kPurple,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Stats Row (Max Speed, Avg Speed, Overspeeds)
              Row(
                children: [
                  Expanded(
                    child: _AnalyticsStatBox(
                      label: 'Max Speed',
                      value: '${speed?['maxSpeed'] ?? '—'} km/h',
                      color: const Color(0xFFEF4444),
                      isDark: widget.isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _AnalyticsStatBox(
                      label: 'Avg Speed',
                      value: '${speed?['avgSpeed'] ?? '—'} km/h',
                      color: kPurple,
                      isDark: widget.isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _AnalyticsStatBox(
                      label: 'Overspeeds',
                      value: '${speed?['overspeedCount'] ?? 0}',
                      color: const Color(0xFFF97316),
                      isDark: widget.isDark,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Chart Container
              SizedBox(
                height: 220,
                child: spots.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              LucideIcons.activity,
                              size: 36,
                              color: widget.textLight.withValues(alpha: 0.3),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'No telemetry data for ${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}',
                              style: TextStyle(
                                fontSize: 13,
                                color: widget.textLight,
                              ),
                            ),
                          ],
                        ),
                      )
                    : LineChart(
                        LineChartData(
                          gridData: FlGridData(
                            show: true,
                            drawVerticalLine: true,
                            getDrawingHorizontalLine: (v) => FlLine(
                              color: widget.borderColor,
                              strokeWidth: 1,
                            ),
                            getDrawingVerticalLine: (v) => FlLine(
                              color: widget.borderColor.withValues(alpha: 0.3),
                              strokeWidth: 0.5,
                            ),
                          ),
                          titlesData: FlTitlesData(
                            show: true,
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                interval: math.max(
                                  1.0,
                                  (telemetryList.length / 5).ceilToDouble(),
                                ),
                                getTitlesWidget: (value, meta) {
                                  final idx = value.toInt();
                                  if (xLabels.containsKey(idx)) {
                                    return SideTitleWidget(
                                      meta: meta,
                                      child: Text(
                                        xLabels[idx]!,
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          color: widget.textLight,
                                        ),
                                      ),
                                    );
                                  }
                                  return const SizedBox.shrink();
                                },
                                reservedSize: 26,
                              ),
                            ),
                            leftTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                interval: 15,
                                getTitlesWidget: (value, meta) {
                                  return SideTitleWidget(
                                    meta: meta,
                                    child: Text(
                                      '${value.toInt()}',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: widget.textLight,
                                      ),
                                    ),
                                  );
                                },
                                reservedSize: 28,
                              ),
                            ),
                            topTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            rightTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                          ),
                          borderData: FlBorderData(show: false),
                          lineBarsData: [
                            LineChartBarData(
                              spots: spots,
                              isCurved: true,
                              color: kPurple,
                              barWidth: 2.5,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                color: kPurple.withValues(alpha: 0.12),
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── CURRENT JOURNEY STATUS (Matching Web Status Card) ──
        if (telemetry != null) ...[
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: widget.cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: widget.borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('🚌', style: TextStyle(fontSize: 16)),
                    const SizedBox(width: 8),
                    Text(
                      'Current Journey Status',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14.5,
                        color: widget.textDark,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 2.4,
                  children: [
                    _JourneyMetricBox(
                      icon: LucideIcons.gauge,
                      iconColor: const Color(0xFFF97316),
                      label: 'Live Speed',
                      value: '${telemetry.speed.round()} km/h',
                      isDark: widget.isDark,
                      textDark: widget.textDark,
                      textLight: widget.textLight,
                    ),
                    _JourneyMetricBox(
                      icon: LucideIcons.navigation,
                      iconColor: const Color(0xFF06B6D4),
                      label: 'Direction',
                      value: _getHeadingLabel(telemetry.heading),
                      isDark: widget.isDark,
                      textDark: widget.textDark,
                      textLight: widget.textLight,
                    ),
                    _JourneyMetricBox(
                      icon: LucideIcons.trendingUp,
                      iconColor: const Color(0xFF16A34A),
                      label: 'Comfort',
                      value: telemetry.comfort,
                      isDark: widget.isDark,
                      textDark: widget.textDark,
                      textLight: widget.textLight,
                    ),
                    _JourneyMetricBox(
                      icon: LucideIcons.clock,
                      iconColor: kPurple,
                      label: 'Last Update',
                      value: _fmtTime(telemetry.lastUpdated),
                      isDark: widget.isDark,
                      textDark: widget.textDark,
                      textLight: widget.textLight,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  static String _fmtTime(DateTime? d) {
    if (d == null) return '—';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final amPm = d.hour >= 12 ? 'PM' : 'AM';
    return '$h:${d.minute.toString().padLeft(2, '0')} $amPm';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// SHARED HELPER WIDGETS & LOGIC
// ═════════════════════════════════════════════════════════════════════════

String _getHeadingLabel(double? deg) {
  if (deg == null) return '-';
  double h = deg % 360;
  if (h < 0) h += 360;
  if (h >= 315 || h < 45) return 'N ↑';
  if (h >= 45 && h < 135) return 'E →';
  if (h >= 135 && h < 225) return 'S ↓';
  return 'W ←';
}

class _BroadcastMeta {
  final String tag;
  final Color bg;
  final Color border;
  final Color badgeBg;
  final Color badgeColor;

  const _BroadcastMeta({
    required this.tag,
    required this.bg,
    required this.border,
    required this.badgeBg,
    required this.badgeColor,
  });

  static _BroadcastMeta of(Map<String, dynamic> b) {
    final text = '${b['title'] ?? ''} ${b['message'] ?? ''}'.toLowerCase();
    if (text.contains('urgent') ||
        text.contains('emergency') ||
        text.contains('alert') ||
        text.contains('cancel')) {
      return const _BroadcastMeta(
        tag: '🚨 Urgent Alert',
        bg: Color(0x1FEF4444),
        border: Color(0xFFEF4444),
        badgeBg: Color(0x26EF4444),
        badgeColor: Color(0xFFDC2626),
      );
    }
    if (text.contains('route') ||
        text.contains('bus') ||
        text.contains('delay') ||
        text.contains('traffic') ||
        text.contains('diver')) {
      return const _BroadcastMeta(
        tag: '🚌 Route Update',
        bg: Color(0x1FF97316),
        border: Color(0xFFF97316),
        badgeBg: Color(0x26F97316),
        badgeColor: Color(0xFFEA580C),
      );
    }
    return const _BroadcastMeta(
      tag: '📢 Notice',
      bg: Color(0x1F7C3AED),
      border: kPurple,
      badgeBg: kPurpleLight,
      badgeColor: kPurple,
    );
  }
}

class _GrievanceStatusMeta {
  final String label;
  final Color bg;
  final Color color;
  final IconData icon;

  const _GrievanceStatusMeta(this.label, this.bg, this.color, this.icon);

  static const Map<String, _GrievanceStatusMeta> all = {
    'pending': _GrievanceStatusMeta(
      'Pending',
      Color(0x1FEF4444),
      Color(0xFFDC2626),
      LucideIcons.alertTriangle,
    ),
    'in_progress': _GrievanceStatusMeta(
      'In Progress',
      Color(0x1FF97316),
      Color(0xFFEA580C),
      LucideIcons.wrench,
    ),
    'resolved': _GrievanceStatusMeta(
      'Awaiting Confirm',
      Color(0x1F2563EB),
      Color(0xFF2563EB),
      LucideIcons.timer,
    ),
    'reopened': _GrievanceStatusMeta(
      'Reopened',
      Color(0x26EF4444),
      Color(0xFFDC2626),
      LucideIcons.rotateCcw,
    ),
    'closed': _GrievanceStatusMeta(
      'Closed · Confirmed',
      Color(0x1F22C55E),
      Color(0xFF16A34A),
      LucideIcons.checkCircle2,
    ),
  };

  static _GrievanceStatusMeta of(String status) =>
      all[status.toLowerCase()] ?? all['pending']!;
}

class _ParentMap extends StatelessWidget {
  final ParentProvider parent;

  const _ParentMap({required this.parent});

  @override
  Widget build(BuildContext context) {
    final center = LatLng(parent.busLocation[0], parent.busLocation[1]);
    final stops = parent.routeInfo?.stopsList ?? [];
    final polyline = stops
        .map((s) => StopCoords.all[s])
        .whereType<List<double>>()
        .map((c) => LatLng(c[0], c[1]))
        .toList();
    if (polyline.isNotEmpty &&
        stops.isNotEmpty &&
        stops.last != 'Invertis University') {
      final dest = StopCoords.all['Invertis University'];
      if (dest != null) polyline.add(LatLng(dest[0], dest[1]));
    }

    return FlutterMap(
      options: MapOptions(initialCenter: center, initialZoom: 15),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.bussaarthi.bus_saarthi_app',
        ),
        if (polyline.length > 1)
          PolylineLayer(
            polylines: [
              Polyline(points: polyline, strokeWidth: 5, color: kPurple),
            ],
          ),
        MarkerLayer(
          markers: [
            if (polyline.isNotEmpty)
              Marker(
                point: polyline.last,
                width: 32,
                height: 32,
                alignment: Alignment.topCenter,
                child: const Icon(
                  LucideIcons.mapPin,
                  size: 26,
                  color: Color(0xFFDC2626),
                ),
              ),
            Marker(
              point: center,
              width: 44,
              height: 44,
              child: Image.asset(
                'assets/icons/bus-icon-192.png',
                errorBuilder: (_, __, ___) =>
                    const Icon(LucideIcons.bus, size: 30, color: kPurple),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _QuickStatCard extends StatelessWidget {
  final bool isDark;
  final Color cardBg;
  final Color borderColor;
  final Color textDark;
  final Color textLight;
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String sub;

  const _QuickStatCard({
    required this.isDark,
    required this.cardBg,
    required this.borderColor,
    required this.textDark,
    required this.textLight,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.sub,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: iconColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: textLight,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: textDark,
            ),
          ),
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w500,
              color: textLight,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionShortcutButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionShortcutButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryBox extends StatelessWidget {
  final String icon;
  final String value;
  final String label;
  final Color color;
  final Color cardBg;
  final Color borderColor;
  final Color textLight;

  const _SummaryBox({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.cardBg,
    required this.borderColor,
    required this.textLight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: textLight,
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalyticsStatBox extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _AnalyticsStatBox({
    required this.label,
    required this.value,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: isDark
                  ? AppColors.darkTextMuted
                  : AppColors.lightTextMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _JourneyMetricBox extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final bool isDark;
  final Color textDark;
  final Color textLight;

  const _JourneyMetricBox({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.isDark,
    required this.textDark,
    required this.textLight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: iconColor),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    color: textLight,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: textDark,
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

class _CalNav extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CalNav({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kPurple.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 16, color: kPurple),
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color bg;
  final Color border;
  final String label;
  final Color labelColor;

  const _LegendDot({
    required this.bg,
    required this.border,
    required this.label,
    required this.labelColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: border),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            color: labelColor,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
