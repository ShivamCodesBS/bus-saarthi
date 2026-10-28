import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cache/flutter_map_cache.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/stop_coords.dart';
import '../core/theme.dart';
import '../models/notification_item.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../providers/tracking_provider.dart';
import '../services/api_client.dart';
import '../services/map_cache_service.dart';
import '../widgets/hamburger_drawer.dart';
import '../widgets/wake_alarm_modal.dart';
import 'full_map_screen.dart';

/// 1:1 port of the web Home page: glass header with the notification
/// dropdown, merge/cancel banner, SOS + wake-alarm action bar, route
/// details, live telemetry, stop timeline and the live map.
///
/// This widget owns the TrackingProvider (created from the session user)
/// and hands it to the actual view below.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    return ChangeNotifierProvider(
      create: (_) => TrackingProvider(user),
      child: const _HomeView(),
    );
  }
}

class _HomeView extends StatefulWidget {
  const _HomeView();

  @override
  State<_HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<_HomeView> {
  bool _isMenuOpen = false;
  bool _showMap = false;
  bool _showNotifications = false;
  bool _showAlarmModal = false;
  final GlobalKey _bellKey = GlobalKey();
  final AudioPlayer _beepPlayer = AudioPlayer();
  Map<String, dynamic>? _lastBroadcast;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final tracking = context.read<TrackingProvider>();
      tracking.attachToastContext(context);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Play the broadcast beep when a new broadcast arrives (web AudioContext port).
    final tracking = context.watch<TrackingProvider>();
    if (tracking.activeBroadcast != null &&
        !mapEquals(tracking.activeBroadcast, _lastBroadcast)) {
      _lastBroadcast = Map<String, dynamic>.from(tracking.activeBroadcast!);
      _beepPlayer.play(AssetSource('sounds/broadcast_beep.wav'));
    }
  }

  @override
  void dispose() {
    _beepPlayer.dispose();
    super.dispose();
  }

