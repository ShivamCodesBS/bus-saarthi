import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import 'home_screen.dart';
import 'parent_dashboard_screen.dart';

/// 1:1 port of the web Login page (`frontend/src/pages/Login.jsx`)
/// tailored for mobile: background video with frosted glassmorphism,
/// glass top bar with language toggle, and strictly Passenger (Student/Staff)
/// and Parent roles (Admin and Transport Incharge are web-only).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // Mobile app supports only passenger (Student/Staff) and parent.
  // Admin and Transport Incharge portals are web-only.
  String _loginType = 'passenger'; // 'passenger' | 'parent'
  String _passengerKind = 'student'; // 'student' | 'staff'
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

  // ── Tick lockout countdown every second (web setInterval port) ──
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

    final String expectedRole = _loginType == 'parent'
        ? 'parent'
        : (_passengerKind == 'staff' ? 'teacher' : 'passenger');

    final result = await auth.login(id, pass, expectedRole);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result.success) {
      final user = result.user!;
      if (user.role == 'admin' || user.role == 'transport_incharge') {
        // App is for students/staff and parents; admin & TI use the web portal.
        await auth.logout();
        if (!mounted) return;
        setState(() {
          _errorMessage = lang.lang == 'hi'
              ? 'यह ऐप केवल यात्रियों और अभिभावकों के लिए है। एडमिन और टी.आई. कृपया वेब पोर्टल का उपयोग करें।'
              : 'This app is for passengers and parents only. Admin and T.I. should use the web portal.';
        });
        return;
      }

      if (user.role != expectedRole) {
        await auth.logout();
        if (!mounted) return;
        setState(() {
          if (_loginType == 'parent') {
            _errorMessage = lang.lang == 'hi'
                ? 'यह अभिभावक खाता नहीं है। कृपया सही टैब चुनें।'
                : 'This is not a parent account. Please select the correct tab.';
          } else if (_passengerKind == 'staff') {
            _errorMessage = lang.lang == 'hi'
                ? 'यह विद्यार्थी खाता है। कृपया ड्रॉपडाउन से "विद्यार्थी" चुनें।'
                : 'This is a student account. Please select "Student" from the dropdown.';
          } else {
            _errorMessage = lang.lang == 'hi'
                ? 'यह स्टाफ़/शिक्षक खाता है। कृपया ड्रॉपडाउन से "स्टाफ़ / शिक्षक" चुनें।'
                : 'This is a staff/teacher account. Please select "Staff / Teacher" from the dropdown.';
          }
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
      String? err = result.error;
      if (err != null && err.contains('This account is registered as')) {
        if (lang.lang == 'hi') {
          if (_passengerKind == 'staff') {
            err = 'यह विद्यार्थी खाता है। कृपया ड्रॉपडाउन से "विद्यार्थी" चुनें।';
          } else {
            err = 'यह स्टाफ़/शिक्षक खाता है। कृपया ड्रॉपडाउन से "स्टाफ़ / शिक्षक" चुनें।';
          }
        }
      }
      setState(
        () => _errorMessage = err ?? lang.t('invalidCredentials'),
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
          // ── Background Video ──
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

          // ── Subtle Dark Gradient Overlay ──
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.black.withValues(alpha: 0.18),
                    Colors.black.withValues(alpha: 0.35),
                  ],
                ),
              ),
            ),
          ),

          // ── Main UI ──
          SafeArea(
            child: Stack(
              children: [
                // Top Header Bar
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _TopBar(lang: lang),
                ),

                // Glassmorphic Login Card
                Center(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final bottomInset = MediaQuery.of(context).viewInsets.bottom;
                      return SingleChildScrollView(
                        padding: EdgeInsets.only(
                          top: 85,
                          bottom: 20 + bottomInset,
                          left: 18,
                          right: 18,
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight - 85 - 20 - bottomInset,
                          ),
                          child: Center(
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
    final double screenWidth = MediaQuery.of(context).size.width;
    // On narrow screens, show the crest favicon + BUS SAARTHI or full logo cleanly
    final bool showFullBrand = screenWidth > 380;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.95),
            border: const Border(
              top: BorderSide(color: Color(0xFF333333), width: 5),
              bottom: BorderSide(color: AppColors.secondaryOrange, width: 3.5),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              // Logo
              Image.asset(
                'assets/images/logo.png',
                height: 38,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
              if (showFullBrand) ...[
                const SizedBox(width: 8),
                Text.rich(
                  TextSpan(
                    text: 'BUS ',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
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
                ),
              ],
              const Spacer(),
              // Language toggle button
              Material(
                color: AppColors.primaryBlue,
                borderRadius: BorderRadius.circular(20),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => lang.setLanguage(lang.lang == 'en' ? 'hi' : 'en'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          LucideIcons.languages,
                          size: 16,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          lang.lang == 'en' ? 'हिंदी' : 'English',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
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

  Color get _submitColor =>
      loginType == 'parent' ? AppColors.parentPurple : AppColors.primaryBlue;

  String get _idLabel {
    if (loginType == 'passenger') {
      return passengerKind == 'staff'
          ? (lang.lang == 'hi' ? 'कर्मचारी आईडी' : 'Employee ID')
          : lang.t('passengerId');
    }
    return lang.lang == 'hi' ? 'फ़ोन नंबर / पेरेंट आईडी' : 'Phone Number / Parent ID';
  }

  String get _idHint {
    if (loginType == 'passenger') {
      return passengerKind == 'staff'
          ? 'e.g. T001'
          : lang.t('enterPassengerId');
    }
    return lang.lang == 'hi' ? 'फ़ोन नंबर या आईडी दर्ज करें' : 'Enter Phone Number or ID';
  }

  @override
  Widget build(BuildContext context) {
    final double width = MediaQuery.of(context).size.width;
    final double cardWidth = width < 540 ? width - 36 : 480;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          width: cardWidth,
          padding: EdgeInsets.symmetric(
            horizontal: width < 400 ? 18 : 28,
            vertical: 24,
          ),
          decoration: BoxDecoration(
            color: const Color(0x2213233D), // Translucent frosted glass matching web
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 32,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Logo Pill + Heading ──
              Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                      child: Container(
                        height: 58,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.30),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Image.asset(
                          'assets/images/logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ),
                  Text(
                    lang.t('loginTitle'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lang.t('loginSubtitle'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),

              // ── Two Role Tabs (Passenger & Parent Only - TI and Admin Removed) ──
              _TwoRoleTabs(
                lang: lang,
                loginType: loginType,
                passengerKind: passengerKind,
                onChanged: onLoginTypeChanged,
              ),

              // ── Student / Staff Sub-Selection (Passenger Only) ──
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

              // ── ID / Phone Input Field ──
              _GlassLabel(_idLabel),
              const SizedBox(height: 6),
              _GlassField(
                controller: userIdController,
                hint: _idHint,
                icon: loginType == 'parent'
                    ? LucideIcons.phone
                    : (passengerKind == 'staff' ? LucideIcons.briefcase : LucideIcons.user),
                obscure: false,
              ),
              const SizedBox(height: 14),

              // ── Password Input Field ──
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

              // ── Error Message Banner ──
              if (errorMessage != null && errorMessage!.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    color: const Color(0x33CF1322),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0x66FF6363)),
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

              // ── Submit Button ──
              Material(
                color: (locked || isLoading)
                    ? Colors.white.withValues(alpha: 0.20)
                    : _submitColor,
                borderRadius: BorderRadius.circular(12),
                elevation: (locked || isLoading) ? 0 : 4,
                shadowColor: _submitColor.withValues(alpha: 0.4),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: (locked || isLoading) ? null : onSubmit,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (isLoading)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        else ...[
                          Text(
                            locked
                                ? lang.t('locked')
                                : (isLoading ? lang.t('signingIn') : lang.t('signIn')),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (!locked && !isLoading) ...[
                            const SizedBox(width: 8),
                            const Icon(
                              LucideIcons.arrowRight,
                              size: 18,
                              color: Colors.white,
                            ),
                          ],
                        ],
                      ],
                    ),
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

class _GlassLabel extends StatelessWidget {
  final String text;
  const _GlassLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 13.5,
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
      style: const TextStyle(color: Colors.white, fontSize: 15),
      cursorColor: Colors.white,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.50)),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.08),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 14, right: 10),
          child: Icon(
            icon,
            size: 18,
            color: Colors.white.withValues(alpha: 0.75),
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: trailing,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.22)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.55), width: 1.5),
        ),
      ),
    );
  }
}

// ═══════════════════════ Two Role Tabs (Passenger & Parent) ═══════════════════════

class _TwoRoleTabs extends StatelessWidget {
  final LanguageProvider lang;
  final String loginType;
  final String passengerKind;
  final ValueChanged<String> onChanged;

  const _TwoRoleTabs({
    required this.lang,
    required this.loginType,
    required this.passengerKind,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final bool isPassenger = loginType == 'passenger';

    final String passengerLabel = isPassenger && passengerKind == 'staff'
        ? (lang.lang == 'hi' ? 'स्टाफ़' : 'Staff')
        : (lang.lang == 'hi' ? 'यात्री' : 'Passenger');

    final IconData passengerIcon =
        isPassenger && passengerKind == 'staff' ? LucideIcons.briefcase : LucideIcons.graduationCap;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          // ── Passenger Tab (50%) ──
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged('passenger'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isPassenger
                      ? Colors.white.withValues(alpha: 0.32)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isPassenger
                        ? Colors.white.withValues(alpha: 0.40)
                        : Colors.transparent,
                  ),
                  boxShadow: isPassenger
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
                    Icon(passengerIcon, size: 16, color: Colors.white),
                    const SizedBox(width: 7),
                    Text(
                      passengerLabel,
                      style: TextStyle(
                        color: isPassenger
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.8),
                        fontWeight: isPassenger ? FontWeight.w700 : FontWeight.w600,
                        fontSize: 14,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),

          // ── Parent Tab (50%) ──
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged('parent'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: !isPassenger
                      ? Colors.white.withValues(alpha: 0.32)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: !isPassenger
                        ? Colors.white.withValues(alpha: 0.40)
                        : Colors.transparent,
                  ),
                  boxShadow: !isPassenger
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
                    const Icon(LucideIcons.users, size: 16, color: Colors.white),
                    const SizedBox(width: 7),
                    Text(
                      lang.lang == 'hi' ? 'पेरेंट' : 'Parent',
                      style: TextStyle(
                        color: !isPassenger
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.8),
                        fontWeight: !isPassenger ? FontWeight.w700 : FontWeight.w600,
                        fontSize: 14,
                        letterSpacing: -0.2,
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
            : 'Employee ID for faculty and staff',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Dropdown Toggle Button
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

        // Dropdown Menu
        if (menuOpen) ...[
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xD10C1E36), // rgba(12,30,54,0.82)
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66000000),
                      blurRadius: 24,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: options.map((opt) {
                    final bool active = passengerKind == opt.id;
                    return InkWell(
                      onTap: () => onPick(opt.id),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
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
                              size: 16,
                              color: active
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.75),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    opt.label,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13.5,
                                    ),
                                  ),
                                  const SizedBox(height: 1),
                                  Text(
                                    opt.hint,
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.70),
                                      fontSize: 11,
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
      ],
    );
  }
}
