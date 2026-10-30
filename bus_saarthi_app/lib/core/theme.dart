import 'package:flutter/material.dart';

/// Design tokens ported 1:1 from the web app's `frontend/src/index.css`.
///
/// Every colour below maps to a CSS variable so the Flutter app renders
/// exactly like the web experience, in both light and dark mode.
class AppColors {
  AppColors._();

  // ── Brand (identical in both themes, from :root) ──────────────────────
  static const Color primaryBlue = Color(0xFF0056B3);
  static const Color primaryBlueHover = Color(0xFF004494);
  static const Color secondaryOrange = Color(0xFFFF6600);
  static const Color secondaryOrangeHover = Color(0xFFE65C00);

  // Login role button colours (Login.jsx inline styles)
  static const Color parentPurple = Color(0xFF9B59B6);
  static const Color tiGreen = Color(0xFF28A745);

  // ── Light theme (from :root) ──────────────────────────────────────────
  static const Color lightBg = Color(0xFFF4F7FB);
  static const Color lightText = Color(0xFF333333);
  static const Color lightTextMuted = Color(0xFF666666);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE0E0E0);
  static const Color lightShadow = Color(0x1A101828); // 0 4px 6px rgba(0,0,0,.1)

  // shadcn tokens, light (HSL → hex)
  static const Color lightScaffold = Color(0xFFF8FAFC); // 210 40% 98%
  static const Color lightForeground = Color(0xFF0F172A); // 222 47% 11%
  static const Color lightMutedFg = Color(0xFF64748B); // 215 16% 47%
  static const Color lightSecondary = Color(0xFFF1F5F9); // 210 40% 96%
  static const Color lightDestructive = Color(0xFFCF1322); // 0 84% 60% → matches web #CF1322
  static const Color lightShadBorder = Color(0xFFE2E8F0); // 214 32% 91%

  // ── Dark theme (from body.dark-mode) ──────────────────────────────────
  static const Color darkBg = Color(0xFF0F1117);
  static const Color darkText = Color(0xFFE8EAF0);
  static const Color darkTextMuted = Color(0xFF9BA3B8);
  static const Color darkCard = Color(0xFF1A1D2E);
  static const Color darkSurface = Color(0xFF13151F); // secondary surfaces / inputs
  static const Color darkBorder = Color(0xFF2A2D3E);

  // shadcn tokens, dark
  static const Color darkScaffold = Color(0xFF0F1117); // matches web --bg-color
  static const Color darkForeground = Color(0xFFE8EAF0); // matches web --text-dark
  static const Color darkMutedFg = Color(0xFF9BA3B8); // matches web --text-light
  static const Color darkSecondary = Color(0xFF13151F); // secondary surfaces
  static const Color darkDestructive = Color(0xFFCF1322); // matches web --danger
  static const Color darkPrimaryBlue = Color(0xFF1A8BFF); // lighter blue for dark

  // ── Semantic status colours (used across Home/Community) ──────────────
  static const Color success = Color(0xFF28A745); // matches web --success
  static const Color sosRed = Color(0xFFCF1322); // pulse-red / emergency
  static const Color loginErrorRed = Color(0xFFFF6B6B);
  static const Color amber = Color(0xFFF59E0B);

  /// Glassmorphism: white card at 85% like the web `bg-white/85 backdrop-blur`.
  static Color glassLight(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light
          ? const Color(0xD9FFFFFF) // white 85%
          : const Color(0xD9111827); // slate-900 85%
}

/// Border radius — web uses `--radius: 0.75rem` (12px) and 20px login card.
class AppRadius {
  AppRadius._();
  static const double sm = 8; // .btn
  static const double md = 12; // --radius, inputs, cards
  static const double lg = 16; // rounded-2xl
  static const double xl = 20; // login card, modal sheets
}

