import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:video_player/video_player.dart';
import '../providers/auth_provider.dart';
import '../providers/lang_provider.dart';
import '../widgets/floating_background.dart';
import '../core/colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  String _loginType = 'passenger';
  final _idController = TextEditingController();
  final _passController = TextEditingController();
  bool _showPassword = false;
  bool _isLoading = false;
  String _errorMessage = '';
  bool _isLocked = false;

  late AnimationController _slideController;
  late Animation<Offset> _slideAnim;
  late VideoPlayerController _videoController;

  @override
  void initState() {
    super.initState();
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));
    _slideController.forward();

    _videoController = VideoPlayerController.networkUrl(
      Uri.parse('https://www.invertisuniversity.ac.in/uploads/banner/20251029150922.mp4'),
    )..initialize().then((_) {
        _videoController.setVolume(0.0);
        _videoController.setLooping(true);
        _videoController.play();
        setState(() {});
      });
  }

  @override
  void dispose() {
    _idController.dispose();
    _passController.dispose();
    _slideController.dispose();
    _videoController.dispose();
    super.dispose();
  }

  Color get _roleColor {
    switch (_loginType) {
      case 'admin': return AppColors.secondaryOrange;
      case 'transport_incharge': return AppColors.tiGreen;
      case 'parent': return AppColors.parentPurple;
      default: return AppColors.primaryBlue;
    }
  }

  IconData get _roleIcon {
    switch (_loginType) {
      case 'admin': return LucideIcons.shield;
      case 'transport_incharge': return LucideIcons.car;
      case 'parent': return LucideIcons.heart;
      default: return LucideIcons.bus;
    }
  }

  String _getIdLabel(LangProvider lang) {
    switch (_loginType) {
      case 'passenger': return lang.t('passengerId');
      case 'admin': return lang.t('adminId');
      case 'transport_incharge': return lang.t('transportInchargeId');
      case 'parent': return 'Phone Number / Parent ID';
      default: return 'ID';
    }
  }

  String _getIdHint(LangProvider lang) {
    switch (_loginType) {
      case 'passenger': return lang.t('enterPassengerId');
      case 'admin': return lang.t('enterAdminId');
      case 'transport_incharge': return lang.t('enterTransportInchargeId');
      case 'parent': return 'Enter Phone Number or ID';
      default: return 'Enter ID';
    }
  }

  Future<void> _handleLogin() async {
    if (_isLocked || _isLoading) return;
    final loginId = _idController.text.trim();
    final password = _passController.text;
    if (loginId.isEmpty || password.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final result = await auth.login(loginId, password);

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (result['success'] == true) {
      final role = result['role'] as String;
      if (role == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin-dashboard');
      } else if (role == 'transport_incharge') {
        Navigator.pushReplacementNamed(context, '/ti-dashboard');
      } else if (role == 'parent') {
        Navigator.pushReplacementNamed(context, '/parent-dashboard');
      } else {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } else {
      if (result['locked'] == true) {
        setState(() {
          _isLocked = true;
          _errorMessage = result['message'] ?? '';
        });
      } else {
        setState(() {
          _errorMessage = result['message'] ?? 'Invalid Credentials or Server Down';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = Provider.of<LangProvider>(context);

    return Scaffold(
      body: Stack(
        children: [
          // --- Background: Video ---
          Positioned.fill(
            child: Opacity(
              opacity: 0.85,
              child: _videoController.value.isInitialized
                  ? FittedBox(
                      fit: BoxFit.cover,
                      child: SizedBox(
                        width: _videoController.value.size.width,
                        height: _videoController.value.size.height,
                        child: VideoPlayer(_videoController),
                      ),
                    )
                  : Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF0056B3), Color(0xFF003366)],
                        ),
                      ),
                    ),
            ),
          ),

          // --- Dark overlay ---
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0x26000000), // rgba(0,0,0,0.15)
                    Color(0x4D000000), // rgba(0,0,0,0.30)
                  ],
                ),
              ),
            ),
          ),

          // --- Full layout wrapped in FloatingBackground ---
          Positioned.fill(
            child: FloatingBackground(
              iconColor: Colors.white,
              iconOpacity: 0.3,
              showSolidBackground: false,
              child: Column(
              children: [
              // ---- TOP HEADER BAR (university logo + lang toggle) ----
              ClipRRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    padding: const EdgeInsets.only(left: 24, right: 24, top: 12, bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      border: const Border(
                        top: BorderSide(color: Color(0xFF333333), width: 6),
                        bottom: BorderSide(color: AppColors.secondaryOrange, width: 4),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // University Logo
                          Image.network(
                            'https://invertis-feedback-system-2.onrender.com/main%20logo.png',
                            height: 48,
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => Row(
                              children: [
                                const Icon(Icons.directions_bus, color: AppColors.primaryBlue, size: 28),
                                const SizedBox(width: 8),
                                Text(
                                  'Invertis University',
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primaryBlue,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Language toggle button (EN/HI)
                          ElevatedButton.icon(
                            onPressed: lang.toggleLanguage,
                            icon: const Icon(LucideIcons.languages, size: 18, color: Colors.white),
                            label: Text(
                              lang.lang == 'en' ? 'हिंदी' : 'English',
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: Colors.white,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryBlue,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              elevation: 2,
                              shadowColor: AppColors.primaryBlue.withValues(alpha: 0.4),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // ---- SCROLLABLE CONTENT (login card) ----
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(top: 80, left: 16, right: 16, bottom: 32),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: SlideTransition(
                      position: _slideAnim,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.topCenter,
                        children: [
                          Container(
                            margin: const EdgeInsets.only(top: 28),
                            constraints: const BoxConstraints(maxWidth: 540),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  blurRadius: 32,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(20),
                              child: BackdropFilter(
                                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                                child: Container(
                                  padding: const EdgeInsets.only(left: 32, right: 32, bottom: 24, top: 44),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.12),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      // --- Title ---
                                      Text(
                                    lang.t('loginTitle'),
                                    style: GoogleFonts.inter(
                                      fontSize: 24,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                      height: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    lang.t('loginSubtitle'),
                                    style: GoogleFonts.inter(
                                      fontSize: 14.4, // 0.9rem
                                      color: Colors.white.withValues(alpha: 0.7),
                                    ),
                                  ),
                                  const SizedBox(height: 20),

                                  // --- 4-Tab Role Switcher ---
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Row(
                                      children: [
                                        _buildRoleTab('passenger', LucideIcons.graduationCap, 'Passenger', lang),
                                        _buildRoleTab('parent', LucideIcons.users, 'Parent', lang),
                                        _buildRoleTab('transport_incharge', LucideIcons.bus, 'T.I.', lang),
                                        _buildRoleTab('admin', LucideIcons.shield, 'Admin', lang),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 24),

                                  // --- Login ID Field ---
                                  _buildTransparentField(
                                    icon: _loginType == 'parent' ? LucideIcons.phone : LucideIcons.user,
                                    label: _getIdLabel(lang),
                                    hint: _getIdHint(lang),
                                    controller: _idController,
                                    obscure: false,
                                  ),
                                  const SizedBox(height: 16),

                                  // --- Password Field ---
                                  _buildPasswordField(lang),

                                  // --- Error Message ---
                                  if (_errorMessage.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    AnimatedOpacity(
                                      opacity: _errorMessage.isNotEmpty ? 1.0 : 0.0,
                                      duration: const Duration(milliseconds: 300),
                                      child: Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0x26CF1322),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0x4DFF6363)),
                                        ),
                                        child: Text(
                                          _errorMessage,
                                          style: GoogleFonts.inter(
                                            color: const Color(0xFFFF6B6B),
                                            fontSize: 14,
                                            fontWeight: FontWeight.w500,
                                          ),
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 24),

                                  // --- Sign In Button ---
                                  SizedBox(
                                    width: double.infinity,
                                    height: 54,
                                    child: ElevatedButton(
                                      onPressed: (_isLocked || _isLoading) ? null : _handleLogin,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: (_isLocked || _isLoading)
                                            ? Colors.white.withValues(alpha: 0.2)
                                            : _roleColor,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        elevation: 0,
                                      ),
                                      child: _isLoading
                                          ? const SizedBox(
                                              height: 22,
                                              width: 22,
                                              child: CircularProgressIndicator(
                                                  color: Colors.white, strokeWidth: 2.5),
                                            )
                                          : Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Text(
                                                  _isLocked
                                                      ? lang.t('locked')
                                                      : lang.t('signIn'),
                                                  style: GoogleFonts.inter(
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.w600,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                                if (!_isLocked) ...[
                                                  const SizedBox(width: 10),
                                                  const Icon(LucideIcons.arrowRight,
                                                      size: 20, color: Colors.white),
                                                ],
                                              ],
                                            ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                          
                          // --- Floating Role Icon ---
                          Positioned(
                            top: 0,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: _roleColor,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: _roleColor.withValues(alpha: 0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Icon(_roleIcon, size: 28, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          )),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleTab(String type, IconData icon, String label, LangProvider lang) {
    final isActive = _loginType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _loginType = type;
            _idController.clear();
            _passController.clear();
            _errorMessage = '';
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          margin: const EdgeInsets.symmetric(horizontal: 1),
          decoration: BoxDecoration(
            color: isActive ? Colors.white.withValues(alpha: 0.3) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: isActive
                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 12, offset: const Offset(0, 4))]
                : [],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.85)),
              const SizedBox(height: 6),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w600,
                  color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.85),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTransparentField({
    required IconData icon,
    required String label,
    required String hint,
    required TextEditingController controller,
    required bool obscure,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscure,
          style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 15),
            prefixIcon: Icon(icon, color: Colors.white.withValues(alpha: 0.7), size: 20),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.05),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.5), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField(LangProvider lang) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          lang.t('password'),
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _passController,
          obscureText: !_showPassword,
          style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
          onSubmitted: (_) => _handleLogin(),
          decoration: InputDecoration(
            hintText: lang.t('enterPassword'),
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 15),
            prefixIcon: Icon(LucideIcons.lock,
                color: Colors.white.withValues(alpha: 0.7), size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                _showPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                color: Colors.white.withValues(alpha: 0.7),
                size: 20,
              ),
              onPressed: () => setState(() => _showPassword = !_showPassword),
            ),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.05),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.5), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
