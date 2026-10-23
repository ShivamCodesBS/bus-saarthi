import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../core/theme.dart';
import '../core/constants.dart';
import 'driver_dashboard_screen.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _loginIdController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String _selectedRole = 'driver';

  /// Which way this phone is being used:
  ///   driver     the driver's own phone — live map, trip tracking, GPS broadcasting
  ///   busDevice  a device fixed inside the bus — ArcFace scanner + telemetry
  String _mode = AppConstants.modeDriver;

  @override
  void dispose() {
    _loginIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final loginId = _loginIdController.text.trim();
    final password = _passwordController.text.trim();

    if (loginId.isEmpty || password.isEmpty) {
      _showError('Please enter your Login ID and password.');
      return;
    }

    setState(() => _isLoading = true);

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(loginId, password, _selectedRole);

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      if (_selectedRole == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin_dashboard');
      } else {
        Navigator.pushReplacementNamed(context, '/driver_dashboard');
      }
    } else {
      final error = authProvider.lastError ?? 'Login failed. Please try again.';
      _showError(error);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.red.shade700,
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── App Brand Header ──────────────────────────────────
                Center(
                  child: Container(
                    height: 54,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.grey.shade200),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/images/logo.png',
                      height: 42,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.directions_bus_rounded,
                        size: 36,
                        color: AppTheme.orange,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'INVERTIS BUS SAARTHI',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    color: AppTheme.black,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Smart Fleet & Telemetry System',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.blackSoft,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),

                // ── Operation Mode Selector ───────────────────────────
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _buildModeTab(
                          icon: Icons.phone_android_rounded,
                          label: 'Driver Phone',
                          isSelected: _mode == AppConstants.modeDriver,
                          onTap: () => setState(() => _mode = AppConstants.modeDriver),
                        ),
                      ),
                      Expanded(
                        child: _buildModeTab(
                          icon: Icons.sensors_rounded,
                          label: 'In-Bus Scanner',
                          isSelected: _mode == AppConstants.modeBusDevice,
                          onTap: () => setState(() => _mode = AppConstants.modeBusDevice),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Content Switcher Based on Mode ────────────────────
                if (_mode == AppConstants.modeDriver)
                  _buildDriverLoginForm()
                else
                  _buildInBusDeviceCard(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Mode Tab Button ───────────────────────────────────────────
  Widget _buildModeTab({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? AppTheme.orange : AppTheme.blackSoft,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? AppTheme.black : AppTheme.blackSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Driver Login Form ─────────────────────────────────────────
  Widget _buildDriverLoginForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  color: AppTheme.orange,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'DRIVER & STAFF SIGN IN',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                  color: AppTheme.black,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Role Selector Dropdown
          DropdownButtonFormField<String>(
            value: _selectedRole,
            dropdownColor: Colors.white,
            style: const TextStyle(
              color: AppTheme.black,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              labelText: 'Sign in Role',
              labelStyle: const TextStyle(color: AppTheme.blackSoft, fontSize: 13),
              prefixIcon: const Icon(Icons.badge_outlined, color: AppTheme.orange),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.surfaceBorder),
              ),
            ),
            items: const [
              DropdownMenuItem(value: 'driver', child: Text('Driver (Bus Tracking & Map)')),
              DropdownMenuItem(value: 'admin', child: Text('Admin / Transport Staff')),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _selectedRole = val);
            },
          ),
          const SizedBox(height: 14),

          // Login ID Field
          TextField(
            controller: _loginIdController,
            style: const TextStyle(color: AppTheme.black, fontWeight: FontWeight.w600),
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Login ID or Phone Number',
              hintText: 'e.g. DRV001 or 9876543210',
              labelStyle: const TextStyle(color: AppTheme.blackSoft, fontSize: 13),
              prefixIcon: const Icon(Icons.person_outline_rounded, color: AppTheme.orange),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.surfaceBorder),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Password Field
          TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: const TextStyle(color: AppTheme.black, fontWeight: FontWeight.w600),
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _handleLogin(),
            decoration: InputDecoration(
              labelText: 'Password',
              labelStyle: const TextStyle(color: AppTheme.blackSoft, fontSize: 13),
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppTheme.orange),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: AppTheme.blackSoft,
                ),
                onPressed: () {
                  setState(() => _obscurePassword = !_obscurePassword);
                },
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppTheme.surfaceBorder),
              ),
            ),
          ),
          const SizedBox(height: 22),

          // Submit Button
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.orange,
                elevation: 3,
                shadowColor: AppTheme.orange.withOpacity(0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'SIGN IN TO DASHBOARD',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ── In-Bus Hardware Mode Card (No Login Required) ─────────────
  Widget _buildInBusDeviceCard() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.surfaceBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.sensors_rounded,
                  color: Color(0xFF10B981),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Fixed In-Bus Device',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.black,
                      ),
                    ),
                    Text(
                      'Automated Hardware Terminal',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.blackSoft,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 12),
          _buildFeatureBullet(
            icon: Icons.face_retouching_natural_rounded,
            title: 'ArcFace Facial Attendance',
            desc: 'On-device offline neural face matcher for boarding students',
          ),
          const SizedBox(height: 12),
          _buildFeatureBullet(
            icon: Icons.speed_rounded,
            title: 'Continuous Telemetry',
            desc: 'Emits live speed, GPS, heading and accelerometer telemetry',
          ),
          const SizedBox(height: 12),
          _buildFeatureBullet(
            icon: Icons.vpn_key_rounded,
            title: 'Zero Sign-in Required',
            desc: 'Identifies automatically via secure hardware token',
          ),
          const SizedBox(height: 24),

          // Launch Device Mode Button
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const DashboardScreen(
                      mode: AppConstants.modeBusDevice,
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                elevation: 3,
                shadowColor: const Color(0xFF10B981).withOpacity(0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.launch_rounded, size: 20, color: Colors.white),
                  SizedBox(width: 8),
                  Text(
                    'LAUNCH IN-BUS SCANNER',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureBullet({
    required IconData icon,
    required String title,
    required String desc,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF10B981)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.black,
                ),
              ),
              Text(
                desc,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppTheme.blackSoft,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
