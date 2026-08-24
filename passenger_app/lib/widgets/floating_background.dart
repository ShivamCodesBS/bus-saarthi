import 'dart:math';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class FloatingBackground extends StatefulWidget {
  final Widget child;
  final Color iconColor;
  final bool showSolidBackground;
  final double iconOpacity;
  
  const FloatingBackground({
    super.key,
    required this.child,
    required this.iconColor,
    this.showSolidBackground = true,
    this.iconOpacity = 0.15,
  });

  @override
  State<FloatingBackground> createState() => _FloatingBackgroundState();
}

class _FloatingBackgroundState extends State<FloatingBackground> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final Random _random = Random();
  
  final List<IconData> _iconTypes = [
    LucideIcons.bus,
    LucideIcons.graduationCap,
    LucideIcons.mapPin,
    LucideIcons.bookOpen,
    LucideIcons.navigation,
    LucideIcons.building, // School fallback
    LucideIcons.compass,
  ];

  late List<_FloatingIconParams> _icons;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat(reverse: true);

    _icons = List.generate(30, (index) {
      return _FloatingIconParams(
        icon: _iconTypes[_random.nextInt(_iconTypes.length)],
        size: 30.0 + _random.nextDouble() * 35.0,
        xOffset: _random.nextDouble(),
        yOffset: _random.nextDouble(),
        speed: 0.2 + _random.nextDouble() * 0.8,
        amplitude: 0.05 + _random.nextDouble() * 0.1,
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // The background color
        if (widget.showSolidBackground)
          Container(
            color: const Color(0xFFF4F7FB),
          ),
        // The floating icons
        Positioned.fill(
          child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return LayoutBuilder(
              builder: (context, constraints) {
                return Stack(
                  children: _icons.map((params) {
                    // Calculate position based on time, offset, speed, and amplitude
                    final x = params.xOffset * constraints.maxWidth;
                    final basePosY = params.yOffset * constraints.maxHeight;
                    
                    // Sine wave movement on Y axis
                    final y = basePosY + sin((_controller.value * 2 * pi * params.speed)) * (constraints.maxHeight * params.amplitude);

                    return Positioned(
                      left: x,
                      top: y,
                      child: Icon(
                        params.icon,
                        size: params.size,
                        color: widget.iconColor.withValues(alpha: widget.iconOpacity),
                      ),
                    );
                  }).toList(),
                );
              },
            );
          },
        ),
        ),
        // The actual page content
        widget.child,
      ],
    );
  }
}

class _FloatingIconParams {
  final IconData icon;
  final double size;
  final double xOffset; // 0.0 to 1.0
  final double yOffset; // 0.0 to 1.0
  final double speed;
  final double amplitude;

  _FloatingIconParams({
    required this.icon,
    required this.size,
    required this.xOffset,
    required this.yOffset,
    required this.speed,
    required this.amplitude,
  });
}
