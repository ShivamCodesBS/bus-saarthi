import 'dart:math';
import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────
//  BusSarthiLoader  — reusable animated scan-ring loader
//  Usage: BusSarthiLoader()  or  BusSarthiLoader.overlay(context)
// ─────────────────────────────────────────────────────────────

class BusSarthiLoader extends StatefulWidget {
  final double size;
  final String? label;
  final Color ringColor;
  final Color dotColor;

  const BusSarthiLoader({
    Key? key,
    this.size = 80,
    this.label,
    this.ringColor = const Color(0xFFFF6B00),
    this.dotColor = const Color(0xFFFF6B00),
  }) : super(key: key);

  /// Shows a full-screen white overlay with the loader in the center.
  static Future<void> show(BuildContext context, {String label = 'Please wait...'}) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.white.withOpacity(0.85),
      builder: (_) => WillPopScope(
        onWillPop: () async => false,
        child: Center(
          child: BusSarthiLoader(size: 90, label: label),
        ),
      ),
    );
  }

  static void hide(BuildContext context) {
    if (Navigator.of(context, rootNavigator: true).canPop()) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  @override
  State<BusSarthiLoader> createState() => _BusSarthiLoaderState();
}

class _BusSarthiLoaderState extends State<BusSarthiLoader> with TickerProviderStateMixin {
  late AnimationController _spinController;
  late AnimationController _pulseController;
  late AnimationController _dotController;
  late Animation<double> _spinAnim;
  late Animation<double> _pulseAnim;
  late Animation<double> _dotAnim;

  @override
  void initState() {
    super.initState();

    _spinController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _dotController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();

    _spinAnim = Tween<double>(begin: 0, end: 2 * pi).animate(
      CurvedAnimation(parent: _spinController, curve: Curves.linear),
    );

    _pulseAnim = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _dotAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _dotController, curve: Curves.linear),
    );
  }

  @override
  void dispose() {
    _spinController.dispose();
    _pulseController.dispose();
    _dotController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── Animated Ring + Pulsing Core ──
        AnimatedBuilder(
          animation: Listenable.merge([_spinAnim, _pulseAnim, _dotAnim]),
          builder: (_, __) {
            return SizedBox(
              width: s,
              height: s,
              child: CustomPaint(
                painter: _LoaderPainter(
                  spinAngle: _spinAnim.value,
                  pulse: _pulseAnim.value,
                  dotProgress: _dotAnim.value,
                  ringColor: widget.ringColor,
                  dotColor: widget.dotColor,
                ),
              ),
            );
          },
        ),
        if (widget.label != null) ...[
          const SizedBox(height: 20),
          _DotLoadingText(label: widget.label!, color: widget.ringColor),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  Custom Painter: spinning arc + orbiting dot + pulsing core
// ─────────────────────────────────────────────────────────────
class _LoaderPainter extends CustomPainter {
  final double spinAngle;
  final double pulse;
  final double dotProgress;
  final Color ringColor;
  final Color dotColor;

  _LoaderPainter({
    required this.spinAngle,
    required this.pulse,
    required this.dotProgress,
    required this.ringColor,
    required this.dotColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final strokeWidth = size.width * 0.08;

    // --- Track ring (faint) ---
    final trackPaint = Paint()
      ..color = ringColor.withOpacity(0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius - strokeWidth / 2, trackPaint);

    // --- Spinning arc (orange gradient sweep) ---
    final arcRect = Rect.fromCircle(
      center: center,
      radius: radius - strokeWidth / 2,
    );

    // Draw multiple arc segments with decreasing opacity for comet effect
    for (int i = 0; i < 8; i++) {
      final opacity = (i + 1) / 8;
      final arcPaint = Paint()
        ..color = ringColor.withOpacity(opacity * 0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * (0.4 + opacity * 0.6)
        ..strokeCap = i == 7 ? StrokeCap.round : StrokeCap.butt;
      canvas.drawArc(
        arcRect,
        spinAngle - (8 - i) * 0.12,
        0.12,
        false,
        arcPaint,
      );
    }

    // --- Pulsing center core ---
    final corePaint = Paint()
      ..color = ringColor.withOpacity(0.15 * pulse)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, (radius * 0.38) * pulse, corePaint);

    final innerCorePaint = Paint()
      ..color = ringColor.withOpacity(0.55)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius * 0.22, innerCorePaint);

    // Bus icon center placeholder (B letter)
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'B',
        style: TextStyle(
          color: Colors.white,
          fontSize: radius * 0.32,
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2),
    );

    // --- Orbiting dot ---
    final dotAngle = spinAngle * 1.5;
    final dotRadius = radius - strokeWidth / 2;
    final dotX = center.dx + dotRadius * cos(dotAngle);
    final dotY = center.dy + dotRadius * sin(dotAngle);
    final dotPaint = Paint()
      ..color = dotColor
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(dotX, dotY), strokeWidth * 0.7, dotPaint);

    // Dot glow
    final dotGlowPaint = Paint()
      ..color = dotColor.withOpacity(0.3)
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawCircle(Offset(dotX, dotY), strokeWidth * 1.2, dotGlowPaint);
  }

  @override
  bool shouldRepaint(_LoaderPainter old) => true;
}

// ─────────────────────────────────────────────────────────────
//  Animated "Loading..." dots text
// ─────────────────────────────────────────────────────────────
class _DotLoadingText extends StatefulWidget {
  final String label;
  final Color color;
  const _DotLoadingText({required this.label, required this.color});