  Future<void> _handleSos(TrackingProvider tracking) async {
    final lang = context.read<LanguageProvider>();
    if (tracking.sosPhase == SosPhase.counting) {
      tracking.cancelSosCountdown();
      return;
    }
    if (tracking.sosPhase == SosPhase.active) {
      final bool? confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(lang.t('confirm')),
          content: Text(
            lang.lang == 'hi'
                ? 'क्या आप सक्रिय SOS अलर्ट रद्द करना चाहते हैं?'
                : 'Do you want to cancel the active SOS alert?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(lang.t('cancel')),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(lang.t('cancelSos')),
            ),
          ],
        ),
      );
      if (confirmed == true) {
        final ok = await tracking.cancelActiveSos();
        if (mounted) {
          ApiClient.toast(
            context,
            ok
                ? 'SOS Alert Cancelled.'
                : 'We could not cancel the SOS. Please try again.',
            kind: ok ? ToastKind.success : ToastKind.error,
          );
        }
      }
      return;
    }
    tracking.startSosCountdown();
  }

  Future<void> _handleWakeAlarm(TrackingProvider tracking) async {
    if (tracking.alarmLoading) return;
    if (tracking.alarmSet) {
      final ok = await tracking.cancelWakeAlarm();
      if (mounted) {
        ApiClient.toast(
          context,
          ok
              ? '🔕 Wake alarm cancelled.'
              : 'We could not cancel the alarm. Please try again.',
          kind: ok ? ToastKind.success : ToastKind.error,
        );
      }
    } else {
      setState(() => _showAlarmModal = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final auth = context.watch<AuthProvider>();
    final tracking = context.watch<TrackingProvider>();
    final user = auth.user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    final bool isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          Column(
            children: [
              // ── HEADER ──
              _Header(
                lang: lang,
                user: user,
                isDark: isDark,
                hasUnread: tracking.hasUnread,
                showNotifications: _showNotifications,
                bellKey: _bellKey,
                onBellTap: () {
                  setState(() {
                    _showNotifications = !_showNotifications;
                    if (_showNotifications) tracking.markNotificationsSeen();
                  });
                },
                onMenuTap: () => setState(() => _isMenuOpen = true),
              ),

              // ── MAIN ──
              Expanded(
                child: Container(
                  color: isDark ? AppColors.darkBg : AppColors.lightBg,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Merge & cancellation banner
                        if (tracking.mergeInfo != null)
                          _MergeBanner(info: tracking.mergeInfo!, lang: lang),

                        const SizedBox(height: 12),

                        // Action bar (SOS + Wake alarm)
                        Row(
                          children: [
                            Expanded(
                              child: _SosButton(
                                lang: lang,
                                phase: tracking.sosPhase,
                                countdown: tracking.sosCountdown,
                                onTap: () => _handleSos(tracking),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _AlarmButton(
                                lang: lang,
                                alarmSet: tracking.alarmSet,
                                loading: tracking.alarmLoading,
                                onTap: () => _handleWakeAlarm(tracking),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 24),

                        // Route details card
                        _RouteDetailsCard(
                          lang: lang,
                          user: user,
                          tracking: tracking,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 24),

                        // Live telemetry card
                        _TelemetryCard(
                          lang: lang,
                          tracking: tracking,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 16),

                        if (!_showMap)
                          _OpenMapButton(
                            lang: lang,
                            onTap: () => setState(() => _showMap = true),
                          ),

                        if (_showMap) ...[
                          const SizedBox(height: 16),
                          _MapCard(
                            lang: lang,
                            tracking: tracking,
                            isDark: isDark,
                            onExpand: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  fullscreenDialog: true,
                                  builder: (_) =>
                                      FullMapScreen(tracking: tracking),
                                ),
                              );
                            },
                            onClose: () => setState(() => _showMap = false),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Upcoming stops timeline
                        _StopsTimeline(
                          lang: lang,
                          tracking: tracking,
                          isDark: isDark,
                        ),

                        const SizedBox(height: 24),

                        // Footer
                        Center(
                          child: Text(
                            '© ${DateTime.now().year} Invertis Innovation and Incubation.',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppColors.darkTextMuted.withValues(
                                      alpha: 0.8,
                                    )
                                  : AppColors.lightTextMuted,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          // ── Notification dropdown panel ──
          if (_showNotifications)
            Positioned(
              top: 0,
              right: 8,
              child: _NotificationPanel(
                lang: lang,
                notifications: tracking.allNotifications,
                isDark: isDark,
                onClose: () => setState(() => _showNotifications = false),
              ),
            ),

          // ── Drawer ──
          if (_isMenuOpen) ...[
            Positioned.fill(
              child: GestureDetector(
                onTap: () => setState(() => _isMenuOpen = false),
                child: Container(color: Colors.black.withValues(alpha: 0.4)),
              ),
            ),
            Positioned.fill(
              child: HamburgerDrawer(
                activePath: '/home',
                onClose: () => setState(() => _isMenuOpen = false),
              ),
            ),
          ],

          // ── Global broadcast popup ──
          if (tracking.activeBroadcast != null)
            _BroadcastPopup(
              data: tracking.activeBroadcast!,
              lang: lang,
              isDark: isDark,
              onAcknowledge: tracking.acknowledgeBroadcast,
            ),

          // ── Wake alarm modal ──
          if (_showAlarmModal)
            _ModalScrim(
              onDismiss: () => setState(() => _showAlarmModal = false),
              child: WakeAlarmModal(
                onClose: () => setState(() => _showAlarmModal = false),
              ),
            ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════ Header ═══════════════════════════════

class _Header extends StatelessWidget {
  final LanguageProvider lang;
  final UserModel user;
  final bool isDark;
  final bool hasUnread;
  final bool showNotifications;
  final GlobalKey bellKey;
  final VoidCallback onBellTap;
  final VoidCallback onMenuTap;

  const _Header({
    required this.lang,
    required this.user,
    required this.isDark,
    required this.hasUnread,
    required this.showNotifications,
    required this.bellKey,
    required this.onBellTap,
    required this.onMenuTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color headerBg = isDark
        ? const Color(0xD90F172A) // slate-900/85
        : const Color(0xD9FFFFFF); // white/85
    final Color borderColor = isDark
        ? const Color(0xFF1E293B)
        : const Color(0xFFE2E8F0);

    return Container(
      decoration: BoxDecoration(
        color: headerBg,
        border: Border(bottom: BorderSide(color: borderColor)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.only(left: 12, right: 12, top: 6, bottom: 6),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            // Logo chip
            Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF334155)
                      : const Color(0xFFE2E8F0),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 2,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Image.asset(
                'assets/images/logo.png',
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text.rich(
                    TextSpan(
                      text: 'BUS ',
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        color: isDark
                            ? const Color(0xFF60A5FA)
                            : const Color(0xFF1D4ED8),
                      ),
                      children: const [
                        TextSpan(
                          text: 'SAARTHI',
                          style: TextStyle(color: Color(0xFFF97316)),
                        ),
                      ],
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${lang.t('welcome')}, ${lang.translateName(user.name) ?? 'Passenger'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                      color: isDark
                          ? AppColors.darkTextMuted
                          : const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Bell with unread dot
            Stack(
              alignment: Alignment.topRight,
              children: [
                IconButton(
                  onPressed: onBellTap,
                  icon: Icon(
                    LucideIcons.bell,
                    size: 22,
                    color: hasUnread
                        ? const Color(0xFFEF4444)
                        : (isDark
                              ? AppColors.darkForeground
                              : const Color(0xFF334155)),
                  ),
                ),
                if (hasUnread)
                  Positioned(
                    top: 6,
                    right: 8,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isDark
                              ? const Color(0xFF0F172A)
                              : Colors.white,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            // Hamburger (mobile always shows it, like the web < lg)
            IconButton(
              onPressed: onMenuTap,
              icon: Icon(
                LucideIcons.menu,
                size: 24,
                color: isDark
                    ? AppColors.darkForeground
                    : const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═════════════════════ Notification dropdown panel ═════════════════════

class _NotificationPanel extends StatelessWidget {
  final LanguageProvider lang;
  final List<NotificationItem> notifications;
  final bool isDark;
  final VoidCallback onClose;

  const _NotificationPanel({
    required this.lang,
    required this.notifications,
    required this.isDark,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final Color cardBg = isDark ? const Color(0xFF0F172A) : Colors.white;
    final Color border = isDark
        ? const Color(0xFF1E293B)
        : const Color(0xFFE2E8F0);

    return Container(
      margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 56),
      width: MediaQuery.of(context).size.width < 400
          ? MediaQuery.of(context).size.width - 16
          : 384,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
        boxShadow: AppShadows.large,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  '${lang.t('notifications')}${notifications.isNotEmpty ? ' (${notifications.length})' : ''}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
              ),
              InkWell(
                onTap: onClose,
                borderRadius: BorderRadius.circular(999),
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(
                    LucideIcons.x,
                    size: 18,
                    color: isDark
                        ? AppColors.darkTextMuted
                        : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 350),
              child: SingleChildScrollView(
                child: notifications.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Column(
                          children: [
                            Icon(
                              LucideIcons.bell,
                              size: 32,
                              color:
                                  (isDark
                                          ? AppColors.darkTextMuted
                                          : const Color(0xFF64748B))
                                      .withValues(alpha: 0.5),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              lang.t('noNewUpdates'),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isDark
                                    ? AppColors.darkTextMuted
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      )
                    : Column(
                        children: [
                          for (final n in notifications) ...[
                            _NotificationRow(item: n, isDark: isDark),
                            const SizedBox(height: 12),
                          ],
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  final NotificationItem item;
  final bool isDark;

  const _NotificationRow({required this.item, required this.isDark});

  @override
  Widget build(BuildContext context) {
    late Color bg, border, titleColor, descColor, iconColor;
    late IconData icon;

    switch (item.type) {
      case 'broadcast':
        bg = isDark ? const Color(0x331C2E5E) : const Color(0xFFEFF6FF);
        border = isDark ? const Color(0xFF1E3A8A) : const Color(0xFFBFDBFE);
        titleColor = isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB);
        descColor = isDark ? const Color(0xFF93C5FD) : const Color(0xFF3B82F6);
        iconColor = const Color(0xFF3B82F6);
        icon = LucideIcons.activity;
        break;
      case 'sos':
        bg = isDark ? const Color(0x33451A1A) : const Color(0xFFFEF2F2);
        border = isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFECACA);
        titleColor = isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626);
        descColor = isDark ? const Color(0xFFFCA5A5) : const Color(0xFFEF4444);
        iconColor = const Color(0xFFEF4444);
        icon = LucideIcons.alertOctagon;
        break;
      default:
        bg = isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC);
        border = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
        titleColor = isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155);
        descColor = isDark ? AppColors.darkTextMuted : const Color(0xFF64748B);
        iconColor = isDark ? AppColors.darkTextMuted : const Color(0xFF64748B);
        icon = LucideIcons.messageSquare;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: titleColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.time,
                      style: TextStyle(fontSize: 10, color: descColor),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.message,
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.45,
                    color: descColor,
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

// ═══════════════════════ Merge / cancel banner ═══════════════════════

class _MergeBanner extends StatelessWidget {
  final MergeInfo info;
  final LanguageProvider lang;

  const _MergeBanner({required this.info, required this.lang});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFDC2626), Color(0xFFEA580C), Color(0xFFD97706)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.20),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.secondaryOrange.withValues(alpha: 0.20),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.20),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  info.isCancelled ? LucideIcons.trash2 : LucideIcons.gitMerge,
                  size: 26,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        info.isCancelled
                            ? 'BUS CANCELLED TODAY'
                            : 'BUS CHANGED TODAY',
                        style: const TextStyle(
                          color: Color(0xFFDC2626),
                          fontWeight: FontWeight.w900,
                          fontSize: 10,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      info.isCancelled
                          ? 'Bus ${info.cancelledBusNumber ?? ''} (${info.cancelledRouteName ?? ''}) is cancelled'
                          : 'Board Bus ${info.newBusNumber ?? ''} (${info.newRouteName ?? ''})',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      info.isCancelled
                          ? 'Your bus (${info.cancelledBusNumber ?? 'assigned'}) has been cancelled today. ${info.message ?? 'No replacement bus is available.'}'
                          : 'Your regular bus (${info.cancelledBusNumber ?? 'assigned'}) was merged today. Your face recognition & attendance are eligible on Bus ${info.newBusNumber}.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 11.5,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  info.isCancelled ? 'No Service Today' : 'Tracking Active',
                  style: TextStyle(
                    color: const Color(0xFFFED7AA),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  'Route ${info.isCancelled ? (info.cancelledRouteId ?? '') : (info.newRouteId ?? '')}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
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

// ═══════════════════════════════ SOS + Alarm ═══════════════════════════════

class _SosButton extends StatelessWidget {
  final LanguageProvider lang;
  final SosPhase phase;
  final int countdown;
  final VoidCallback onTap;

  const _SosButton({
    required this.lang,
    required this.phase,
    required this.countdown,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    late Color bg;
    late Color fg;
    Border? border;
    String label;

    if (phase == SosPhase.counting) {
      bg = const Color(0xFFF59E0B);
      fg = Colors.white;
      label = '${lang.t('cancelCountdown')} (${countdown}s)';
    } else if (phase == SosPhase.active) {
      bg = const Color(0xFFFEF2F2);
      fg = const Color(0xFFDC2626);
      border = Border.all(color: const Color(0xFFEF4444));
      label = lang.t('cancelSos');
    } else {
      bg = const Color(0xFFE52B36);
      fg = Colors.white;
      label = lang.t('emergency');
    }

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: border,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.alertOctagon, size: 18, color: fg),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AlarmButton extends StatelessWidget {
  final LanguageProvider lang;
  final bool alarmSet;
  final bool loading;
  final VoidCallback onTap;

  const _AlarmButton({
    required this.lang,
    required this.alarmSet,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg = alarmSet ? const Color(0xFFEEF6FF) : Colors.white;
    final Color fg = alarmSet ? const Color(0xFF1D63ED) : AppColors.lightText;
    final bool isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: isDark && !alarmSet ? const Color(0xFF0F172A) : bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: loading ? null : onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: alarmSet
                  ? const Color(0xFF1D63ED)
                  : (isDark
                        ? const Color(0xFF1E293B)
                        : const Color(0xFFE2E8F0)),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else ...[
                Icon(LucideIcons.alarmClock, size: 18, color: fg),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  loading
                      ? lang.t('setting')
                      : (alarmSet ? lang.t('alarmOn') : lang.t('wakeAlarm')),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════ Route details card ═══════════════════════════

class _RouteDetailsCard extends StatelessWidget {
  final LanguageProvider lang;
  final UserModel user;
  final TrackingProvider tracking;
  final bool isDark;

  const _RouteDetailsCard({
    required this.lang,
    required this.user,
    required this.tracking,
    required this.isDark,
  });

  Color get _statusColor {
    switch (tracking.crowdStatus.status) {
      case 'Over Crowd':
        return isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626);
      case 'Medium':
        return const Color(0xFFF97316);
      default:
        return isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A);
    }
  }

  Color get _barColor {
    switch (tracking.crowdStatus.status) {
      case 'Over Crowd':
        return const Color(0xFFEF4444);
      case 'Medium':
        return const Color(0xFFF97316);
      default:
        return const Color(0xFF22C55E);
    }
  }

  String get _statusText {
    final s = tracking.crowdStatus.status;
    if (s == 'Over Crowd') return 'Over Crowd';
    if (lang.lang == 'hi') {
      if (s == 'Low') return 'कम';
      if (s == 'Medium') return 'मध्यम';
      if (s == 'High') return 'अधिक';
      if (s == 'Loading...') return 'लोड हो रहा है...';
    }
    return s;
  }

  @override
  Widget build(BuildContext context) {
    final routeInfo = tracking.routeInfo;
    final driver = routeInfo?.driver;
    final double fillFraction = tracking.crowdStatus.total > 0
        ? (tracking.crowdStatus.filled / tracking.crowdStatus.total).clamp(
            0.0,
            1.0,
          )
        : 0.0;

    return _GlassCard(
      isDark: isDark,
      header: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              lang.t('yourRouteDetails'),
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? const Color(0xFF60A5FA)
                    : const Color(0xFF1D4ED8),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: isDark ? const Color(0x4D14532D) : const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              lang.t('boardedStatus'),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? const Color(0xFF4ADE80)
                    : const Color(0xFF15803D),
              ),
            ),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Crowd predictor
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0x331C1917) : const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? const Color(0xFF7C2D12)
                    : const Color(0xFFFFEDD5),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(LucideIcons.users, size: 15, color: _statusColor),
                        const SizedBox(width: 8),
                        Text(
                          lang.t('liveCrowdStatus'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _statusColor,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      _statusText,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _statusColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(0xFF1E293B)
                            : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    FractionallySizedBox(
                      widthFactor: fillFraction,
                      child: Container(
                        height: 8,
                        decoration: BoxDecoration(
                          color: _barColor,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    if (tracking.crowdStatus.filled > 0)
                      FractionallySizedBox(
                        widthFactor: fillFraction,
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: _barColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.15),
                                  blurRadius: 3,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  '${tracking.crowdStatus.filled}/${tracking.crowdStatus.total} ${lang.t('seatsFilled')} • ${tracking.crowdStatus.status == 'Over Crowd' ? lang.t('likelyStanding') : lang.t('seatsAvailable')}',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppColors.darkTextMuted
                        : const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Route row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0x4D1E3A8A)
                      : const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  LucideIcons.bus,
                  size: 22,
                  color: isDark
                      ? const Color(0xFF60A5FA)
                      : const Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            '${lang.t('route')} ${tracking.effectiveRouteId}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isDark
                                  ? AppColors.darkTextMuted
                                  : const Color(0xFF64748B),
                            ),
                          ),
                        ),
                        if (tracking.mergeInfo != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0x807C2D12)
                                  : const Color(0xFFFFEDD5),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              lang.t('activeMergedBus'),
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: isDark
                                    ? const Color(0xFFFDBA74)
                                    : const Color(0xFFC2410C),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(
                        text: routeInfo?.busNumber ?? 'Loading...',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark
                              ? Colors.white
                              : const Color(0xFF0F172A),
                        ),
                        children: [
                          if (routeInfo?.routeName != null)
                            TextSpan(
                              text: '  (${routeInfo!.routeName})',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? AppColors.darkTextMuted
                                    : const Color(0xFF64748B),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Driver row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0x4D7C2D12)
                      : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  LucideIcons.user,
                  size: 22,
                  color: const Color(0xFFF97316),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lang.t('driverName'),
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? AppColors.darkTextMuted
                            : const Color(0xFF64748B),
                      ),
                    ),
                    Text(
                      lang.translateName(driver?.name) ??
                          driver?.name ??
                          lang.t('assigning'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                    if (driver?.phone != null && driver!.phone!.isNotEmpty)
                      Text(
                        driver.phone!,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppColors.darkTextMuted
                              : const Color(0xFF475569),
                        ),
                      ),
                  ],
                ),
              ),
              Material(
                color: isDark
                    ? const Color(0x4D14532D)
                    : const Color(0xFFDCFCE7),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () async {
                    final phone = driver?.phone;
                    if (phone != null && phone.isNotEmpty) {
                      final uri = Uri(scheme: 'tel', path: phone);
                      try {
                        await launchUrl(uri);
                      } catch (_) {
                        // Dialer unavailable  --  ignore, same as web fallback number.
                      }
                    }
                  },
                  child: const Padding(
                    padding: EdgeInsets.all(12),
                    child: Icon(
                      LucideIcons.phone,
                      size: 18,
                      color: Color(0xFF16A34A),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════ Telemetry card ═══════════════════════════

class _TelemetryCard extends StatelessWidget {
  final LanguageProvider lang;
  final TrackingProvider tracking;
  final bool isDark;

  const _TelemetryCard({
    required this.lang,
    required this.tracking,
    required this.isDark,
  });

  String _direction(double? heading) {
    if (heading == null || heading.isNaN) return ' -- ';
    double h = heading % 360;
    if (h < 0) h += 360;
    final key = (h >= 315 || h < 45)
        ? 'north'
        : (h >= 45 && h < 135)
        ? 'east'
        : (h >= 135 && h < 225)
        ? 'south'
        : 'west';
    return lang.t(key);
  }

  String _comfort(String? c) {
    if (lang.lang == 'hi') {
      if (c?.toLowerCase() == 'smooth') return 'सुगम';
      if (c?.toLowerCase() == 'bumpy') return 'अस्थिर';
    }
    return c ?? 'Smooth';
  }

  @override
  Widget build(BuildContext context) {
    final telemetry = tracking.telemetry;

    return _GlassCard(
      isDark: isDark,
      header: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            lang.t('liveSensors'),
            style: TextStyle(
              fontSize: 16.5,
              fontWeight: FontWeight.w700,
              color: isDark ? const Color(0xFF60A5FA) : const Color(0xFF1D4ED8),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: telemetry != null
                  ? (isDark ? const Color(0x3314532D) : const Color(0xFFF0FDF4))
                  : (isDark
                        ? const Color(0x33450A0A)
                        : const Color(0xFFFEF2F2)),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: telemetry != null
                    ? (isDark
                          ? const Color(0xFF166534)
                          : const Color(0xFFBBF7D0))
                    : (isDark
                          ? const Color(0xFF7F1D1D)
                          : const Color(0xFFFECACA)),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (telemetry != null) ...[
                  const _PulsingDot(),
                  const SizedBox(width: 6),
                ],
                Text(
                  telemetry != null
                      ? lang.t('sensorLive')
                      : lang.t('sensorOffline'),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: telemetry != null
                        ? (isDark
                              ? const Color(0xFF4ADE80)
                              : const Color(0xFF15803D))
                        : (isDark
                              ? const Color(0xFFF87171)
                              : const Color(0xFFB91C1C)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      child: telemetry != null
          ? Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _TelemetryTile(
                        isDark: isDark,
                        label: 'Speed',
                        icon: LucideIcons.activity,
                        iconColor: const Color(0xFF3B82F6),
                        value: '${telemetry.speed.toStringAsFixed(1)}',
                        unit: 'km/h',
                        valueSize: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _TelemetryTile(
                        isDark: isDark,
                        label: 'Direction',
                        icon: LucideIcons.compass,
                        iconColor: const Color(0xFFF97316),
                        value: _direction(telemetry.heading),
                        heading: telemetry.heading,
                        valueSize: 17,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF1E293B)
                        : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF334155)
                          : const Color(0xFFF1F5F9),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            LucideIcons.wind,
                            size: 17,
                            color: telemetry.comfort.toLowerCase() == 'smooth'
                                ? const Color(0xFF22C55E)
                                : const Color(0xFFF97316),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            lang.t('rideComfort'),
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppColors.darkTextMuted
                                  : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        _comfort(telemetry.comfort),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: telemetry.comfort.toLowerCase() == 'smooth'
                              ? (isDark
                                    ? const Color(0xFF4ADE80)
                                    : const Color(0xFF16A34A))
                              : const Color(0xFFF97316),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            )
          : Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0x33450A0A)
                    : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF7F1D1D)
                      : const Color(0xFFFECACA),
                  width: 2,
                  strokeAlign: BorderSide.strokeAlignInside,
                ),
              ),
              child: Column(
                children: [
                  Icon(
                    LucideIcons.alertOctagon,
                    size: 32,
                    color: const Color(0xFFEF4444).withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    lang.t('sensorsNotConnected'),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? const Color(0xFFF87171)
                          : const Color(0xFFDC2626),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lang.t('waitingForHardware'),
                    style: TextStyle(
                      fontSize: 13,
                      color:
                          (isDark
                                  ? const Color(0xFFF87171)
                                  : const Color(0xFFDC2626))
                              .withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween(begin: 0.4, end: 1.0).animate(_c),
    child: Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: Color(0xFF22C55E),
        shape: BoxShape.circle,
      ),
    ),
  );
}

class _TelemetryTile extends StatelessWidget {
  final bool isDark;
  final String label;
  final IconData icon;
  final Color iconColor;
  final String value;
  final String? unit;
  final double? heading;
  final double valueSize;

  const _TelemetryTile({
    required this.isDark,
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.value,
    this.unit,
    this.heading,
    required this.valueSize,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: iconColor),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppColors.darkTextMuted
                        : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              if (heading != null) ...[
                Transform.rotate(
                  angle: heading! * 3.14159 / 180,
                  child: Icon(
                    LucideIcons.navigation,
                    size: 17,
                    color: isDark
                        ? AppColors.darkForeground
                        : const Color(0xFF334155),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: valueSize,
                    fontWeight: FontWeight.w900,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: 5),
                Text(
                  unit!,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppColors.darkTextMuted
                        : const Color(0xFF64748B),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════ Map card ═══════════════════════════════

class _OpenMapButton extends StatelessWidget {
  final LanguageProvider lang;
  final VoidCallback onTap;

  const _OpenMapButton({required this.lang, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFF6B00),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: AppShadows.large,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.mapPin, size: 20, color: Colors.white),
              const SizedBox(width: 10),
              Text(
                lang.t('openLiveMap'),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapCard extends StatelessWidget {
  final LanguageProvider lang;
  final TrackingProvider tracking;
  final bool isDark;
  final VoidCallback onExpand;
  final VoidCallback onClose;

  const _MapCard({
    required this.lang,
    required this.tracking,
    required this.isDark,
    required this.onExpand,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Container(
        height: 450,
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0x332E90FA), width: 4),
          borderRadius: BorderRadius.circular(24),
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
        ),
        child: Column(
          children: [
            // Blue header
            Container(
              color: const Color(0xF22563EB),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(LucideIcons.mapPin, size: 16, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        text: '${lang.t('gpsTracking')}: ',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                        children: const [
                          TextSpan(
                            text: 'Live',
                            style: TextStyle(
                              color: Color(0xFFBFDBFE),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: onExpand,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(
                      LucideIcons.maximize2,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                  IconButton(
                    onPressed: onClose,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(
                      LucideIcons.x,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            // Map
            Expanded(
              child: Stack(
                children: [
                  LiveBusMap(tracking: tracking, interactive: true),
                  // Status pill + recenter
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.90),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: tracking.isLive
                                  ? const Color(0xFFBBF7D0)
                                  : const Color(0xFFFED7AA),
                            ),
                            boxShadow: AppShadows.large,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: tracking.isLive
                                      ? const Color(0xFF22C55E)
                                      : const Color(0xFFF97316),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                tracking.isLive ? 'LIVE' : 'OFFLINE',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: tracking.isLive
                                      ? const Color(0xFF15803D)
                                      : const Color(0xFFC2410C),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Material(
                          color: Colors.white.withValues(alpha: 0.90),
                          shape: const CircleBorder(),
                          elevation: 0,
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: tracking.recenterBus,
                            child: const Padding(
                              padding: EdgeInsets.all(8),
                              child: Icon(
                                LucideIcons.crosshair,
                                size: 18,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Auto-follow chip
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.90),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: AppShadows.large,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: Checkbox(
                              value: tracking.autoFollow,
                              onChanged: (v) =>
                                  tracking.setAutoFollow(v ?? true),
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                              activeColor: const Color(0xFF2563EB),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Auto-follow bus',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
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
        ),
      ),
    );
  }
}

/// Shared live map body  --  used by the inline card and the fullscreen modal.
class LiveBusMap extends StatefulWidget {
  final TrackingProvider tracking;
  final bool interactive;

  const LiveBusMap({
    super.key,
    required this.tracking,
    this.interactive = true,
  });

  @override
  State<LiveBusMap> createState() => _LiveBusMapState();
}

class _LiveBusMapState extends State<LiveBusMap> {
  CachedTileProvider? _tileProvider;
  final MapController _mapController = MapController();
  List<double>? _lastCameraLocation;
  int _lastRecenterRequest = 0;

  @override
  void initState() {
    super.initState();
    widget.tracking.addListener(_onTrackingChanged);
    _lastRecenterRequest = widget.tracking.recenterRequest;
    _initTileProvider();
  }

  @override
  void didUpdateWidget(covariant LiveBusMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tracking != widget.tracking) {
      oldWidget.tracking.removeListener(_onTrackingChanged);
      widget.tracking.addListener(_onTrackingChanged);
    }
  }

  void _onTrackingChanged() {
    if (!mounted) return;
    final location = List<double>.from(widget.tracking.busLocation);
    final recenter = widget.tracking.recenterRequest;
    final shouldMove =
        widget.tracking.autoFollow || recenter != _lastRecenterRequest;
    _lastRecenterRequest = recenter;
    if (shouldMove &&
        (_lastCameraLocation == null ||
            _lastCameraLocation![0] != location[0] ||
            _lastCameraLocation![1] != location[1] ||
            recenter != 0)) {
      _lastCameraLocation = List<double>.from(location);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mapController.move(LatLng(location[0], location[1]), 15);
      });
    }
    setState(() {});
  }

  @override
  void dispose() {
    widget.tracking.removeListener(_onTrackingChanged);
    super.dispose();
  }

  Future<void> _initTileProvider() async {
    try {
      final provider = await MapCacheService.getTileProvider();
      if (mounted) {
        setState(() => _tileProvider = provider);
      }
    } catch (e) {
      // Fallback to default tile layer on error
      if (mounted) {
        setState(() => _tileProvider = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tracking = widget.tracking;
    final interactive = widget.interactive;
    final LatLng busCenter = LatLng(
      tracking.busLocation[0],
      tracking.busLocation[1],
    );
    final polyline = tracking.routePolyline(StopCoords.all);
    final last = polyline.isNotEmpty ? polyline.last : null;

    // Show loading while tile provider initializes
    if (_tileProvider == null) {
      return FlutterMap(
        mapController: _mapController,
        options: MapOptions(
          initialCenter: busCenter,
          initialZoom: 15,
          interactionOptions: InteractionOptions(
            flags: interactive ? InteractiveFlag.all : InteractiveFlag.none,
          ),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.bussaarthi.bus_saarthi_app',
          ),
          if (polyline.length > 1)
            PolylineLayer(
              polylines: [
                Polyline(
                  points: polyline.map((c) => LatLng(c[0], c[1])).toList(),
                  strokeWidth: 6,
                  color: const Color(0xFF0056B3),
                ),
              ],
            ),
          MarkerLayer(
            markers: [
              if (last != null)
                Marker(
                  point: LatLng(last[0], last[1]),
                  width: 40,
                  height: 40,
                  child: const Icon(
                    LucideIcons.mapPin,
                    size: 30,
                    color: Color(0xFFDC2626),
                  ),
                ),
              Marker(
                point: busCenter,
                width: 44,
                height: 44,
                child: Image.asset(
                  'assets/icons/bus-icon-192.png',
                  errorBuilder: (_, __, ___) => const Icon(
                    LucideIcons.bus,
                    size: 30,
                    color: Color(0xFF1D4ED8),
                  ),
                ),
              ),
            ],
          ),
        ],
      );
    }

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: busCenter,
        initialZoom: 15,
        interactionOptions: InteractionOptions(
          flags: interactive ? InteractiveFlag.all : InteractiveFlag.none,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          tileProvider: _tileProvider!,
        ),
        if (polyline.length > 1)
          PolylineLayer(
            polylines: [
              Polyline(
                points: polyline.map((c) => LatLng(c[0], c[1])).toList(),
                strokeWidth: 6,
                color: const Color(0xFF0056B3),
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            if (last != null)
              Marker(
                point: LatLng(last[0], last[1]),
                width: 40,
                height: 40,
                child: const Icon(
                  LucideIcons.mapPin,
                  size: 30,
                  color: Color(0xFFDC2626),
                ),
              ),
            Marker(
              point: busCenter,
              width: 44,
              height: 44,
              child: Image.asset(
                'assets/icons/bus-icon-192.png',
                errorBuilder: (_, __, ___) => const Icon(
                  LucideIcons.bus,
                  size: 30,
                  color: Color(0xFF1D4ED8),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════════ Stops timeline ═══════════════════════════

class _StopsTimeline extends StatelessWidget {
  final LanguageProvider lang;
  final TrackingProvider tracking;
  final bool isDark;

  const _StopsTimeline({
    required this.lang,
    required this.tracking,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final stops = List<String>.from(
      tracking.routeInfo?.stopsList ?? const <String>[],
    );
    final destination = tracking.routeInfo?.destination;
    if (destination != null &&
        destination.trim().isNotEmpty &&
        (stops.isEmpty ||
            stops.last.toLowerCase() != destination.trim().toLowerCase())) {
      stops.add(destination.trim());
    }
    if (stops.isEmpty) {
      return _GlassCard(
        isDark: isDark,
        header: Text(
          lang.t('upcomingStops').toUpperCase(),
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: isDark ? Colors.white : const Color(0xFF0F172A),
          ),
        ),
        child: const Text('Route stop details are not available.'),
      );
    }

    final speed = tracking.telemetry?.speed ?? 20;
    final effSpeed = speed < 5 ? 20.0 : speed;

    final data = stops.map((stop) {
      final coords = StopCoords.all[stop] ?? const [28.35, 79.45];
      final distanceKm = TrackingProvider.distanceKm(
        tracking.busLocation,
        coords,
      );
      var etaMins = (distanceKm / effSpeed * 60).round();
      if (etaMins < 1) etaMins = 1;
      return (stop: stop, distanceKm: distanceKm, etaMins: etaMins);
    }).toList();

    int closestIdx = 0;
    double minDistance = data[0].distanceKm;
    for (var i = 1; i < data.length; i++) {
      if (data[i].distanceKm < minDistance) {
        minDistance = data[i].distanceKm;
        closestIdx = i;
      }
    }

    final lineColor = isDark
        ? const Color(0xFF334155)
        : const Color(0xFFE2E8F0);

    return _GlassCard(
      isDark: isDark,
      header: Text(
        lang.t('upcomingStops').toUpperCase(),
        style: TextStyle(
          fontSize: 14.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: isDark ? Colors.white : const Color(0xFF0F172A),
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Vertical line
          Positioned(
            left: 7,
            top: 8,
            bottom: 14,
            width: 2,
            child: Container(color: lineColor),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < data.length; i++) ...[
                _StopRow(
                  lang: lang,
                  isDark: isDark,
                  entry: data[i],
                  isActive: i == closestIdx,
                  isPassed: i < closestIdx,
                  isLast: i == data.length - 1,
                ),
                if (i != data.length - 1) const SizedBox(height: 18),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _StopRow extends StatelessWidget {
  final LanguageProvider lang;
  final bool isDark;
  final ({String stop, double distanceKm, int etaMins}) entry;
  final bool isActive;
  final bool isPassed;
  final bool isLast;

  const _StopRow({
    required this.lang,
    required this.isDark,
    required this.entry,
    required this.isActive,
    required this.isPassed,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    String etaText;
    if (isPassed) {
      etaText = 'Stop Passed';
    } else if (isActive) {
      etaText = entry.etaMins <= 2
          ? lang.t('arrivingSoon')
          : '${entry.etaMins} ${lang.t('minsAway')}';
    } else {
      etaText = '${entry.etaMins} ${lang.t('minsAway')}';
    }
    if (isLast && !isPassed) etaText += ' (${lang.t('destination')})';

    Widget dot;
    if (isPassed) {
      dot = Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? AppColors.darkCard : Colors.white,
          border: Border.all(color: const Color(0xFF22C55E), width: 3),
        ),
      );
    } else if (isActive) {
      dot = Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFFFF6B00),
          border: Border.all(color: const Color(0xFFFF6B00), width: 3),
          boxShadow: const [
            BoxShadow(color: Color(0x33FF6B00), blurRadius: 0, spreadRadius: 3),
          ],
        ),
      );
    } else {
      dot = Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? AppColors.darkCard : Colors.white,
          border: Border.all(
            color: isDark ? AppColors.darkTextMuted : const Color(0xFFCBD5E1),
            width: 3,
          ),
        ),
      );
    }

    return Opacity(
      opacity: isPassed ? 0.5 : 1.0,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 16, height: 16, child: Center(child: dot)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.stop,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: isActive
                        ? const Color(0xFF1D4ED8)
                        : (isDark
                              ? AppColors.darkForeground
                              : const Color(0xFF1E293B)),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  etaText,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive
                        ? const Color(0xFFFF6B00)
                        : (isDark
                              ? AppColors.darkTextMuted
                              : const Color(0xFF64748B)),
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

// ═══════════════════════ Modal scrim helper ═══════════════════════

class _ModalScrim extends StatelessWidget {
  final VoidCallback onDismiss;
  final Widget child;

  const _ModalScrim({required this.onDismiss, required this.child});

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: GestureDetector(
        onTap: onDismiss,
        child: Container(
          color: Colors.black.withValues(alpha: 0.60),
          alignment: Alignment.center,
          padding: const EdgeInsets.all(16),
          child: GestureDetector(
            onTap: () {}, // swallow taps inside the modal
            child: child,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════ Glass card shell ═══════════════════════════

class _GlassCard extends StatelessWidget {
  final bool isDark;
  final Widget header;
  final Widget child;

  const _GlassCard({
    required this.isDark,
    required this.header,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0x990F172A)
            : const Color(0x99FFFFFF), // white/60
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0x801E293B) : const Color(0x80F8FAFC),
              border: Border(
                bottom: BorderSide(
                  color: isDark
                      ? const Color(0xFF1E293B)
                      : const Color(0xFFF1F5F9),
                ),
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
            ),
            child: header,
          ),
          Padding(padding: const EdgeInsets.all(20), child: child),
        ],
      ),
    );
  }
}

// ═══════════════════════════ Broadcast popup ═══════════════════════════

class _BroadcastPopup extends StatelessWidget {
  final Map<String, dynamic> data;
  final LanguageProvider lang;
  final bool isDark;
  final VoidCallback onAcknowledge;

  const _BroadcastPopup({
    required this.data,
    required this.lang,
    required this.isDark,
    required this.onAcknowledge,
  });

  @override
  Widget build(BuildContext context) {
    final Color redBg = isDark
        ? const Color(0x4D450A0A)
        : const Color(0xFFFEF2F2);

    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.70),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 384),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF0F172A) : Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: AppShadows.large,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                color: redBg,
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(0x807F1D1D)
                            : const Color(0xFFFEE2E2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        LucideIcons.bell,
                        size: 38,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      (data['title'] ?? lang.t('importantNotice')).toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      (data['message'] ?? '').toString(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w500,
                        height: 1.5,
                        color: isDark
                            ? AppColors.darkForeground
                            : const Color(0xFF334155),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(18),
                color: isDark
                    ? const Color(0x800F172A)
                    : const Color(0xFFF8FAFC),
                child: Column(
                  children: [
                    Text(
                      '${lang.t('sentBy')}: ${data['sender'] ?? 'Admin'}',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? AppColors.darkTextMuted
                            : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Material(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: onAcknowledge,
                        child: Container(
                          width: double.infinity,
                          height: 48,
                          alignment: Alignment.center,
                          child: Text(
                            lang.t('acknowledgeClose'),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                            ),
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
