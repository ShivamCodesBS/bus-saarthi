import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Port of the web UserAvatar: profile pic, or initials on a colored
/// circle derived from the name hash.
class UserAvatar extends StatelessWidget {
  final String? src;
  final String? name;
  final double size;

  const UserAvatar({super.key, this.src, this.name, this.size = 36});

  static const List<Color> _palette = [
    Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899),
    Color(0xFF22C55E), Color(0xFFF59E0B), Color(0xFFEF4444),
    Color(0xFF14B8A6), Color(0xFF6366F1),
  ];

  @override
  Widget build(BuildContext context) {
    final String initials = _initials(name);
    final Color color = _palette[(name?.hashCode ?? 0).abs() % _palette.length];

    final Widget inner = ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: (src != null && src!.isNotEmpty)
            ? CachedNetworkImage(
                imageUrl: src!,
                fit: BoxFit.cover,
                fadeInDuration: const Duration(milliseconds: 150),
                errorWidget: (_, __, ___) => _initialsCircle(initials, color),
                placeholder: (_, __) => _initialsCircle(initials, color),
              )
            : _initialsCircle(initials, color),
      ),
    );

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 4, offset: const Offset(0, 1))],
      ),
      child: inner,
    );
  }

  Widget _initialsCircle(String initials, Color color) => Container(
        color: color,
        alignment: Alignment.center,
        child: Text(
          initials,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.38,
          ),
        ),
      );

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'P';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}
