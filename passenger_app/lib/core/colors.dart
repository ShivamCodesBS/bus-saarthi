import 'package:flutter/material.dart';

class AppColors {
  // Primary Colors (from CSS :root)
  static const Color primaryBlue = Color(0xFF0056B3);
  static const Color primaryBlueHover = Color(0xFF004494);
  static const Color secondaryOrange = Color(0xFFFF6600);
  static const Color secondaryOrangeHover = Color(0xFFE65C00);

  // Role Colors
  static const Color parentPurple = Color(0xFF8B5CF6);
  static const Color parentPurpleDark = Color(0xFF7C3AED);
  static const Color tiGreen = Color(0xFF28A745);
  static const Color adminOrange = Color(0xFFFF6600);

  // Light Theme
  static const Color bgLight = Color(0xFFF4F7FB);
  static const Color textDark = Color(0xFF333333);
  static const Color textLight = Color(0xFF666666);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE0E0E0);
  static const Color glassBg = Color(0xE6FFFFFF); // rgba(255,255,255,0.9)

  // Dark Theme
  static const Color bgDark = Color(0xFF0F1117);
  static const Color textDarkMode = Color(0xFFE8EAF0);
  static const Color textLightMode = Color(0xFF9BA3B8);
  static const Color cardDark = Color(0xFF1A1D2E);
  static const Color borderDark = Color(0xFF2A2D3E);
  static const Color glassBgDark = Color(0xF21A1D2E); // rgba(26,29,46,0.95)

  // Status Colors
  static const Color success = Color(0xFF28A745);
  static const Color successBg = Color(0xFFE6FAE6);
  static const Color error = Color(0xFFCF1322);
  static const Color errorBg = Color(0xFFFFF1F0);
  static const Color warning = Color(0xFFD46B08);
  static const Color warningBg = Color(0xFFFFFBE6);

  // Shadows
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.07),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> get cardShadowLg => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.1),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
  ];
}
