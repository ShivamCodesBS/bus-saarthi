import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/colors.dart';

class HamburgerMenu extends StatelessWidget {
  const HamburgerMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899)],
                      ),
                    ),
                    padding: const EdgeInsets.all(2),
                    child: Container(
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: Center(
                        child: Text(
                          'P',
                          style: GoogleFonts.inter(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryBlue,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Abhinav S.', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                        Text('Passenger', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  _buildMenuItem(context, LucideIcons.user, 'Profile', '/profile'),
                  _buildMenuItem(context, LucideIcons.users, 'Community', '/community'),
                  _buildMenuItem(context, LucideIcons.settings, 'Settings', '/settings'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem(BuildContext context, IconData icon, String title, String route) {
    return ListTile(
      leading: Icon(icon, color: Colors.grey.shade700),
      title: Text(
        title,
        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.black87),
      ),
      onTap: () {
        Navigator.pop(context); // close drawer
        if (route != '/settings') { // mock settings
          Navigator.pushNamed(context, route);
        }
      },
    );
  }
}
