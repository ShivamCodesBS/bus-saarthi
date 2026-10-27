import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'parent_dashboard_screen.dart';

/// Port of the web Splash page: radial blue gradient, official emblem,
/// "Smart Transport System" caption and the orange progress bar.
/// After the animation the session decides the next screen (the web does
/// this through ProtectedRoute; here the AuthProvider tells us directly).
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress =
      AnimationController(vsync: this, duration: const Duration(seconds: 2))
        ..repeat();

  @override
  void initState() {
    super.initState();
    _goNext();
  }

  Future<void> _goNext() async {
    await Future.delayed(const Duration(milliseconds: 2500));
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    await auth.init();
    if (!mounted) return;

    final user = auth.user;
    Widget next;
    if (user == null) {
      next = const LoginScreen();
    } else if (user.role == 'parent') {
      next = const ParentDashboardScreen();
    } else {
      next = const HomeScreen();
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => next),
    );
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.center,
            radius: 1.1,
            colors: [Color(0xFF004B99), Color(0xFF002244)],
          ),
        ),
        child: Stack(
          children: [
            // Background ambient lighting (web's blurred orange/blue circles)
            Positioned(
              top: -40,
              left: -40,
              child: _ambientCircle(384, const Color(0x1AFF6600)),
            ),
            Positioned(
              bottom: -60,
              right: -40,
              child: _ambientCircle(320, const Color(0x1A60A5FA)),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Full official emblem logo
                  Container(
                    width: 224,
                    height: 224,
                    padding: const EdgeInsets.all(8),
                    child: Image.asset(
                      'assets/images/logo.png',
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) =>
                          Image.asset('assets/images/favicon.png'),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'SMART TRANSPORT SYSTEM',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'INVERTIS UNIVERSITY · BAREILLY',
                    style: TextStyle(
                      color: Color(0xFFFB923C),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Smooth loading bar
                  SizedBox(
                    width: 192,
                    height: 6,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: Stack(
                        children: [
                          Container(color: Colors.white24),
                          AnimatedBuilder(
                            animation: _progress,
                            builder: (context, _) => FractionallySizedBox(
                              alignment: Alignment.centerLeft,
                              widthFactor:
                                  0.35 + 0.65 * _progress.value.abs() * 0.65,
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFF97316), Color(0xFFFBBF24)],
                                  ),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              ),
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

  Widget _ambientCircle(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          backgroundBlendMode: BlendMode.plus,
        ),
      );
}