/// Shadows ported from the CSS `--shadow` / `--shadow-lg` variables.
class AppShadows {
  AppShadows._();
  static List<BoxShadow> soft = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.10),
      blurRadius: 6,
      offset: const Offset(0, 4),
      spreadRadius: -1,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 4,
      offset: const Offset(0, 2),
      spreadRadius: -1,
    ),
  ];

  static List<BoxShadow> large = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.10),
      blurRadius: 15,
      offset: const Offset(0, 10),
      spreadRadius: -3,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.05),
      blurRadius: 6,
      offset: const Offset(0, 4),
      spreadRadius: -2,
    ),
  ];

  /// `btn-primary` glow: 0 4px 14px rgba(0, 86, 179, 0.39)
  static List<BoxShadow> primaryGlow = [
    BoxShadow(
      color: const Color(0xFF0056B3).withValues(alpha: 0.39),
      blurRadius: 14,
      offset: const Offset(0, 4),
    ),
  ];

  /// `btn-secondary` glow: 0 4px 14px rgba(255, 102, 0, 0.39)
  static List<BoxShadow> orangeGlow = [
    BoxShadow(
      color: const Color(0xFFFF6600).withValues(alpha: 0.39),
      blurRadius: 14,
      offset: const Offset(0, 4),
    ),
  ];

  static const String fontFamily = 'Geist';
}

class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(
        brightness: Brightness.light,
        scaffold: AppColors.lightScaffold,
        card: AppColors.lightCard,
        foreground: AppColors.lightForeground,
        mutedFg: AppColors.lightMutedFg,
        secondary: AppColors.lightSecondary,
        border: AppColors.lightShadBorder,
        primary: AppColors.primaryBlue,
        destructive: AppColors.lightDestructive,
      );

  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        scaffold: AppColors.darkScaffold,
        card: AppColors.darkCard,
        foreground: AppColors.darkForeground,
        mutedFg: AppColors.darkMutedFg,
        secondary: AppColors.darkSecondary,
        border: AppColors.darkBorder,
        primary: AppColors.darkPrimaryBlue,
        destructive: AppColors.darkDestructive,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color scaffold,
    required Color card,
    required Color foreground,
    required Color mutedFg,
    required Color secondary,
    required Color border,
    required Color primary,
    required Color destructive,
  }) {
    final bool isDark = brightness == Brightness.dark;
    final ColorScheme scheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: Colors.white,
      secondary: secondary,
      onSecondary: foreground,
      error: destructive,
      onError: Colors.white,
      surface: card,
      onSurface: foreground,
      surfaceContainerHighest: secondary,
      outline: border,
      outlineVariant: border,
    );

    return ThemeData(
      useMaterial3: true,
      fontFamily: AppShadows.fontFamily,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      canvasColor: scaffold,
      splashFactory: InkSplash.splashFactory,
      textTheme: TextTheme(
        displaySmall: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: foreground, letterSpacing: -0.5),
        headlineMedium: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: foreground, letterSpacing: -0.4),
        titleLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: foreground, letterSpacing: -0.3),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: foreground),
        titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: foreground),
        bodyLarge: TextStyle(fontSize: 16, color: foreground),
        bodyMedium: TextStyle(fontSize: 14, color: foreground),
        bodySmall: TextStyle(fontSize: 12, color: mutedFg),
        labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: foreground),
        labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: mutedFg),
        labelSmall: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500, color: mutedFg),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: border),
        ),
        margin: EdgeInsets.zero,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.darkBg : Colors.white,
        foregroundColor: foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: AppShadows.fontFamily,
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: foreground,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        hintStyle: TextStyle(color: mutedFg),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
      ),
      dividerTheme: DividerThemeData(color: border, thickness: 1),
      switchTheme: SwitchThemeData(
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? primary : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
        ),
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Colors.white : (isDark ? AppColors.darkTextMuted : Colors.white),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? AppColors.darkCard : AppColors.lightText,
        contentTextStyle: TextStyle(fontFamily: AppShadows.fontFamily, color: Colors.white, fontSize: 14),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: card,
        modalBackgroundColor: card,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
        showDragHandle: false,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
        titleTextStyle: TextStyle(fontFamily: AppShadows.fontFamily, fontSize: 17, fontWeight: FontWeight.w700, color: foreground),
        contentTextStyle: TextStyle(fontFamily: AppShadows.fontFamily, fontSize: 14, color: foreground),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: secondary,
        selectedColor: primary.withValues(alpha: 0.15),
        labelStyle: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: foreground),
        side: BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primary, linearTrackColor: secondary),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? AppColors.darkBg : Colors.white,
        indicatorColor: primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: foreground)),
      ),
    );
  }
}
