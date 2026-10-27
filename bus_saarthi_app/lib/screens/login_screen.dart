import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import 'home_screen.dart';
import 'parent_dashboard_screen.dart';

/// 1:1 port of the web Login page (`frontend/src/pages/Login.jsx`):
/// background video, glass top bar with language toggle, 4 role tiles
/// (Passenger / Parent / T.I. / Admin), the Passenger Student/Staff
/// sub-selection, and the 429 lockout countdown.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String _loginType =
      'passenger'; // passenger | parent | transport_incharge | admin
  String _passengerKind = 'student'; // student | staff
  bool _passengerMenuOpen = false;

  final TextEditingController _userId = TextEditingController();
  final TextEditingController _password = TextEditingController();
  bool _showPassword = false;
  bool _isLoading = false;
  String? _errorMessage;
  DateTime? _lockoutUntil;

  VideoPlayerController? _videoController;

  static const String _bgVideoAsset = 'assets/videos/login_background.mp4';

  @override
  void initState() {
    super.initState();
    _initVideo();
  }

  Future<void> _initVideo() async {
    try {
      final controller = VideoPlayerController.asset(_bgVideoAsset);
      _videoController = controller;
      await controller.initialize();
      if (!mounted) {
        controller.dispose();
        return;
      }
      controller
        ..setLooping(true)
        ..setVolume(0)
        ..play();
      setState(() {});
    } catch (_) {
      // No network / blocked host → the gradient fallback shows.
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _userId.dispose();
    _password.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  // ── Tick the lockout countdown every second (web setInterval port) ──
  Future<void> _startLockout(DateTime until) async {
    _lockoutUntil = until;
    while (mounted && _lockoutUntil != null) {
      final remaining = _lockoutUntil!.difference(DateTime.now());
      if (remaining.isNegative) {
        setState(() {
          _lockoutUntil = null;
          _errorMessage = null;
        });
        return;
      }
      final m = remaining.inMinutes;
      final s = remaining.inSeconds % 60;
      setState(
        () => _errorMessage =
            '${context.read<LanguageProvider>().t('loginAttemptsBlock')}$m:${s.toString().padLeft(2, '0')}',
      );
      await Future.delayed(const Duration(seconds: 1));
    }
  }

  Future<void> _handleLogin() async {
    if (_lockoutUntil != null || _isLoading) return;
    setState(() => _errorMessage = null);
    final id = _userId.text.trim();
    final pass = _password.text;
    if (id.isEmpty || pass.isEmpty) return;

    setState(() => _isLoading = true);
    final lang = context.read<LanguageProvider>();
    final auth = context.read<AuthProvider>();

    // The web app sends only login_id + password (role resolution happens
    // server-side), so the app does the same.
    final result = await auth.login(id, pass, null);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      final user = result.user!;
      if (user.role == 'admin' ||
          user.role == 'transport_incharge' ||
          user.role == 'teacher') {
        // App serves students and parents; staff roles live on the web.
        await auth.logout();
        if (!mounted) return;
        setState(() {
          _errorMessage = lang.lang == 'hi'
              ? 'यह ऐप केवल यात्रियों और अभिभावकों के लिए है। कृपया वेब पर लॉगिन करें।'
              : 'This app is for passengers and parents only. Please use the web dashboard.';
        });
        return;
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => user.role == 'parent'
              ? const ParentDashboardScreen()
              : const HomeScreen(),
        ),
      );
      return;
    }

    if (result.blockedUntil != null) {
      await _startLockout(result.blockedUntil!);
    } else {
      setState(
        () => _errorMessage = result.error ?? lang.t('invalidCredentials'),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final bool locked = _lockoutUntil != null;

    return Scaffold(
      backgroundColor: const Color(0xFF0A1A30),
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          // ── Background video (web: Invertis banner mp4, cover, 85%) ──
          if (_videoController?.value.isInitialized ?? false)
            Positioned.fill(
              child: Opacity(
                opacity: 0.85,
                child: FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _videoController!.value.size.width,
                    height: _videoController!.value.size.height,
                    child: VideoPlayer(_videoController!),
                  ),
                ),
              ),
            )
          else
            Positioned.fill(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                    radius: 1.4,
                    colors: [Color(0xFF0E3A6E), Color(0xFF04101F)],
                  ),
                ),
              ),
            ),
          // Gradient overlay
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.black.withValues(alpha: 0.15),
                    Colors.black.withValues(alpha: 0.30),
                  ],
                ),
              ),
            ),
          ),

          // ── Content ──
          SafeArea(
            child: Stack(
              children: [
                // Glass top bar
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _TopBar(lang: lang),
                ),

                // Login card — keyboard-aware, stable video layer
                Center(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final bottomInset = MediaQuery.of(
                        context,
                      ).viewInsets.bottom;
                      return SingleChildScrollView(
                        padding: EdgeInsets.only(
                          top: 100,
                          bottom: 24 + bottomInset,
                          left: MediaQuery.of(context).size.width * 0.04,
                          right: MediaQuery.of(context).size.width * 0.04,
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight:
                                constraints.maxHeight - 100 - 24 - bottomInset,
                          ),
                          child: IntrinsicHeight(
                            child: _LoginCard(
                              lang: lang,
                              loginType: _loginType,
                              passengerKind: _passengerKind,
                              passengerMenuOpen: _passengerMenuOpen,
                              onLoginTypeChanged: (t) {
                                setState(() {
                                  _loginType = t;
                                  _passengerMenuOpen = false;
                                  _userId.clear();
                                  _password.clear();
                                  _errorMessage = null;
                                });
                              },
                              onPassengerKindChanged: (k) {
                                setState(() {
                                  _passengerKind = k;
                                  _passengerMenuOpen = false;
                                  _userId.clear();
                                  _password.clear();
                                  _errorMessage = null;
                                });
                              },
                              onMenuToggle: () => setState(
                                () => _passengerMenuOpen = !_passengerMenuOpen,
                              ),
                              userIdController: _userId,
                              passwordController: _password,
                              showPassword: _showPassword,
                              onTogglePassword: () => setState(
                                () => _showPassword = !_showPassword,
                              ),
                              errorMessage: _errorMessage,
                              isLoading: _isLoading,
                              locked: locked,
                              onSubmit: _handleLogin,
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
        ],
      ),
    );
  }
}

// ═════════════════════════════════ Top bar ═════════════════════════════════

class _TopBar extends StatelessWidget {
  final LanguageProvider lang;
  const _TopBar({required this.lang});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xF2FFFFFF),
        border: Border(
          top: BorderSide(color: Color(0xFF333333), width: 6),
          bottom: BorderSide(color: AppColors.secondaryOrange, width: 4),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x26000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: [
          Image.asset(
            'assets/images/logo.png',
            height: 44,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text.rich(
              TextSpan(
                text: 'BUS ',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                  color: AppColors.primaryBlue,
                  letterSpacing: -0.3,
                ),
                children: const [
                  TextSpan(
                    text: 'SAARTHI',
                    style: TextStyle(color: AppColors.secondaryOrange),
                  ),
                ],
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const Spacer(),
          // Language toggle pill
          Material(
            color: AppColors.primaryBlue,
            borderRadius: BorderRadius.circular(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => lang.setLanguage(lang.lang == 'en' ? 'hi' : 'en'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      LucideIcons.languages,
                      size: 17,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      lang.lang == 'en' ? 'हिंदी' : 'English',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                      ),
                    ),
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

// ═════════════════════════════════ Card ═════════════════════════════════

class _LoginCard extends StatelessWidget {
  final LanguageProvider lang;
  final String loginType;
  final String passengerKind;
  final bool passengerMenuOpen;
  final ValueChanged<String> onLoginTypeChanged;
  final ValueChanged<String> onPassengerKindChanged;
  final VoidCallback onMenuToggle;
  final TextEditingController userIdController;
  final TextEditingController passwordController;
  final bool showPassword;
  final VoidCallback onTogglePassword;
  final String? errorMessage;
  final bool isLoading;
  final bool locked;
  final VoidCallback onSubmit;

  const _LoginCard({
    required this.lang,
    required this.loginType,
    required this.passengerKind,
    required this.passengerMenuOpen,
    required this.onLoginTypeChanged,
    required this.onPassengerKindChanged,
    required this.onMenuToggle,
    required this.userIdController,
    required this.passwordController,
    required this.showPassword,
    required this.onTogglePassword,
    required this.errorMessage,
    required this.isLoading,
    required this.locked,
    required this.onSubmit,
  });

  Color get _submitColor {
    switch (loginType) {
      case 'admin':
        return AppColors.secondaryOrange;
      case 'transport_incharge':
        return AppColors.tiGreen;
      case 'parent':
        return AppColors.parentPurple;
      default:
        return AppColors.primaryBlue;
    }
  }

  String get _idLabel {
    if (loginType == 'passenger') {
      return passengerKind == 'staff' ? 'Employee ID' : lang.t('passengerId');
    }
    if (loginType == 'parent') return 'Phone Number / Parent ID';
    if (loginType == 'transport_incharge') return lang.t('transportInchargeId');
    return lang.t('adminId');
  }

  String get _idHint {
    if (loginType == 'passenger') {
      return passengerKind == 'staff'
          ? 'e.g. T001'
          : lang.t('enterPassengerId');
    }
    if (loginType == 'parent') return 'Enter Phone Number or ID';
    if (loginType == 'transport_incharge')
      return lang.t('enterTransportInchargeId');
    return lang.t('enterAdminId');
  }

  @override
  Widget build(BuildContext context) {
    final double width = MediaQuery.of(context).size.width;
    final double cardWidth = width < 560 ? width * 0.96 : 540;

    return Container(
      width: cardWidth,
      padding: EdgeInsets.symmetric(
        horizontal: width < 480 ? 14 : 28,
        vertical: 24,
      ),
      decoration: BoxDecoration(
        color: const Color(0xDD172B45),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x4D000000),
            blurRadius: 32,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Logo chip + title ──
              Column(
                children: [
                  Container(
                    height: 60,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.30),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.40),
                      ),
                      boxShadow: AppShadows.large,
                    ),
                    child: Image.asset(
                      'assets/images/logo.png',
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                  Text(
                    lang.t('loginTitle'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lang.t('loginSubtitle'),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Role tiles ──
              _RoleTiles(
                lang: lang,
                loginType: loginType,
                passengerKind: passengerKind,
                onChanged: onLoginTypeChanged,
              ),

              // ── Student/Staff sub-selection (Passenger tile only) ──
              if (loginType == 'passenger') ...[
                const SizedBox(height: 12),
                _PassengerKindSelect(
                  lang: lang,
                  passengerKind: passengerKind,
                  menuOpen: passengerMenuOpen,
                  onToggle: onMenuToggle,
                  onPick: onPassengerKindChanged,
                ),
              ],
              const SizedBox(height: 18),

              // ── ID field ──
              _GlassLabel(_idLabel),
              const SizedBox(height: 6),
              _GlassField(
                controller: userIdController,
                hint: _idHint,
                icon: loginType == 'parent'
                    ? LucideIcons.phone
                    : (loginType == 'passenger' && passengerKind == 'staff')
                    ? LucideIcons.briefcase
                    : LucideIcons.user,
                obscure: false,
              ),
              const SizedBox(height: 14),

              // ── Password field ──
              _GlassLabel(lang.t('password')),
              const SizedBox(height: 6),
              _GlassField(
                controller: passwordController,
                hint: lang.t('enterPassword'),
                icon: LucideIcons.lock,
                obscure: !showPassword,
                trailing: IconButton(
                  onPressed: onTogglePassword,
                  icon: Icon(
                    showPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                    size: 18,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // ── Error box ──
              if (errorMessage != null && errorMessage!.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0x26CF1322),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0x4DFF6363)),
                  ),
                  child: Text(
                    errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.loginErrorRed,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // ── Submit ──
              Opacity(
                opacity: (locked || isLoading) ? 1 : 1,
                child: Material(
                  color: (locked || isLoading)
                      ? Colors.white.withValues(alpha: 0.20)
                      : _submitColor,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    onTap: (locked || isLoading) ? null : onSubmit,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (isLoading)
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation(
                                  Colors.white,
                                ),
                              ),
                            )
                          else ...[
                            Text(
                              locked
                                  ? lang.t('locked')
                                  : (isLoading
                                        ? lang.t('signingIn')
                                        : lang.t('signIn')),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (!locked && !isLoading) ...[
                              const SizedBox(width: 8),
                              const Icon(
                                LucideIcons.arrowRight,
                                size: 19,
                                color: Colors.white,
                              ),
                            ],
                          ],
                        ],
                      ),
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

class _GlassLabel extends StatelessWidget {
  final String text;
  const _GlassLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class _GlassField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final Widget? trailing;

  const _GlassField({
    required this.controller,
    required this.hint,
    required this.icon,
    required this.obscure,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white, fontSize: 15.5),
      cursorColor: Colors.white,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.05),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 13,
        ),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 14, right: 10),
          child: Icon(
            icon,
            size: 18,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: trailing,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.20)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.45)),
        ),
      ),
    );
  }
}

// ═══════════════════════════ Role tiles row ═══════════════════════════

class _RoleTiles extends StatelessWidget {
  final LanguageProvider lang;
  final String loginType;
  final String passengerKind;
  final ValueChanged<String> onChanged;

  const _RoleTiles({
    required this.lang,
    required this.loginType,
    required this.passengerKind,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final passengerLabel = loginType == 'passenger' && passengerKind == 'staff'
        ? (lang.lang == 'hi' ? 'स्टाफ़' : 'Staff')
        : (lang.lang == 'hi' ? 'यात्री' : 'Passenger');

    final tiles = [
      (id: 'passenger', label: passengerLabel, icon: LucideIcons.graduationCap),
      (
        id: 'parent',
        label: lang.lang == 'hi' ? 'पेरेंट' : 'Parent',
        icon: LucideIcons.users,
      ),
      (
        id: 'transport_incharge',
        label: lang.lang == 'hi' ? 'टी.आई.' : 'T.I.',
        icon: LucideIcons.bus,
      ),
      (
        id: 'admin',
        label: lang.lang == 'hi' ? 'एडमिन' : 'Admin',
        icon: LucideIcons.shield,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: tiles.map((tile) {
          final bool isActive = loginType == tile.id;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(tile.id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
                decoration: BoxDecoration(
                  color: isActive
                      ? Colors.white.withValues(alpha: 0.32)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isActive
                        ? Colors.white.withValues(alpha: 0.35)
                        : Colors.transparent,
                  ),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.18),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(tile.icon, size: 13, color: Colors.white),
                    const SizedBox(width: 3),
                    Flexible(
                      child: Text(
                        tile.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isActive
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.8),
                          fontWeight: isActive
                              ? FontWeight.w700
                              : FontWeight.w600,
                          fontSize: 12,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ═══════════════════ Student / Staff sub-selection ═══════════════════

class _PassengerKindSelect extends StatelessWidget {
  final LanguageProvider lang;
  final String passengerKind;
  final bool menuOpen;
  final VoidCallback onToggle;
  final ValueChanged<String> onPick;

  const _PassengerKindSelect({
    required this.lang,
    required this.passengerKind,
    required this.menuOpen,
    required this.onToggle,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final options = [
      (
        id: 'student',
        icon: LucideIcons.graduationCap,
        label: lang.lang == 'hi' ? 'विद्यार्थी' : 'Student',
        hint: lang.lang == 'hi'
            ? 'बस पास, उपस्थिति, शिकायतें'
            : 'Bus pass, attendance, complaints',
      ),
      (
        id: 'staff',
        icon: LucideIcons.briefcase,
        label: lang.lang == 'hi' ? 'स्टाफ़ / शिक्षक' : 'Staff / Teacher',
        hint: lang.lang == 'hi'
            ? 'faculty और drivers के लिए कर्मचारी आईडी'
            : 'Employee ID for faculty and drivers',
      ),
    ];

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Dropdown button
        Material(
          color: const Color(0x9E0C1E36), // rgba(12,30,54,0.62)
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onToggle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
              ),
              child: Row(
                children: [
                  Icon(
                    passengerKind == 'staff'
                        ? LucideIcons.briefcase
                        : LucideIcons.graduationCap,
                    size: 16,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      passengerKind == 'staff'
                          ? (lang.lang == 'hi'
                                ? 'स्टाफ़ / शिक्षक'
                                : 'Staff / Teacher')
                          : (lang.lang == 'hi' ? 'विद्यार्थी' : 'Student'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: menuOpen ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      LucideIcons.chevronDown,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Dropdown menu
        if (menuOpen)
          Positioned(
            top: 48,
            left: 0,
            right: 0,
            child: Material(
              color: const Color(0xD10C1E36), // rgba(12,30,54,0.82)
              borderRadius: BorderRadius.circular(12),
              elevation: 0,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.22),
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66000000),
                      blurRadius: 32,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  children: options.map((opt) {
                    final bool active = passengerKind == opt.id;
                    return InkWell(
                      onTap: () => onPick(opt.id),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          color: active
                              ? Colors.white.withValues(alpha: 0.18)
                              : Colors.transparent,
                          border: Border(
                            left: BorderSide(
                              width: 3,
                              color: active
                                  ? Colors.white.withValues(alpha: 0.85)
                                  : Colors.transparent,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              opt.icon,
                              size: 17,
                              color: active
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.75),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    opt.label,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 1),
                                  Text(
                                    opt.hint,
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.75,
                                      ),
                                      fontSize: 11.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (active)
                              const Icon(
                                LucideIcons.check,
                                size: 16,
                                color: Colors.white,
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
