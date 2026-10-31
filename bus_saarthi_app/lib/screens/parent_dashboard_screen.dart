import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../core/stop_coords.dart';
import '../core/theme.dart';
import '../models/grievance_model.dart';
import '../providers/auth_provider.dart';
import '../providers/parent_provider.dart';
import '../widgets/user_avatar.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

const Color kPurple = Color(0xFF7C3AED);
const Color kPurpleLight = Color(0xFFF3E8FF);
const Color kPurpleDark = Color(0xFF6D28D9);

/// Port of the web ParentDashboard: purple guardian header with tabs —
/// Overview (status + live map), Attendance (calendar + leave),
/// Announcements, Complaints (confirm/reopen) and Analytics (speed).
class ParentDashboardScreen extends StatelessWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
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

class _ParentViewState extends State<_ParentView>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs =
      TabController(length: 5, vsync: this, initialIndex: 0);


  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ParentProvider>().attachToastContext(context);
    });
    _tabs.addListener(() {
      if (_tabs.indexIsChanging) return;
      if (_tabs.index == 4) {
        final now = DateTime.now();
        final date =
            '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        context.read<ParentProvider>().fetchSpeedAnalytics(date);
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final parent = context.watch<ParentProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkBg : AppColors.lightBg;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;

    if (parent.isLoading) {
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
                    strokeWidth: 3.5, color: kPurple),
              ),
              const SizedBox(height: 14),
              Text('Loading Parent Dashboard...',
                  style: TextStyle(
                      color: kPurple,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: bg,
      body: Column(
        children: [
          // ── Purple header ──
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [kPurpleDark, kPurple],
              ),
              boxShadow: [
                BoxShadow(color: Color(0x598B5CF6), blurRadius: 14, offset: Offset(0, 3)),
              ],
            ),
            child: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          height: 34,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Image.asset('assets/images/logo.png',
                              errorBuilder: (_, __, ___) => const SizedBox.shrink()),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Parent Dashboard',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.3)),
                              Text('Invertis Bus Saarthi · Guardian View',
                                  style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.9),
                                      fontSize: 10.5)),
                            ],
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const SettingsScreen())),
                          icon: const Icon(LucideIcons.settings,
                              size: 20, color: Colors.white),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () async {
                            await context.read<AuthProvider>().logout();
                            if (!context.mounted) return;
                            Navigator.of(context).pushAndRemoveUntil(
                                MaterialPageRoute(
                                    builder: (_) => const LoginScreen()),
                                (route) => false);
                          },
                          icon: const Icon(LucideIcons.logOut,
                              size: 20, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  // Child switcher (if multiple children)
                  if (parent.childCount > 1) ...[
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _ChildSwitcher(
                        parent: parent,
                        textColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
            ),
          ),

          // ── Tab bar ──
          Container(
            color: cardBg,
            child: TabBar(
              controller: _tabs,
              isScrollable: true,
              labelColor: kPurple,
              unselectedLabelColor: textLight,
              indicatorColor: kPurple,
              indicatorWeight: 3,
              labelStyle:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              unselectedLabelStyle:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              tabs: const [
                Tab(icon: Icon(LucideIcons.bus, size: 15), text: 'Overview'),
                Tab(icon: Icon(LucideIcons.calendar, size: 15), text: 'Attendance'),
                Tab(icon: Icon(LucideIcons.megaphone, size: 15), text: 'Announcements'),
                Tab(icon: Icon(LucideIcons.messageSquare, size: 15), text: 'Complaints'),
                Tab(icon: Icon(LucideIcons.activity, size: 15), text: 'Analytics'),
              ],
            ),
          ),

          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _OverviewTab(
                    parent: parent,
                    isDark: isDark,
                    textDark: textDark,
                    textLight: textLight,
                    borderColor: borderColor,
                    cardBg: cardBg),
                _AttendanceTab(
                    parent: parent,
                    isDark: isDark,
                    textDark: textDark,
                    textLight: textLight,
                    borderColor: borderColor,
                    cardBg: cardBg),
                _AnnouncementsTab(
                    parent: parent,
                    isDark: isDark,
                    textDark: textDark,
                    textLight: textLight,
                    borderColor: borderColor,
                    cardBg: cardBg),
                _ComplaintsTab(
                    parent: parent,
                    isDark: isDark,
                    textDark: textDark,
                    textLight: textLight,
                    borderColor: borderColor,
                    cardBg: cardBg),
                _AnalyticsTab(
                    parent: parent,
                    isDark: isDark,
                    textDark: textDark,
                    textLight: textLight,
                    borderColor: borderColor,
                    cardBg: cardBg),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════ Overview tab ═══════════════════════════

class _OverviewTab extends StatelessWidget {
  final ParentProvider parent;
  final bool isDark;
  final Color textDark;
  final Color textLight;
  final Color borderColor;
  final Color cardBg;

  const _OverviewTab({
    required this.parent,
    required this.isDark,
    required this.textDark,
    required this.textLight,
    required this.borderColor,
    required this.cardBg,
  });

  @override
  Widget build(BuildContext context) {
    final child = parent.child;
    final boarded = child?.boardedToday ?? false;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Merge banner
        if (parent.mergeInfo != null)
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
                    offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.gitMerge, size: 24, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('🚌 Bus Route Changed Today',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5)),
                      const SizedBox(height: 3),
                      Text(
                        "Your child's regular bus was merged into Bus ${parent.mergeInfo!.targetBusNumber} (${parent.mergeInfo!.targetRouteName}) today. Live tracking is automatically showing the active bus.",
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.95),
                            fontSize: 12,
                            height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (parent.mergeInfo != null) const SizedBox(height: 18),

        // Today's status hero card
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: boarded
                ? const LinearGradient(
                    colors: [Color(0xFFE6FAE6), Color(0xFFD4EDDA)])
                : const LinearGradient(
                    colors: [Color(0xFFFFF1F0), Color(0xFFFFE4E1)]),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: boarded
                    ? const Color(0x4028A745)
                    : const Color(0x40CF1322),
                width: 2),
          ),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: boarded ? const Color(0xFF28A745) : const Color(0xFFCF1322),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: (boarded ? const Color(0xFF28A745) : const Color(0xFFCF1322))
                            .withValues(alpha: 0.25),
                        blurRadius: 12,
                        offset: const Offset(0, 4)),
                  ],
                ),
                child: Icon(
                    boarded ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
                    size: 30,
                    color: Colors.white),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      boarded ? 'Child Boarded the Bus' : 'Not Boarded Yet',
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: boarded
                              ? const Color(0xFF155724)
                              : const Color(0xFF721C24)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      boarded
                          ? 'Face recognized at ${_fmtTime(child?.boardedAt)} today'
                          : 'Not marked present on the bus yet today',
                      style: TextStyle(
                          fontSize: 12.5,
                          color: boarded
                              ? const Color(0xFF28A745)
                              : const Color(0xFFCF1322)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Quick stats
        Row(
          children: [
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: LucideIcons.calendar,
                iconColor: const Color(0xFF7C3AED),
                label: 'This Month',
                value: '${parent.attendancePercent ?? '—'}%',
                sub: '${parent.monthlyAttendance ?? 0}/${parent.workingDays ?? 0} days',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: LucideIcons.bus,
                iconColor: const Color(0xFF2563EB),
                label: 'Bus',
                value: parent.routeInfo?.busNumber ?? '—',
                sub: parent.routeInfo?.routeName ?? '',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: LucideIcons.user,
                iconColor: const Color(0xFF16A34A),
                label: 'Driver',
                value: parent.routeInfo?.driver?.name ?? 'Assigning...',
                sub: parent.routeInfo?.driver?.phone ?? '',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: LucideIcons.gauge,
                iconColor: const Color(0xFFF97316),
                label: 'Live Speed',
                value: parent.telemetry == null
                    ? '—'
                    : '${parent.telemetry!.speed.toStringAsFixed(0)} km/h',
                sub: parent.telemetryStale ? 'Offline' : 'Live',
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Live map card
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kPurple.withValues(alpha: 0.20), width: 2),
          ),
          child: Column(
            children: [
              Container(
                color: kPurple,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 15, color: Colors.white),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text.rich(
                        TextSpan(
                          text: 'Live Tracking',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        parent.telemetryStale ? 'OFFLINE' : 'LIVE',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: parent.telemetryStale
                                ? const Color(0xFFFED7AA)
                                : const Color(0xFFBBF7D0)),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 320,
                child: Stack(
                  children: [
                    _ParentMap(parent: parent),
                    Positioned(
                      bottom: 10,
                      right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 11, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: borderColor),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 15,
                              height: 15,
                              child: Checkbox(
                                value: parent.autoFollow,
                                onChanged: (v) =>
                                    parent.setAutoFollow(v ?? true),
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                                visualDensity: VisualDensity.compact,
                                activeColor: kPurple,
                              ),
                            ),
                            const SizedBox(width: 7),
                            const Text('Auto-follow bus',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF334155))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
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
          urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
          subdomains: const ['a', 'b', 'c', 'd'],
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
                child: const Icon(LucideIcons.mapPin,
                    size: 26, color: Color(0xFFDC2626)),
              ),
            Marker(
              point: center,
              width: 44,
              height: 44,
              child: Image.asset('assets/icons/bus-icon-192.png',
                  errorBuilder: (_, __, ___) =>
                      const Icon(LucideIcons.bus, size: 30, color: kPurple)),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String sub;

  const _StatCard({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.sub,
  });

  @override
  Widget build(BuildContext context) {
    final Color cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final Color borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final Color textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final Color textLight = isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(fontSize: 11.5, color: textLight, fontWeight: FontWeight.w500)),
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: textDark)),
                if (sub.isNotEmpty)
                  Text(sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, color: textLight)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════ Attendance tab ═══════════════════════

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
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final monthLabel = '${months[month - 1]} $year';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Child header
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: widget.borderColor),
          ),
          child: Row(
            children: [
              UserAvatar(
                  src: null,
                  name: parent.child?.name ?? 'Child',
                  size: 46),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(parent.child?.name ?? '—',
                        style: TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w700,
                            color: widget.textDark)),
                    Text(parent.child?.loginId ?? '',
                        style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: widget.textLight)),
                  ],
                ),
              ),
              _FeeBadge(status: parent.child?.feeStatus),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Calendar
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: widget.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: widget.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _CalNav(
                    icon: LucideIcons.chevronLeft,
                    onTap: () => setState(() =>
                        _calMonth = DateTime(year, month - 1, 1)),
                  ),
                  Text(monthLabel,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: widget.textDark)),
                  _CalNav(
                    icon: LucideIcons.chevronRight,
                    onTap: () => setState(() =>
                        _calMonth = DateTime(year, month + 1, 1)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                    .map((d) => Expanded(
                          child: Center(
                            child: Text(d,
                                style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                    color: widget.textLight)),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 4),
              for (var week = 0; week < (cells.length / 7).ceil(); week++)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      for (var i = 0; i < 7; i++)
                        Expanded(
                          child: Builder(builder: (_) {
                            final idx = week * 7 + i;
                            if (idx >= cells.length || cells[idx] == null) {
                              return const SizedBox();
                            }
                            final d = cells[idx]!;
                            final cellDate = DateTime(year, month, d);
                            final isToday = cellDate.year == today.year &&
                                cellDate.month == today.month &&
                                cellDate.day == today.day;
                            final isFuture = cellDate.isAfter(today);
                            final present = presentDays
                                .contains(_dateKey(cellDate));
                            Color bg;
                            Color fg;
                            if (isToday) {
                              bg = kPurple;
                              fg = Colors.white;
                            } else if (present) {
                              bg = const Color(0xFFE6FAE6);
                              fg = const Color(0xFF28A745);
                            } else if (isFuture) {
                              bg = Colors.transparent;
                              fg = widget.textLight;
                            } else {
                              bg = const Color(0xFFFFF1F0);
                              fg = const Color(0xFFCF1322);
                            }
                            return Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 2),
                              padding: const EdgeInsets.symmetric(vertical: 7),
                              decoration: BoxDecoration(
                                color: bg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: isToday
                                        ? const Color(0xFF6D28D9)
                                        : widget.borderColor,
                                    width: isToday ? 2 : 1),
                              ),
                              child: Center(
                                child: Text('$d',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: fg)),
                              ),
                            );
                          }),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              // Legend
              Row(
                children: [
                  _LegendDot(
                      bg: const Color(0xFFE6FAE6),
                      border: const Color(0xFF28A745),
                      label: 'Present',
                      labelColor: widget.textLight),
                  const SizedBox(width: 14),
                  _LegendDot(
                      bg: const Color(0xFFFFF1F0),
                      border: const Color(0xFFCF1322),
                      label: 'Absent',
                      labelColor: widget.textLight),
                  const SizedBox(width: 14),
                  _LegendDot(
                      bg: kPurple,
                      border: kPurple,
                      label: 'Today',
                      labelColor: widget.textLight),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Mark leave
        SizedBox(
          width: double.infinity,
          child: Material(
            color: kPurple,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => _pickLeaveDate(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.calendarPlus, size: 18, color: Colors.white),
                    SizedBox(width: 10),
                    Text('Mark Leave for a Date',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14.5)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _pickLeaveDate(BuildContext context) async {
    final now = DateTime.now();
    final parentProvider = context.read<ParentProvider>();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
    );
    if (picked == null || !mounted) return;
    final iso =
        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    await parentProvider.markLeave(iso);
  }

  static DateTime? _parseDate(Object? v) =>
      v == null ? null : DateTime.tryParse(v.toString());

  static String _dateKey(DateTime? d) =>
      d == null ? '' : '${d.year}-${d.month}-${d.day}';
}

class _CalNav extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CalNav({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kPurpleLight,
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
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: border),
          ),
        ),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 11, color: labelColor)),
      ],
    );
  }
}

