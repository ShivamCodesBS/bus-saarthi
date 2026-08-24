import 'package:flutter/material.dart';

class AppTheme {
  // ── Brand Colors ──────────────────────────────────────────
  static const Color orange        = Color(0xFFFF6B00); // Primary CTA orange
  static const Color orangeLight   = Color(0xFFFF8C42); // Hover / secondary orange
  static const Color orangeSoft    = Color(0xFFFFF0E6); // Orange tint background
  static const Color black         = Color(0xFF111827); // Strong black text
  static const Color blackSoft     = Color(0xFF4B5563); // Secondary text
  static const Color white         = Color(0xFFFFFFFF); // Pure white for cards/surfaces
  static const Color background    = Color(0xFFF3F4F6); // Grayish background
  static const Color surface       = Color(0xFFFFFFFF); // White cards on gray bg
  static const Color surfaceBorder = Color(0xFFE5E7EB); // Subtle border
  static const Color successColor  = Color(0xFF22C55E);
  static const Color warningColor  = Color(0xFFFBBF24);
  static const Color dangerColor   = Color(0xFFEF4444);

  // ── Legacy dark-theme aliases (kept for sensors widget compatibility) ──
  static const Color primaryColor     = Color(0xFF0F172A);
  static const Color accentColor      = orange;
  static const Color backgroundColor  = white;
  static const Color cardColor        = surface;

  // ── Light Theme (White + Black + Orange) ──────────────────
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      useMaterial3: false,
      primaryColor: orange,
      scaffoldBackgroundColor: background,
      cardColor: surface,
      fontFamily: 'Roboto',
      colorScheme: const ColorScheme.light(
        primary: orange,
        secondary: orangeLight,
        error: dangerColor,
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

  // ── Dark Theme (kept for backward compat) ────────────────
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: const Color(0xFF020617),
      cardColor: const Color(0xFF1E293B),
      colorScheme: const ColorScheme.dark(
        primary: orange,
        secondary: successColor,
        error: dangerColor,
        background: Color(0xFF020617),
        surface: Color(0xFF1E293B),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryColor,
        elevation: 0,
        centerTitle: true,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: orange,
          foregroundColor: white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }
}
