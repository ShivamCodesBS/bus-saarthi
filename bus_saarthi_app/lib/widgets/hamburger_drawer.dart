import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../screens/community_screen.dart';
import '../screens/home_screen.dart';
import '../screens/login_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/settings_screen.dart';

/// Port of the web HamburgerMenu: right-side drawer with the orange
/// Community button, Home/Profile/Settings rows and the red Log Out.
class HamburgerDrawer extends StatelessWidget {
  final String activePath;
  final VoidCallback onClose;

  const HamburgerDrawer({
    super.key,
    required this.activePath,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final Color borderColor = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final Color textDark = isDark ? AppColors.darkText : AppColors.lightText;
    final Color bgColor = isDark ? AppColors.darkCard : AppColors.lightCard;
    final Color bgSoft = isDark ? AppColors.darkBg : AppColors.lightBg;

    void navigate(Widget screen) {
      onClose();
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => screen));
    }

    return SafeArea(
      child: Align(
        alignment: Alignment.topRight,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.70,
          constraints: const BoxConstraints(maxWidth: 350),
          height: double.infinity,
          decoration: BoxDecoration(
            color: bgColor,
            border: Border(left: BorderSide(color: borderColor)),
            boxShadow: AppShadows.large,
          ),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: borderColor))),
                child: Row(
                  children: [
                    Image.asset('assets/images/logo.png', height: 30, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          text: 'BUS ',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: AppColors.primaryBlue),
                          children: const [
                            TextSpan(
                                text: 'SAARTHI',
                                style: TextStyle(color: AppColors.secondaryOrange)),
                          ],
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: onClose,
                      icon: Icon(LucideIcons.x, size: 24, color: textDark),
                    ),
                  ],
                ),
              ),

              // Items
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Orange Community button
                      Material(
                        color: AppColors.secondaryOrange,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => navigate(const CommunityScreen()),
                          child: Container(
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.secondaryOrange.withValues(alpha: 0.30),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                const Icon(LucideIcons.users, size: 22, color: Colors.white),
                                const SizedBox(width: 14),
                                Text(
                                  lang.t('busCommunity'),
                                  style: const TextStyle(
                                      color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _MenuRow(
                        icon: LucideIcons.home,
                        label: lang.t('home'),
                        active: activePath == '/home',
                        activeColor: AppColors.primaryBlue,
                        bgColor: bgSoft,
                        textColor: textDark,
                        onTap: () => navigate(const HomeScreen()),
                      ),
                      const SizedBox(height: 12),
                      _MenuRow(
                        icon: LucideIcons.user,
                        label: lang.t('profile'),
                        active: activePath == '/profile',
                        activeColor: AppColors.primaryBlue,
                        bgColor: bgSoft,
                        textColor: textDark,
                        onTap: () => navigate(const ProfileScreen()),
                      ),
                      const SizedBox(height: 12),
                      _MenuRow(
                        icon: LucideIcons.settings,
                        label: lang.t('settings'),
                        active: activePath == '/settings',
                        activeColor: AppColors.primaryBlue,
                        bgColor: bgSoft,
                        textColor: textDark,
                        onTap: () => navigate(const SettingsScreen()),
                      ),
                    ],
                  ),
                ),
              ),

              // Logout
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: borderColor))),
                child: Material(
                  color: const Color(0x1ACF1322),
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () async {
                      onClose();
                      await context.read<AuthProvider>().logout();
                      if (!context.mounted) return;
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.logOut, size: 21, color: Color(0xFFCF1322)),
                          const SizedBox(width: 14),
                          Text(
                            lang.t('logout'),
                            style: const TextStyle(
                                color: Color(0xFFCF1322), fontSize: 15.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final Color activeColor;
  final Color bgColor;
  final Color textColor;
  final VoidCallback onTap;

  const _MenuRow({
    required this.icon,
    required this.label,
    required this.active,
    required this.activeColor,
    required this.bgColor,
    required this.textColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? bgColor : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(icon, size: 21, color: active ? activeColor : textColor),
              const SizedBox(width: 14),
              Text(
                label,
                style: TextStyle(
                  color: active ? activeColor : textColor,
                  fontSize: 15.5,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