class _FeeBadge extends StatelessWidget {
  final String? status;

  const _FeeBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    late Color bg;
    late Color color;
    late String label;
    switch (status) {
      case 'paid':
        bg = const Color(0xFFE6FAE6);
        color = const Color(0xFF28A745);
        label = '✅ Fee Paid';
        break;
      case 'partial':
        bg = const Color(0xFFFFFBE6);
        color = const Color(0xFFD46B08);
        label = '⚠️ Partial Fee';
        break;
      default:
        bg = const Color(0xFFFFF1F0);
        color = const Color(0xFFCF1322);
        label = '❌ Fee Unpaid';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

// ═══════════════════ Announcements tab ═══════════════════

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
    if (parent.broadcasts.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.megaphone,
                size: 36, color: textLight.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Text('No announcements yet',
                style: TextStyle(fontSize: 14, color: textLight)),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: parent.broadcasts.length,
      itemBuilder: (context, i) {
        final b = parent.broadcasts[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.megaphone,
                      size: 16, color: AppColors.primaryBlue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text((b['title'] ?? 'Notice').toString(),
                        style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: textDark)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text((b['message'] ?? '').toString(),
                  style: TextStyle(fontSize: 13.5, height: 1.5, color: textDark)),
            ],
          ),
        );
      },
    );
  }
}

