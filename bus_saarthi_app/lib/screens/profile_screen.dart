import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../services/api_client.dart';
import '../widgets/user_avatar.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Port of the web Profile page: identity card with avatar upload, fee
/// status, bus pass QR, route/contact/academic detail cards, face
/// recognition status and the 7-day attendance strip.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? profile;
  Map<String, dynamic>? attendance;
  bool isLoading = true;
  bool isUploading = false;
  bool showIdCard = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    final user = auth.user!;
    try {
      final res = await ApiClient.dio.get(
        '/api/users/me',
        options: Options(headers: ApiClient.authHeaders(user)),
      );
      if (!mounted) return;
      final loadedProfile = res.data is Map
          ? Map<String, dynamic>.from(res.data)
          : null;
      if (!mounted) return;
      setState(() {
        profile = loadedProfile;
        isLoading = false;
      });
      // Use the immutable response snapshot; don't read widget state after await.
      auth.updateUser(
        user.copyWith(
          profilePic:
              loadedProfile?['profilePic']?.toString() ?? user.profilePic,
          feeStatus: loadedProfile?['feeStatus']?.toString() ?? user.feeStatus,
          routeId: loadedProfile?['routeId']?.toString() ?? user.routeId,
          name: loadedProfile?['name']?.toString() ?? user.name,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => isLoading = false);
      ApiClient.toast(
        context,
        ApiClient.friendlyError(
          e,
          'We could not load your profile. Please try again.',
        ),
        kind: ToastKind.error,
      );
    }
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    final user = context.read<AuthProvider>().user!;
    try {
      final res = await ApiClient.dio.get(
        '/api/attendance/user/${user.loginId}/summary?days=7',
        options: Options(headers: ApiClient.authHeaders(user)),
      );
      if (!mounted) return;
      setState(() {
        attendance = res.data is Map && res.data['data'] is Map
            ? Map<String, dynamic>.from(res.data['data'])
            : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(
        () => attendance = null,
      ); // Ensure loading state clears even on error
    }
  }

  Future<void> _uploadPic() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
    );
    if (picked == null || !mounted) return;
    final user = context.read<AuthProvider>().user!;
    setState(() => isUploading = true);
    try {
      final form = FormData();
      form.files.add(
        MapEntry(
          'file',
          await MultipartFile.fromFile(picked.path, filename: picked.name),
        ),
      );
      final res = await ApiClient.dio.post(
        '/api/upload/profile_pic',
        data: form,
        options: Options(headers: ApiClient.authHeaders(user)),
      );
      if (!mounted) return;
      if (res.data is Map && res.data['status'] == 'success') {
        final url = res.data['url'].toString();
        setState(() => profile?['profilePic'] = url);
        context.read<AuthProvider>().updateUser(user.copyWith(profilePic: url));
        ApiClient.toast(
          context,
          'Profile picture updated!',
          kind: ToastKind.success,
        );
      } else {
        ApiClient.toast(
          context,
          'The upload did not succeed. Please try a smaller file.',
          kind: ToastKind.error,
        );
      }
    } catch (e) {
      if (!mounted) return;
      ApiClient.toast(
        context,
        ApiClient.friendlyError(
          e,
          'We could not upload the image. Please try again.',
        ),
        kind: ToastKind.error,
      );
    } finally {
      if (mounted) setState(() => isUploading = false);
    }
  }

  // ── Role metadata (web ROLE_META) ──
  ({String label, Color color, IconData icon, String tagline}) get _roleMeta {
    final role =
        profile?['role']?.toString() ??
        context.read<AuthProvider>().user?.role ??
        'passenger';
    switch (role) {
      case 'parent':
        return (
          label: 'Parent',
          color: const Color(0xFF7C3AED),
          icon: LucideIcons.users,
          tagline: "Track your child's bus and complaints",
        );
      case 'teacher':
        return (
          label: 'Teacher',
          color: const Color(0xFF0EA5E9),
          icon: LucideIcons.briefcase,
          tagline: 'Staff travel and attendance',
        );
      case 'driver':
        return (
          label: 'Driver',
          color: const Color(0xFFEA580C),
          icon: LucideIcons.bus,
          tagline: 'Assigned bus and route',
        );
      case 'transport_incharge':
        return (
          label: 'Transport Incharge',
          color: const Color(0xFF28A745),
          icon: LucideIcons.bus,
          tagline: 'Fleet, routes and driver management',
        );
      case 'admin':
        return (
          label: 'Administrator',
          color: const Color(0xFFDC2626),
          icon: LucideIcons.shield,
          tagline: 'Full access to users, routes and complaints',
        );
      case 'tech_admin':
        return (
          label: 'System Administrator',
          color: const Color(0xFFDC2626),
          icon: LucideIcons.shieldCheck,
          tagline: 'Full access to users, routes and complaints',
        );
      default:
        return (
          label: 'Passenger',
          color: const Color(0xFF0056B3),
          icon: LucideIcons.graduationCap,
          tagline: 'Live tracking, grievances and attendance',
        );
    }
  }

  ({String label, Color bg, Color color}) _feeMeta(LanguageProvider lang) {
    final fee =
        profile?['feeStatus']?.toString() ??
        context.read<AuthProvider>().user?.feeStatus;
    switch (fee) {
      case 'paid':
        return (
          label: lang.t('paid'),
          bg: const Color(0xFFE6FAE6),
          color: const Color(0xFF28A745),
        );
      case 'partial':
        return (
          label: lang.t('partial'),
          bg: const Color(0xFFFFFBE6),
          color: const Color(0xFFD46B08),
        );
      default:
        return (
          label: lang.t('unknown'),
          bg: const Color(0xFFF5F5F5),
          color: const Color(0xFF9E9E9E),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final user = context.watch<AuthProvider>().user!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final bgSoft = isDark ? AppColors.darkBg : AppColors.lightBg;

    final roleMeta = _roleMeta;
    final feeMeta = _feeMeta(lang);
    final role = profile?['role']?.toString() ?? user.role;
    final isFeeRole = role == 'passenger' || role == 'teacher';

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      body: Column(
        children: [
          // Header
          Container(
            color: AppColors.primaryBlue,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const HomeScreen()),
                      ),
                      icon: const Icon(
                        LucideIcons.arrowLeft,
                        size: 22,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'My Profile',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Material(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(20),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () async {
                          await context.read<AuthProvider>().logout();
                          if (!context.mounted) return;
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(
                              builder: (_) => const LoginScreen(),
                            ),
                            (route) => false,
                          );
                        },
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                LucideIcons.logOut,
                                size: 13,
                                color: Colors.white,
                              ),
                              SizedBox(width: 5),
                              Text(
                                'Log out',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // ── Identity card ──
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: borderColor),
                        ),
                        child: Column(
                          children: [
                            // Avatar + camera
                            Stack(
                              children: [
                                UserAvatar(
                                  src:
                                      (profile?['profilePic'] ??
                                              user.profilePic)
                                          ?.toString(),
                                  name: (profile?['name'] ?? user.name)
                                      .toString(),
                                  size: 108,
                                ),
                                Positioned(
                                  bottom: 0,
                                  right: 0,
                                  child: Material(
                                    color: AppColors.secondaryOrange,
                                    shape: CircleBorder(
                                      side: BorderSide(color: cardBg, width: 2),
                                    ),
                                    child: InkWell(
                                      customBorder: const CircleBorder(),
                                      onTap: isUploading ? null : _uploadPic,
                                      child: SizedBox(
                                        width: 32,
                                        height: 32,
                                        child: isUploading
                                            ? const Padding(
                                                padding: EdgeInsets.all(8),
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  valueColor:
                                                      AlwaysStoppedAnimation(
                                                        Colors.white,
                                                      ),
                                                ),
                                              )
                                            : const Icon(
                                                LucideIcons.camera,
                                                size: 15,
                                                color: Colors.white,
                                              ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Text(
                              (profile?['name'] ?? user.name).toString(),
                              style: TextStyle(
                                fontSize: 21,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                                color: textDark,
                              ),
                            ),
                            const SizedBox(height: 7),
                            Wrap(
                              alignment: WrapAlignment.center,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              spacing: 8,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: roleMeta.color.withValues(
                                      alpha: 0.09,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        roleMeta.icon,
                                        size: 13,
                                        color: roleMeta.color,
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        roleMeta.label,
                                        style: TextStyle(
                                          color: roleMeta.color,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  user.loginId,
                                  style: TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: textLight,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              roleMeta.tagline,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: textLight),
                            ),

                            // Fee status pill
                            if (isFeeRole) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: feeMeta.bg,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  feeMeta.label,
                                  style: TextStyle(
                                    color: feeMeta.color,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],

                            // Bus pass
                            if (isFeeRole) ...[
                              const SizedBox(height: 14),
                              SizedBox(
                                width: double.infinity,
                                child: Material(
                                  color: bgSoft,
                                  borderRadius: BorderRadius.circular(12),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () => setState(
                                      () => showIdCard = !showIdCard,
                                    ),
                                    child: Container(
                                      padding: const EdgeInsets.all(11),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: borderColor),
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            LucideIcons.creditCard,
                                            size: 16,
                                            color: textDark,
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            showIdCard
                                                ? 'Hide bus pass'
                                                : 'View bus pass',
                                            style: TextStyle(
                                              color: textDark,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              if (showIdCard) ...[
                                const SizedBox(height: 14),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(20),
                                  decoration: BoxDecoration(
                                    color: bgSoft,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: borderColor),
                                  ),
                                  child: Column(
                                    children: [
                                      Container(
                                        width: 132,
                                        height: 132,
                                        decoration: BoxDecoration(
                                          color: cardBg,
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                          border: Border.all(
                                            color: borderColor,
                                          ),
                                        ),
                                        child: Icon(
                                          LucideIcons.qrCode,
                                          size: 96,
                                          color: textDark,
                                        ),
                                      ),
                                      const SizedBox(height: 14),
                                      Text(
                                        (profile?['name'] ?? user.name)
                                            .toString(),
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: textDark,
                                        ),
                                      ),
                                      Text(
                                        user.loginId,
                                        style: TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 13,
                                          color: textLight,
                                        ),
                                      ),
                                      if ((profile?['routeId'] ??
                                              user.routeId) !=
                                          null) ...[
                                        const SizedBox(height: 5),
                                        Builder(
                                          builder: (_) {
                                            final rid =
                                                (profile?['routeId'] ??
                                                        user.routeId)
                                                    .toString();
                                            final routeLabel =
                                                profile?['routeName']
                                                    ?.toString() ??
                                                'Route $rid';
                                            final bus = profile?['busNumber']
                                                ?.toString();
                                            return Text(
                                              bus != null && bus.isNotEmpty
                                                  ? '$routeLabel · Bus $bus'
                                                  : routeLabel,
                                              style: TextStyle(
                                                fontSize: 12.5,
                                                color: textLight,
                                              ),
                                            );
                                          },
                                        ),
                                      ],
                                      const SizedBox(height: 12),
                                      Text(
                                        lang.t('scanQrHint'),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: textLight,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      // ── Route & bus ──
                      if (profile?['routeId'] != null) ...[
                        _Section(
                          isDark: isDark,
                          title: 'Route & bus',
                          icon: LucideIcons.bus,
                          children: [
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.creditCard,
                              label: 'Route',
                              value: profile?['routeName'] != null
                                  ? '${profile!['routeName']} (${profile!['routeId']})'
                                  : 'Route ${profile!['routeId']}',
                            ),
                            if (profile?['busNumber'] != null)
                              _Detail(
                                isDark: isDark,
                                bgSoft: bgSoft,
                                icon: LucideIcons.bus,
                                label: 'Bus serving this route',
                                value: '${profile!['busNumber']}',
                                mono: true,
                              ),
                            if (profile?['driverName'] != null)
                              _Detail(
                                isDark: isDark,
                                bgSoft: bgSoft,
                                icon: LucideIcons.user,
                                label: 'Driver',
                                value: '${profile!['driverName']}',
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                      ],

                      // ── Contact ──
                      _Section(
                        isDark: isDark,
                        title: 'Contact',
                        icon: LucideIcons.phone,
                        children: [
                          _Detail(
                            isDark: isDark,
                            bgSoft: bgSoft,
                            icon: LucideIcons.phone,
                            label: 'Phone',
                            value: profile?['phone']?.toString(),
                          ),
                          _Detail(
                            isDark: isDark,
                            bgSoft: bgSoft,
                            icon: LucideIcons.mail,
                            label: 'Email',
                            value: profile?['email']?.toString(),
                          ),
                          _Detail(
                            isDark: isDark,
                            bgSoft: bgSoft,
                            icon: LucideIcons.mapPin,
                            label: 'Address',
                            value: profile?['address']?.toString(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // ── Academic details ──
                      if (isFeeRole) ...[
                        _Section(
                          isDark: isDark,
                          title: 'Academic details',
                          icon: LucideIcons.graduationCap,
                          children: [
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.graduationCap,
                              label: role == 'teacher'
                                  ? 'Class / course'
                                  : 'Class',
                              value: profile?['gradeClass']?.toString(),
                            ),
                            if (role == 'teacher')
                              _Detail(
                                isDark: isDark,
                                bgSoft: bgSoft,
                                icon: LucideIcons.briefcase,
                                label: 'Subject',
                                value: profile?['subject']?.toString(),
                              ),
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.calendarDays,
                              label: 'Date of birth',
                              value: _fmtDate(profile?['dob']),
                            ),
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.droplets,
                              label: 'Blood group',
                              value: profile?['bloodGroup']?.toString(),
                            ),
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.users,
                              label: 'Parent / guardian',
                              value: profile?['parentName']?.toString(),
                            ),
                            _Detail(
                              isDark: isDark,
                              bgSoft: bgSoft,
                              icon: LucideIcons.phone,
                              label: 'Parent phone',
                              value: profile?['parentPhone']?.toString(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                      ],

                      // ── Face recognition ──
                      if (role == 'passenger') ...[
                        _Section(
                          isDark: isDark,
                          title: 'Face recognition',
                          icon: LucideIcons.fingerprint,
                          children: [
                            Row(
                              children: [
                                if (profile?['faceEnrolledAt'] != null)
                                  const Icon(
                                    LucideIcons.checkCircle2,
                                    size: 17,
                                    color: Color(0xFF28A745),
                                  )
                                else
                                  const Icon(
                                    LucideIcons.alertTriangle,
                                    size: 17,
                                    color: Color(0xFFD46B08),
                                  ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    profile?['faceEnrolledAt'] != null
                                        ? 'Enrolled on ${_fmtDate(profile?['faceEnrolledAt'])}'
                                        : 'Not enrolled yet — visit the transport office',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: profile?['faceEnrolledAt'] != null
                                          ? const Color(0xFF28A745)
                                          : const Color(0xFFD46B08),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                      ],

                      // ── Attendance ──
                      if (isFeeRole) ...[
                        _Section(
                          isDark: isDark,
                          title: 'Attendance',
                          icon: LucideIcons.checkCircle2,
                          children: [
                            if (attendance != null &&
                                attendance!['days'] is List &&
                                (attendance!['days'] as List).isNotEmpty) ...[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '${attendance!['attendancePercent'] ?? 0}%',
                                    style: TextStyle(
                                      fontSize: 30,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5,
                                      color: textDark,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'present · ${attendance!['presentDays'] ?? 0} of ${attendance!['totalDays'] ?? 0} days',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: textLight,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  for (final day
                                      in (attendance!['days'] as List).take(7))
                                    Expanded(
                                      child: _AttendanceDay(
                                        day: Map<String, dynamic>.from(
                                          day as Map,
                                        ),
                                        isDark: isDark,
                                        bgSoft: bgSoft,
                                        borderColor: borderColor,
                                        textLight: textLight,
                                      ),
                                    ),
                                ],
                              ),
                              if ((attendance!['totalRecords'] ?? 0) > 0) ...[
                                const SizedBox(height: 14),
                                Text(
                                  '${attendance!['totalRecords']} boardings recorded by the bus scanner.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: textLight,
                                  ),
                                ),
                              ],
                            ] else
                              Text(
                                isLoading
                                    ? 'Loading attendance…'
                                    : 'No attendance has been recorded for you yet. It appears here once the bus scanner recognises you.',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  color: textLight,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  static String? _fmtDate(Object? v) {
    if (v == null) return null;
    final d = DateTime.tryParse(v.toString());
    if (d == null) return null;
    const months = [
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
    return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
  }
}

class _AttendanceDay extends StatelessWidget {
  final Map<String, dynamic> day;
  final bool isDark;
  final Color bgSoft;
  final Color borderColor;
  final Color textLight;

  const _AttendanceDay({
    required this.day,
    required this.isDark,
    required this.bgSoft,
    required this.borderColor,
    required this.textLight,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse('${day['date']}T00:00:00') ?? DateTime.now();
    const dows = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    final dow = dows[date.weekday - 1];
    final present = day['present'] == true;

    return Column(
      children: [
        Text(
          dow,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: textLight,
          ),
        ),
        const SizedBox(height: 5),
        AspectRatio(
          aspectRatio: 1,
          child: Container(
            decoration: BoxDecoration(
              color: present ? const Color(0xFFE6FAE6) : bgSoft,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: present ? const Color(0xFFC3E6C3) : borderColor,
              ),
            ),
            child: Icon(
              present ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
              size: 17,
              color: present
                  ? const Color(0xFF28A745)
                  : const Color(0xFFADB5BD),
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          '${date.day}',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: textLight,
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final bool isDark;
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _Section({
    required this.isDark,
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
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
              Icon(icon, size: 15, color: AppColors.primaryBlue),
              const SizedBox(width: 8),
              Text(
                title.toUpperCase(),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.7,
                  color: AppColors.primaryBlue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  final bool isDark;
  final Color bgSoft;
  final IconData icon;
  final String label;
  final String? value;
  final bool mono;

  const _Detail({
    required this.isDark,
    required this.bgSoft,
    required this.icon,
    required this.label,
    this.value,
    this.mono = false,
  });

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: bgSoft,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 15, color: AppColors.primaryBlue),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: textLight,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value!,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    fontFamily: mono ? 'monospace' : null,
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
