import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Decorative floating icons and subtle background dot grid matching the web
/// interface (`frontend/src/App.jsx`).
///
/// Features:
/// - Lightweight hardware-accelerated floating animation (smooth 60/120 fps).
/// - Small, refined icon sizes (16-24px) that look elegant and non-distracting.
/// - Calibrated transparency so content on cards remains 100% readable.
/// - Completely non-interactive (`IgnorePointer`) so gestures pass through.
class FloatingIconsBackground extends StatefulWidget {
  final bool isDark;
  final Color? iconColor;
  final bool showDots;
  final bool showLogoWatermark;

  const FloatingIconsBackground({
    super.key,
    required this.isDark,
    this.iconColor,
    this.showDots = true,
    this.showLogoWatermark = true,
  });

  @override
  State<FloatingIconsBackground> createState() => _FloatingIconsBackgroundState();
}

class _FloatingIconsBackgroundState extends State<FloatingIconsBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  // 24 balanced items across phone viewport (adapted from web App.jsx)
  static final List<_FloatingIconDef> _items = [
    _FloatingIconDef(LucideIcons.bus, 0.08, 0.12, 22, 0.0, 1.0),
    _FloatingIconDef(LucideIcons.graduationCap, 0.16, 0.82, 24, 0.8, 0.9),
    _FloatingIconDef(LucideIcons.mapPin, 0.68, 0.08, 20, 1.4, 1.1),
    _FloatingIconDef(LucideIcons.bookOpen, 0.62, 0.86, 21, 2.1, 0.95),
    _FloatingIconDef(LucideIcons.navigation, 0.42, 0.18, 19, 2.7, 1.05),
    _FloatingIconDef(LucideIcons.school, 0.36, 0.84, 24, 3.4, 0.85),
    _FloatingIconDef(LucideIcons.compass, 0.82, 0.48, 22, 4.1, 1.0),
    _FloatingIconDef(LucideIcons.bus, 0.32, 0.06, 18, 4.8, 0.9),
    _FloatingIconDef(LucideIcons.mapPin, 0.14, 0.46, 20, 5.5, 1.15),
    _FloatingIconDef(LucideIcons.graduationCap, 0.78, 0.28, 22, 0.4, 0.92),
    _FloatingIconDef(LucideIcons.bookOpen, 0.06, 0.72, 19, 1.2, 1.02),
    _FloatingIconDef(LucideIcons.school, 0.52, 0.92, 22, 1.9, 0.88),
    _FloatingIconDef(LucideIcons.navigation, 0.88, 0.74, 17, 2.6, 1.1),
    _FloatingIconDef(LucideIcons.compass, 0.24, 0.62, 23, 3.3, 0.94),
    _FloatingIconDef(LucideIcons.bus, 0.72, 0.64, 24, 4.0, 1.04),
    _FloatingIconDef(LucideIcons.graduationCap, 0.04, 0.32, 18, 4.7, 0.96),
    _FloatingIconDef(LucideIcons.bookOpen, 0.48, 0.10, 20, 5.3, 1.08),
    _FloatingIconDef(LucideIcons.navigation, 0.11, 0.56, 21, 0.2, 0.91),
    _FloatingIconDef(LucideIcons.bus, 0.58, 0.38, 20, 1.0, 1.12),
    _FloatingIconDef(LucideIcons.school, 0.86, 0.16, 20, 1.7, 0.87),
    _FloatingIconDef(LucideIcons.mapPin, 0.28, 0.88, 23, 2.4, 1.03),
    _FloatingIconDef(LucideIcons.compass, 0.94, 0.88, 19, 3.1, 0.97),
    _FloatingIconDef(LucideIcons.bookOpen, 0.76, 0.04, 22, 3.8, 1.06),
    _FloatingIconDef(LucideIcons.bus, 0.02, 0.62, 21, 4.5, 0.93),
  ];

  @override
  void initState() {
    super.initState();
    // Faster, livelier floating speed (reduced from 18s to 9s)
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 9),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.iconColor ?? const Color(0xFFFF6B00);
    // Increased visibility for background icons and watermark
    final iconOpacity = widget.isDark ? 0.26 : 0.18;
    final dotOpacity = widget.isDark ? 0.10 : 0.065;
    final logoOpacity = widget.isDark ? 0.18 : 0.14;

    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Subtle dot grid matching web bg-dot-pattern
          if (widget.showDots)
            CustomPaint(
              painter: _DotGridPainter(
                color: baseColor.withValues(alpha: dotOpacity),
                spacing: 26.0,
                radius: 1.3,
              ),
            ),

          // Background logo watermark with increased visibility
          if (widget.showLogoWatermark)
            Center(
              child: Opacity(
                opacity: logoOpacity,
                child: Image.asset(
                  'assets/images/logo.png',
                  width: 250,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Image.asset(
                    'assets/images/favicon.png',
                    width: 140,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),

          // Smooth floating icons with enhanced speed & travel
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final progress = _controller.value * 2 * math.pi;

              return LayoutBuilder(
                builder: (context, constraints) {
                  final w = constraints.maxWidth;
                  final h = constraints.maxHeight;

                  return Stack(
                    children: _items.map((item) {
                      final phase = progress * item.speed + item.phase;
                      final dx = math.sin(phase) * 18.0;
                      final dy = math.cos(phase) * 22.0;
                      final rot = math.sin(phase) * 0.22; // ~12 degree tilt

                      final x = (w * item.leftRatio) + dx - (item.size / 2);
                      final y = (h * item.topRatio) + dy - (item.size / 2);

                      return Positioned(
                        left: x,
                        top: y,
                        child: Transform.rotate(
                          angle: rot,
                          child: Icon(
                            item.icon,
                            size: item.size,
                            color: baseColor.withValues(alpha: iconOpacity),
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}

class _FloatingIconDef {
  final IconData icon;
  final double topRatio;
  final double leftRatio;
  final double size;
  final double phase;
  final double speed;

  const _FloatingIconDef(
    this.icon,
    this.topRatio,
    this.leftRatio,
    this.size,
    this.phase,
    this.speed,
  );
}

class _DotGridPainter extends CustomPainter {
  final Color color;
  final double spacing;
  final double radius;

  _DotGridPainter({
    required this.color,
    required this.spacing,
    required this.radius,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    for (double y = spacing / 2; y < size.height; y += spacing) {
      for (double x = spacing / 2; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotGridPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.spacing != spacing ||
        oldDelegate.radius != radius;
  }
}
