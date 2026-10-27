import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/language_provider.dart';
import 'providers/theme_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations(const [DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );
  runApp(const BusSaarthiApp());
}

class BusSaarthiApp extends StatelessWidget {
  const BusSaarthiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LanguageProvider()..init()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()..init()),
      ],
      child: Consumer2<ThemeProvider, LanguageProvider>(
        builder: (context, themeProvider, langProvider, _) {
          // Keep native status-bar icons in step with the theme, like the
          // web's `body.dark-mode` transition.
          final brightness = themeProvider.darkMode
              ? Brightness.dark
              : Brightness.light;
          SystemChrome.setSystemUIOverlayStyle(
            SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: brightness == Brightness.dark
                  ? Brightness.light
                  : Brightness.dark,
            ),
          );

          return MaterialApp(
            title: 'Bus Saarthi',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: themeProvider.darkMode
                ? ThemeMode.dark
                : ThemeMode.light,
            locale: Locale(langProvider.lang == 'hi' ? 'hi' : 'en'),
            supportedLocales: const [Locale('en'), Locale('hi')],
            home: const AppRoot(),
          );
        },
      ),
    );
  }
}