// ═══════════════════ Complaints tab ═══════════════════

class _ComplaintsTab extends StatelessWidget {
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
  Widget build(BuildContext context) {
    if (parent.childGrievances.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.messageSquare,
                size: 36, color: textLight.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Text('No complaints from your child',
                style: TextStyle(fontSize: 14, color: textLight)),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: parent.childGrievances.length,
      itemBuilder: (context, i) {
        final g = parent.childGrievances[i];
        final meta = StatusMeta.of(g.status);
        final busy = parent.isGrievanceBusy(g.id);

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Color(meta.bg),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(meta.label,
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(meta.color))),
                  ),
                  const SizedBox(width: 8),
                  if (g.category != null && g.category!.isNotEmpty)
                    Text(g.category!,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: textLight)),
                ],
              ),
              const SizedBox(height: 10),
              Text(g.text,
                  style: TextStyle(fontSize: 14, height: 1.5, color: textDark)),
              if (g.adminResponse != null && g.adminResponse!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    color: AppColors.primaryBlue.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(8),
                    border: Border(
                        left: BorderSide(
                            color: AppColors.primaryBlue, width: 3)),
                  ),
                  child: Text(g.adminResponse!,
                      style: TextStyle(fontSize: 12.5, height: 1.45, color: textDark)),
                ),
              ],
              if (g.status == 'resolved') ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Material(
                        color: const Color(0xFF28A745),
                        borderRadius: BorderRadius.circular(9),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(9),
                          onTap:
                              busy ? null : () => parent.confirmGrievance(g.id),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 9),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(LucideIcons.check,
                                    size: 14, color: Colors.white),
                                SizedBox(width: 6),
                                Text('Yes, Fixed',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12.5)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Material(
                        color: const Color(0xFFCF1322),
                        borderRadius: BorderRadius.circular(9),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(9),
                          onTap: busy ? null : () => _askReopen(context, parent, g),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 9),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(LucideIcons.rotateCcw,
                                    size: 14, color: Colors.white),
                                SizedBox(width: 6),
                                Text('Not Fixed Yet',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12.5)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _askReopen(BuildContext context, ParentProvider parent, Grievance g) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Not fixed yet'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tell the transport team what is still wrong:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: const InputDecoration(
                  hintText: 'e.g. The AC is still not cooling'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              parent.reopenGrievance(g.id, controller.text.trim());
            },
            child: const Text('Reopen',
                style: TextStyle(
                    color: Color(0xFFCF1322), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════ Analytics tab ═══════════════════

class _AnalyticsTab extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final speed = parent.speedData;
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
      
      // Extract time from telemetry data for X-axis labels
      final timeStr = telemetryList[i]['time']?.toString() ?? telemetryList[i]['timestamp']?.toString();
      if (timeStr != null && timeStr.isNotEmpty) {
        try {
          final dt = DateTime.tryParse(timeStr);
          if (dt != null) {
            xLabels[i] = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          }
        } catch (_) {
          // Fallback to index-based label
          xLabels[i] = '${i + 1}';
        }
      } else {
        xLabels[i] = '${i + 1}';
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Stat chips
        Row(
          children: [
            _SpeedChip(
                label: 'Max Speed',
                value: '${speed?['maxSpeed'] ?? '—'} km/h',
                color: const Color(0xFFEF4444)),
            const SizedBox(width: 10),
            _SpeedChip(
                label: 'Avg Speed',
                value: '${speed?['avgSpeed'] ?? '—'} km/h',
                color: kPurple),
            const SizedBox(width: 10),
            _SpeedChip(
                label: 'Overspeeds',
                value: '${speed?['overspeedCount'] ?? 0}',
                color: const Color(0xFFF97316)),
          ],
        ),
        const SizedBox(height: 16),

        // Chart
        Container(
          height: 260,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          child: spots.isEmpty
              ? Center(
                  child: Text('No speed data recorded for this date.',
                      style: TextStyle(fontSize: 13, color: textLight)),
                )
              : LineChart(
                  LineChartData(
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: true,
                      getDrawingHorizontalLine: (v) => FlLine(
                        color: borderColor,
                        strokeWidth: 1,
                      ),
                      getDrawingVerticalLine: (v) => FlLine(
                        color: borderColor.withValues(alpha: 0.3),
                        strokeWidth: 0.5,
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: (telemetryList.length / 6).ceilToDouble().clamp(1.0, double.infinity),
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (xLabels.containsKey(index)) {
                              return SideTitleWidget(
                                meta: meta,
                                child: Text(
                                  xLabels[index]!,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w500,
                                      color: textLight),
                                ),
                              );
                            }
                            return const SizedBox.shrink();
                          },
                          reservedSize: 28,
                        ),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: (spots.isNotEmpty ? ((spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) / 5).ceilToDouble()) : 10.0).clamp(5.0, double.infinity),
                          getTitlesWidget: (value, meta) {
                            return SideTitleWidget(
                              meta: meta,
                              child: Text(
                                '${value.toInt()} km/h',
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    color: textLight),
                              ),
                            );
                          },
                          reservedSize: 40,
                        ),
                      ),
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    ),
                    borderData: FlBorderData(show: false),
                    lineBarsData: [
                      LineChartBarData(
                        spots: spots,
                        isCurved: true,
                        color: kPurple,
                        barWidth: 2.2,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          color: kPurple.withValues(alpha: 0.1),
                        ),
                      ),
                    ],
                    lineTouchData: LineTouchData(
                      enabled: true,
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipItems: (touchedSpots) {
                          return touchedSpots.map((spot) {
                            final index = spot.x.toInt();
                            final timeLabel = xLabels[index] ?? '${index + 1}';
                            return LineTooltipItem(
                              '$timeLabel: ${spot.y.toStringAsFixed(1)} km/h',
                              TextStyle(
                                  color: kPurple,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12),
                            );
                          }).toList();
                        },
                      ),
                    ),
                    minY: 0,
                  ),
                ),
        ),
        const SizedBox(height: 10),
        if (speed?['speedLimit'] != null)
          Text(
            'Speed limit: ${speed!['speedLimit']} km/h — shown as the red dashed line on the web dashboard.',
            style: TextStyle(fontSize: 12, color: textLight),
          ),
      ],
    );
  }
}

