import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_client.dart';
import '../services/fcm_service.dart';
import '../services/notification_preferences.dart';
import '../widgets/user_avatar.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Port of the web Settings page: profile summary, Account (change
/// password, face reset), Notifications (push + SOS toggles), Appearance
/// (dark mode + language), About, and the change-password modal.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool pushNotifications = true;
  bool sosAlerts = true;
  bool faceResetRequested = false;
  bool showPasswordModal = false;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final user = context.read<AuthProvider>().user;
    final prefs = await SharedPreferences.getInstance();
    final permissionGranted = await FcmService.isPermissionGranted();
    if (!mounted) return;
    final faceResetRequested = user == null
        ? false
        : prefs.getBool('face_reset_requested_${user.loginId}') ?? false;
    if (!mounted) return;
    setState(() {
      pushNotifications =
          prefs.getString('pref_push') != 'false' && permissionGranted;
      sosAlerts = prefs.getString('pref_sos') != 'false';
      this.faceResetRequested = faceResetRequested;
    });
  }

  Future<void> _togglePush(bool next) async {
    if (next) {
      final userToken = context.read<AuthProvider>().user?.token;
      final granted = await FcmService.requestPermission();
      if (!granted) {
        if (!mounted) return;
        setState(() => pushNotifications = false);
        ApiClient.toast(
          context,
          'Notification permission denied. Allow it in app settings.',
          kind: ToastKind.error,
        );
        return;
      }
      if (userToken != null) await FcmService.enable(userToken);
      await NotificationPreferences.setPushNotificationsEnabled(true);
      if (!mounted) return;
      setState(() => pushNotifications = true);
      ApiClient.toast(
        context,
        'Push notifications enabled!',
        kind: ToastKind.success,
      );
    } else {
      await FcmService.disable();
      await NotificationPreferences.setPushNotificationsEnabled(false);
      if (!mounted) return;
      setState(() => pushNotifications = false);
      ApiClient.toast(context, 'Push notifications disabled.');
    }
  }

  Future<void> _toggleSos(bool next) async {
    setState(() => sosAlerts = next);
    await NotificationPreferences.setSosAlertsEnabled(next);
    if (!mounted) return;
    ApiClient.toast(
      context,
      next ? 'SOS alerts enabled!' : 'SOS alerts disabled.',
    );
  }

  Future<void> _toggleDark(bool next) async {
    await context.read<ThemeProvider>().setDarkMode(next);
    if (!mounted) return;
    ApiClient.toast(context, next ? 'Dark mode on! 🌙' : 'Light mode on! ☀️');
  }

  Future<void> _faceReset() async {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;
    try {
      final response = await ApiClient.dio.post(
        '/api/users/me/face-reset',
        data: {},
        options: Options(headers: ApiClient.authHeaders(user)),
      );
      if (!mounted) return;
      final data = response.data;
      if (data is! Map || data['status'] != 'success') {
        throw StateError('Face reset request was not accepted');
      }
      setState(() => faceResetRequested = true);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('face_reset_requested_${user.loginId}', true);
      if (!mounted) return;
      ApiClient.toast(
        context,
        'Request sent! Admin will review and approve your face reset.',
        kind: ToastKind.success,
      );
    } catch (_) {
      if (!mounted) return;
      ApiClient.toast(
        context,
        'Failed to send request. Please try again.',
        kind: ToastKind.error,
      );
    }
  }

  Future<void> _selectLanguage(String langName) async {
    final lang = context.read<LanguageProvider>();
    final code = langName == 'Hindi (हिंदी)' ? 'hi' : 'en';
    await lang.setLanguage(code);
    if (!mounted) return;
    ApiClient.toast(
      context,
      code == 'hi' ? 'भाषा हिंदी में बदल गई!' : 'Language set to $langName',
      kind: ToastKind.success,
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final auth = context.watch<AuthProvider>();
    final theme = context.watch<ThemeProvider>();
    final user = auth.user;
    if (user == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;

    Widget sectionLabel(String label) => Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.7,
          color: textLight,
        ),
      ),
    );

    Widget section(List<Widget> rows) => Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: rows),
    );

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
                      onPressed: () {
                        if (Navigator.of(context).canPop()) {
                          Navigator.of(context).pop();
                        } else {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => const HomeScreen(),
                            ),
                          );
                        }
                      },
                      icon: const Icon(
                        LucideIcons.arrowLeft,
                        size: 24,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      lang.t('settings'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Profile summary
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: borderColor),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      UserAvatar(
                        src: user.profilePic,
                        name: user.name,
                        size: 52,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              lang.translateName(user.name) ?? user.name,
                              style: TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w700,
                                color: textDark,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${lang.t(user.role)} · ${lang.t('route')} ${user.routeId ?? 'N/A'}',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: textLight,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),

                // Account
                sectionLabel(lang.t('account')),
                section([
                  _SettingRow(
                    isDark: isDark,
                    icon: const Icon(
                      LucideIcons.lock,
                      size: 20,
                      color: AppColors.primaryBlue,
                    ),
                    label: lang.t('changePassword'),
                    sublabel: lang.t('updateLoginPassword'),
                    right: Icon(
                      LucideIcons.chevronRight,
                      size: 18,
                      color: textLight,
                    ),
                    onTap: () => setState(() => showPasswordModal = true),
                  ),
                  _SettingRow(
                    isDark: isDark,
                    icon: Icon(
                      LucideIcons.camera,
                      size: 20,
                      color: faceResetRequested
                          ? const Color(0xFF28A745)
                          : AppColors.primaryBlue,
                    ),
                    label: faceResetRequested
                        ? lang.t('faceRescanRequested')
                        : lang.t('requestFaceDataReset'),
                    sublabel: faceResetRequested
                        ? lang.t('adminWillContact')
                        : lang.t('ifFaceRecognitionFailing'),
                    right: faceResetRequested
                        ? const Icon(
                            LucideIcons.checkCircle2,
                            size: 20,
                            color: Color(0xFF28A745),
                          )
                        : Icon(
                            LucideIcons.chevronRight,
                            size: 18,
                            color: textLight,
                          ),
                    onTap: faceResetRequested ? null : _faceReset,
                  ),
                ]),
                const SizedBox(height: 22),

                // Notifications
                sectionLabel(lang.t('notificationsSection')),
                section([
                  _SettingRow(
                    isDark: isDark,
                    icon: const Icon(
                      LucideIcons.bell,
                      size: 20,
                      color: AppColors.primaryBlue,
                    ),
                    label: lang.t('pushNotifications'),
                    sublabel: lang.t('busArrivalAlerts'),
                    right: Switch(
                      value: pushNotifications,
                      onChanged: _togglePush,
                    ),
                  ),
                  // Show FCM init failure warning
                  if (auth.fcmInitFailed)
                    _SettingRow(
                      isDark: isDark,
                      icon: const Icon(
                        LucideIcons.alertTriangle,
                        size: 20,
                        color: Color(0xFFF97316),
                      ),
                      label: 'Push Setup Incomplete',
                      sublabel:
                          auth.fcmError ??
                          'google-services.json missing or invalid',
                      right: TextButton(
                        onPressed: () => auth.retryFcmInit(),
                        child: Text(
                          'Retry',
                          style: TextStyle(color: AppColors.primaryBlue),
                        ),
                      ),
                    ),
                  _SettingRow(
                    isDark: isDark,
                    icon: const Icon(
                      LucideIcons.shield,
                      size: 20,
                      color: Color(0xFFCF1322),
                    ),
                    label: lang.t('sosAlertsLabel'),
                    sublabel: lang.t('receiveSOSNotifs'),
                    right: Switch(
                      value: sosAlerts,
                      activeTrackColor: const Color(0xFFCF1322),
                      onChanged: _toggleSos,
                    ),
                  ),
                ]),
                const SizedBox(height: 22),

                // Appearance
                sectionLabel(lang.t('appearance')),
                section([
                  _SettingRow(
                    isDark: isDark,
                    icon: Icon(
                      theme.darkMode ? LucideIcons.moon : LucideIcons.sun,
                      size: 20,
                      color: theme.darkMode
                          ? AppColors.primaryBlue
                          : AppColors.secondaryOrange,
                    ),
                    label: lang.t('darkMode'),
                    sublabel: theme.darkMode
                        ? lang.t('usingDarkTheme')
                        : lang.t('usingLightTheme'),
                    right: Switch(
                      value: theme.darkMode,
                      onChanged: _toggleDark,
                    ),
                  ),
                  _SettingRow(
                    isDark: isDark,
                    icon: const Icon(
                      LucideIcons.globe,
                      size: 20,
                      color: AppColors.primaryBlue,
                    ),
                    label: lang.t('language'),
                    sublabel: lang.t('appDisplayLanguage'),
                    right: Row(
                      children: [
                        Text(
                          lang.lang == 'hi' ? 'हिंदी' : 'English',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: textLight,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          LucideIcons.chevronRight,
                          size: 18,
                          color: textLight,
                        ),
                      ],
                    ),
                    onTap: () => _openLanguageModal(context),
                  ),
                ]),
                const SizedBox(height: 22),

                // About
                sectionLabel(lang.t('about')),
                section([
                  _SettingRow(
                    isDark: isDark,
                    icon: const Icon(
                      LucideIcons.info,
                      size: 20,
                      color: AppColors.primaryBlue,
                    ),
                    label: lang.t('appVersion'),
                    sublabel: 'Invertis Bus Saarthi',
                    right: Text(
                      AppConstants.appVersion,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: textLight,
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 22),

                // Logout
                SizedBox(
                  width: double.infinity,
                  child: Material(
                    color: const Color(0x1ACF1322),
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () async {
                        await auth.logout();
                        if (!context.mounted) return;
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(
                            builder: (_) => const LoginScreen(),
                          ),
                          (route) => false,
                        );
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              LucideIcons.logOut,
                              size: 20,
                              color: Color(0xFFCF1322),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              lang.t('logout'),
                              style: const TextStyle(
                                color: Color(0xFFCF1322),
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
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

      // Change password modal
      bottomSheet: showPasswordModal
          ? _ChangePasswordSheet(
              onClose: () => setState(() => showPasswordModal = false),
            )
          : null,
    );
  }

  void _openLanguageModal(BuildContext context) {
    final lang = context.read<LanguageProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;

    showModalBottomSheet(
      context: context,
      backgroundColor: cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(18),
              child: Text(
                lang.t('selectLanguage'),
                style: TextStyle(
                  fontSize: 16.5,
                  fontWeight: FontWeight.w700,
                  color: textDark,
                ),
              ),
            ),
            for (final name in LanguageProvider.languageOptions)
              ListTile(
                title: Text(name, style: TextStyle(color: textDark)),
                trailing:
                    (lang.lang == 'hi' ? 'Hindi (हिंदी)' : 'English') == name
                    ? const Icon(Icons.check, color: AppColors.primaryBlue)
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  _selectLanguage(name);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ Setting row ═══════════════════════

class _SettingRow extends StatelessWidget {
  final bool isDark;
  final Widget icon;
  final String label;
  final String sublabel;
  final Widget right;
  final VoidCallback? onTap;

  const _SettingRow({
    required this.isDark,
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.right,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: borderColor)),
          ),
          child: Row(
            children: [
              icon,
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: textDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sublabel,
                      style: TextStyle(fontSize: 12, color: textLight),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              right,
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════ Change password sheet ═══════════════════

class _ChangePasswordSheet extends StatefulWidget {
  final VoidCallback onClose;

  const _ChangePasswordSheet({required this.onClose});

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _old = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _showOld = false;
  bool _showNew = false;
  bool _loading = false;

  @override
  void dispose() {
    _old.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final lang = context.read<LanguageProvider>();
    if (_new.text != _confirm.text) {
      ApiClient.toast(
        context,
        lang.t('passwordMismatch'),
        kind: ToastKind.error,
      );
      return;
    }
    if (_new.text.length < 6) {
      ApiClient.toast(
        context,
        lang.t('passwordTooShort'),
        kind: ToastKind.error,
      );
      return;
    }
    setState(() => _loading = true);
    final user = context.read<AuthProvider>().user;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      await ApiClient.dio.put(
        '/api/users/${user.loginId}/password',
        data: {
          // The backend reads `current_password` (the web learned this the
          // hard way — sending `old_password` never worked).
          'current_password': _old.text,
          'new_password': _new.text,
        },
        options: Options(headers: ApiClient.authHeaders(user)),
      );
      if (!mounted) return;
      ApiClient.toast(
        context,
        lang.t('passwordChanged'),
        kind: ToastKind.success,
      );
      widget.onClose();
    } catch (e) {
      if (!mounted) return;
      ApiClient.toast(
        context,
        ApiClient.friendlyError(
          e,
          'We could not change the password. Please check your current password.',
        ),
        kind: ToastKind.error,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final textLight = isDark
        ? AppColors.darkTextMuted
        : AppColors.lightTextMuted;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    lang.t('changePassword'),
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: textDark,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: widget.onClose,
                  icon: Icon(Icons.close, size: 20, color: textLight),
                ),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _old,
              obscureText: !_showOld,
              style: TextStyle(color: textDark),
              decoration: InputDecoration(
                labelText: lang.t('oldPassword'),
                labelStyle: TextStyle(color: textLight, fontSize: 13),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _new,
              obscureText: !_showNew,
              style: TextStyle(color: textDark),
              decoration: InputDecoration(
                labelText: lang.t('newPassword'),
                labelStyle: TextStyle(color: textLight, fontSize: 13),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _showNew = !_showNew),
                  icon: Icon(
                    _showNew ? LucideIcons.eyeOff : LucideIcons.eye,
                    size: 18,
                    color: textLight,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirm,
              obscureText: true,
              style: TextStyle(color: textDark),
              decoration: InputDecoration(
                labelText: lang.t('confirmNewPassword'),
                labelStyle: TextStyle(color: textLight, fontSize: 13),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: Material(
                color: AppColors.primaryBlue,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: _loading ? null : _submit,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    child: Center(
                      child: _loading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation(
                                  Colors.white,
                                ),
                              ),
                            )
                          : Text(
                              _loading
                                  ? lang.t('changingPassword')
                                  : lang.t('save'),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
