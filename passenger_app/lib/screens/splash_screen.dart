import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../core/colors.dart';

/// Exact replica of Splash.jsx:
/// - Blue gradient background (linear-gradient 135deg, --primary-blue to #003366)
/// - 120px circle with white bg + orange border containing logo/bus icon
/// - "INVERTIS" text in white, "BUS SAARTHI" in orange
/// - "Smart Transport System" subtitle
/// - Navigates to /login after 2.5 seconds
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _animController.forward();

    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.isAuthenticated) {
        final role = auth.user!.role;
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
        Navigator.pushReplacementNamed(context, '/login');
      }
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primaryBlue,
              Color(0xFF003366),
            ],
          ),
        ),
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo circle — 120px, white bg, orange border
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    border: Border.all(color: AppColors.secondaryOrange, width: 4),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1F2687).withValues(alpha: 0.37),
                        blurRadius: 32,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: Image.network(
                      'https://ui-avatars.com/api/?name=Bus+Saarthi&background=0056b3&color=fff&size=120',
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.directions_bus_rounded,
                        size: 60,
                        color: AppColors.primaryBlue,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // "INVERTIS" in white
                Text(
                  'INVERTIS',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                  textAlign: TextAlign.center,
                ),

                // "BUS SAARTHI" in orange
                Text(
                  'BUS SAARTHI',
                  style: GoogleFonts.inter(
                    color: AppColors.secondaryOrange,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 8),

                // Subtitle
                Text(
                  'Smart Transport System',
                  style: GoogleFonts.inter(
                    color: const Color(0xFFE0E0E0),
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
