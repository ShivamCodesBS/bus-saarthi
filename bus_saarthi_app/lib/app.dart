import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/parent_dashboard_screen.dart';

/// App root entry: immediately resolves the session without any splash screen delay
/// and directs to the appropriate screen (Home, ParentDashboard, or Login).
class AppRoot extends StatelessWidget {
  const AppRoot({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Brief instant blank while reading SharedPreferences on launch (<15ms)
    if (!auth.initialized) {
      return const Scaffold(
        backgroundColor: Color(0xFF0A1A30),
      );
    }

    final user = auth.user;
    if (user == null) {
      return const LoginScreen();
    } else if (user.role == 'parent') {
      return const ParentDashboardScreen();
    } else {
      return const HomeScreen();
    }
  }
}