class _SpeedChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SpeedChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: color)),
            const SizedBox(height: 3),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: color)),
          ],
        ),
      ),
    );
  }
}

/// Child switcher dropdown for parents with multiple children
class _ChildSwitcher extends StatelessWidget {
  final ParentProvider parent;
  final Color textColor;

  const _ChildSwitcher({required this.parent, required this.textColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: parent.selectedChildIndex,
          isExpanded: true,
          icon: Icon(LucideIcons.chevronDown, size: 18, color: textColor),
          dropdownColor: Theme.of(context).colorScheme.surface,
          style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w600),
          items: List.generate(parent.childCount, (index) {
            final child = parent.children[index];
            return DropdownMenuItem<int>(
              value: index,
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: kPurple.withValues(alpha: 0.2),
                    child: Text(
                      child.name.isNotEmpty ? child.name[0].toUpperCase() : '?',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: kPurple),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(child.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: textColor)),
                        if (child.routeId != null)
                          Text('Route ${child.routeId}', style: TextStyle(fontSize: 10, color: textColor.withValues(alpha: 0.7))),
                      ],
                    ),
                  ),
                  if (child.boardedToday)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF28A745).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'On Bus',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: const Color(0xFF28A745)),
                      ),
                    ),
                ],
              ),
            );
          }),
          onChanged: (index) {
            if (index != null) {
              parent.selectChild(index);
            }
          },
        ),
      ),
    );
  }
}
