import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'screens/splash_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/sensor_provider.dart';
import 'providers/attendance_provider.dart';
import 'providers/connection_provider.dart';
import 'services/socket_service.dart';

class BusSensorApp extends StatelessWidget {
  const BusSensorApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Single shared instance of the socket service
    final socketService = SocketService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ConnectionProvider(socketService)),
        ChangeNotifierProvider(create: (_) => SensorProvider(socketService)),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
      ],
      child: MaterialApp(
        title: 'Invertis Bus Sensor',
        theme: AppTheme.lightTheme,
        debugShowCheckedModeBanner: false,
        initialRoute: '/',
        routes: {
          '/': (context) => const SplashScreen(),
          '/admin_dashboard': (context) => const AdminDashboardScreen(),
        },
      ),
    );
  }
}
