import 'package:flutter/material.dart';

class AppTheme {
  // ── Brand Colors (MATCH WEB) ──────────────────────────────
  static const Color orange        = Color(0xFFFF6600); // Primary CTA orange - matches web #FF6600
  static const Color orangeLight   = Color(0xFFE65C00); // Hover / secondary orange - matches web #E65C00
  static const Color orangeSoft    = Color(0xFFFFF0E6); // Orange tint background
  static const Color black         = Color(0xFF333333); // Strong black text - matches web
  static const Color blackSoft     = Color(0xFF666666); // Secondary text - matches web
  static const Color white         = Color(0xFFFFFFFF); // Pure white for cards/surfaces
  static const Color background    = Color(0xFFF4F7FB); // Grayish background - matches web #F4F7FB
  static const Color surface       = Color(0xFFFFFFFF); // White cards on gray bg
  static const Color surfaceBorder = Color(0xFFE0E0E0); // Subtle border - matches web
  static const Color success       = Color(0xFF28A745); // Matches web #28A745
  static const Color warning       = Color(0xFFF59E0B); // Amber
  static const Color danger        = Color(0xFFCF1322); // Matches web #CF1322
  static const Color info          = Color(0xFF6366F1); // Indigo - for heading
  static const Color infoLight     = Color(0xFF06B6D4); // Cyan - for distance

  // ── Dark Theme (MATCH WEB) ────────────────────────────────
  static const Color darkBg        = Color(0xFF0F1117); // Matches web dark bg
  static const Color darkText      = Color(0xFFE8EAF0); // Matches web dark text
  static const Color darkTextMuted = Color(0xFF9BA3B8); // Matches web dark text muted
  static const Color darkCard      = Color(0xFF1A1D2E); // Matches web dark card
  static const Color darkSurface   = Color(0xFF13151F); // Secondary surfaces
  static const Color darkBorder    = Color(0xFF2A2D3E); // Matches web dark border

  // ── Legacy dark-theme aliases (kept for sensors widget compatibility) ──
  static const Color primaryColor     = Color(0xFF0F1117);
  static const Color accentColor      = orange;
  static const Color backgroundColor  = background;
  static const Color cardColor        = surface;
  static const Color successColor     = success;
  static const Color warningColor     = warning;
  static const Color dangerColor      = danger;

  // ... rest of the file

  // ── Light Theme (White + Black + Orange) ──────────────────
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      useMaterial3: false,
      primaryColor: orange,
      scaffoldBackgroundColor: background,
      cardColor: surface,
      fontFamily: 'Geist',
      colorScheme: const ColorScheme.light(
        primary: orange,
        secondary: orangeLight,
        error: danger,
        background: background,
        surface: surface,
        onPrimary: white,
        onBackground: black,
        onSurface: black,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: true,
        foregroundColor: black,
        iconTheme: IconThemeData(color: black),
        titleTextStyle: TextStyle(
          color: black,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: orange,
          foregroundColor: white,
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        labelStyle: const TextStyle(color: blackSoft, fontSize: 14),
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: surfaceBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: surfaceBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: orange, width: 2),
        ),
        prefixIconColor: orange,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      dividerColor: surfaceBorder,
      iconTheme: const IconThemeData(color: black),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: black, fontWeight: FontWeight.w900),
        displayMedium: TextStyle(color: black, fontWeight: FontWeight.w800),
        headlineLarge: TextStyle(color: black, fontWeight: FontWeight.w800),
        headlineMedium: TextStyle(color: black, fontWeight: FontWeight.w700),
        titleLarge: TextStyle(color: black, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: black, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: black),
        bodyMedium: TextStyle(color: blackSoft),
        labelLarge: TextStyle(color: white, fontWeight: FontWeight.w700),
      ),
    );
  }

  // ── Dark Theme (MATCH WEB) ────────────────────────────────
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: orange,
      scaffoldBackgroundColor: AppTheme.darkBg,
      cardColor: AppTheme.darkCard,
      colorScheme: const ColorScheme.dark(
        primary: orange,
        secondary: success,
        error: danger,
        background: AppTheme.darkBg,
        surface: AppTheme.darkCard,
        onBackground: AppTheme.darkText,
        onSurface: AppTheme.darkText,
      ),
      fontFamily: 'Geist',
      appBarTheme: AppBarTheme(
        backgroundColor: AppTheme.darkBg,
        elevation: 0,
        centerTitle: true,
        foregroundColor: AppTheme.darkText,
        iconTheme: IconThemeData(color: AppTheme.darkText),
        titleTextStyle: TextStyle(
          color: AppTheme.darkText,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: orange,
          foregroundColor: white,
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppTheme.darkCard,
        labelStyle: TextStyle(color: AppTheme.darkTextMuted, fontSize: 14),
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: orange, width: 2),
        ),
        prefixIconColor: orange,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      dividerColor: AppTheme.darkBorder,
      iconTheme: IconThemeData(color: AppTheme.darkText),
      textTheme: TextTheme(
        displayLarge: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w900),
        displayMedium: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w800),
        headlineLarge: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w800),
        headlineMedium: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w700),
        titleLarge: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: AppTheme.darkText, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: AppTheme.darkText),
        bodyMedium: TextStyle(color: AppTheme.darkTextMuted),
        labelLarge: TextStyle(color: white, fontWeight: FontWeight.w700),
      ),
    );
  }
}
