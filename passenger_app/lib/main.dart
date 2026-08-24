import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/lang_provider.dart';
import 'services/socket_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/passenger_home_screen.dart';
import 'screens/parent_dashboard_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'screens/ti_dashboard_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/community_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(prefs)),
        ChangeNotifierProvider(create: (_) => LangProvider(prefs)),
        ChangeNotifierProvider(create: (_) => SocketService()),
      ],
      child: const BusSaarthiApp(),
    ),
  );
}

class BusSaarthiApp extends StatelessWidget {
  const BusSaarthiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Invertis Bus Saarthi',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/admin-dashboard': (context) => const AdminDashboardScreen(),
        '/ti-dashboard': (context) => const TiDashboardScreen(),
        '/parent-dashboard': (context) => const ParentDashboardScreen(),
        '/home': (context) => const PassengerHomeScreen(),
        '/profile': (context) => const ProfileScreen(),
        '/community': (context) => const CommunityScreen(),
      },
    );
  }
}