  @override
  State<_DotLoadingText> createState() => _DotLoadingTextState();
}

class _DotLoadingTextState extends State<_DotLoadingText> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final dotCount = (_ctrl.value * 4).floor() % 4;
        final dots = '.' * dotCount;
        return Text(
          '${widget.label}$dots',
          style: TextStyle(
            color: widget.color,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  FaceScanOverlay — animated pulsing ring for the camera screen
// ─────────────────────────────────────────────────────────────
enum ScanState { scanning, success, duplicate, unknown }

class FaceScanOverlay extends StatefulWidget {
  final ScanState state;
  final String? label;

  const FaceScanOverlay({Key? key, required this.state, this.label}) : super(key: key);

  @override
  State<FaceScanOverlay> createState() => _FaceScanOverlayState();
}

class _FaceScanOverlayState extends State<FaceScanOverlay> with TickerProviderStateMixin {
  late AnimationController _pulseCtrl;
  late AnimationController _scanLineCtrl;
  late Animation<double> _pulseAnim;
  late Animation<double> _scanLineAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _scanLineCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _pulseAnim = Tween<double>(begin: 0.93, end: 1.07).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
    _scanLineAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _scanLineCtrl, curve: Curves.linear),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _scanLineCtrl.dispose();
    super.dispose();
  }

  Color get _stateColor {
    switch (widget.state) {
      case ScanState.success:
        return const Color(0xFF22C55E);
      case ScanState.duplicate:
        return const Color(0xFFFBBF24);
      case ScanState.unknown:
        return const Color(0xFFEF4444);
      case ScanState.scanning:
        return const Color(0xFFFF6B00);
    }
  }

  IconData get _stateIcon {
    switch (widget.state) {
      case ScanState.success:
        return Icons.check_circle_rounded;
      case ScanState.duplicate:
        return Icons.warning_rounded;
      case ScanState.unknown:
        return Icons.person_off_rounded;
      case ScanState.scanning:
        return Icons.face_retouching_natural;
    }
  }

  String get _stateText {
    switch (widget.state) {
      case ScanState.success:
        return widget.label != null ? 'Welcome, ${widget.label}!' : 'Verified ✓';
      case ScanState.duplicate:
        return widget.label != null ? '${widget.label} — Already Marked' : 'Already Marked';
      case ScanState.unknown:
        return 'Face Not Recognized';
      case ScanState.scanning:
        return 'Scanning face...';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _stateColor;
    return AnimatedBuilder(
      animation: Listenable.merge([_pulseAnim, _scanLineAnim]),
      builder: (_, __) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Oval scan guide with pulsing ring
            Transform.scale(
              scale: widget.state == ScanState.scanning ? _pulseAnim.value : 1.0,
              child: Container(
                width: 180,
                height: 220,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(110),
                  border: Border.all(
                    color: color.withOpacity(0.85),
                    width: 3,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: color.withOpacity(0.3),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(110),
                  child: Stack(
                    children: [
                      // Scan line (only when scanning)
                      if (widget.state == ScanState.scanning)
                        Positioned(
                          top: _scanLineAnim.value * 220,
                          left: 0,
                          right: 0,
                          child: Container(
                            height: 2,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  color.withOpacity(0),
                                  color.withOpacity(0.8),
                                  color.withOpacity(0),
                                ],
                              ),
                            ),
                          ),
                        ),

                      // Corner brackets
                      ..._buildCornerBrackets(color),

                      // Status icon center
                      if (widget.state != ScanState.scanning)
                        Center(
                          child: Icon(
                            _stateIcon,
                            color: color,
                            size: 60,
                            shadows: [
                              Shadow(color: Colors.black38, blurRadius: 8),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Status banner
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: color.withOpacity(0.4), width: 1.5),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(_stateIcon, color: color, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    _stateText,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  List<Widget> _buildCornerBrackets(Color color) {
    const len = 28.0;
    const thick = 3.0;
    return [
      // Top-left
      Positioned(top: 12, left: 12, child: _bracket(color, len, thick, top: true, left: true)),
      // Top-right
      Positioned(top: 12, right: 12, child: _bracket(color, len, thick, top: true, left: false)),
      // Bottom-left
      Positioned(bottom: 12, left: 12, child: _bracket(color, len, thick, top: false, left: true)),
      // Bottom-right
      Positioned(bottom: 12, right: 12, child: _bracket(color, len, thick, top: false, left: false)),
    ];
  }

  Widget _bracket(Color color, double len, double thick, {required bool top, required bool left}) {
    return SizedBox(
      width: len,
      height: len,
      child: CustomPaint(
        painter: _BracketPainter(color: color, thickness: thick, top: top, left: left),
      ),
    );
  }
}

class _BracketPainter extends CustomPainter {
  final Color color;
  final double thickness;
  final bool top;
  final bool left;

  const _BracketPainter({required this.color, required this.thickness, required this.top, required this.left});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thickness
      ..strokeCap = StrokeCap.square
      ..style = PaintingStyle.stroke;

    final double x1 = left ? 0 : size.width;
    final double x2 = left ? size.width : 0;
    final double y1 = top ? 0 : size.height;
    final double y2 = top ? size.height : 0;

    canvas.drawLine(Offset(x1, y1), Offset(x2, y1), paint); // horizontal
    canvas.drawLine(Offset(x1, y1), Offset(x1, y2), paint); // vertical
  }

  @override
  bool shouldRepaint(_BracketPainter old) => old.color != color;
}
