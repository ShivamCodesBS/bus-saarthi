import 'package:flutter/material.dart';

import 'screens/splash_screen.dart';

/// First screen after boot. The Splash screen itself performs the session
/// check and routes to Home / ParentDashboard / Login, mirroring the web's
/// Splash → ProtectedRoute flow.
class AppRoot extends StatelessWidget {
  const AppRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return const SplashScreen();
  }
}
