import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../core/theme.dart';
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
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      }
    } else {
      // Show the exact error from AuthService (wrong creds, rate limit,
      // server cold-starting, network down, etc.) rather than a generic message.
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
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.directions_bus, size: 80, color: AppTheme.orange),
              const SizedBox(height: 32),
              const Text(
                'Bus Sensor Login',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.black,
                ),
              ),
              const SizedBox(height: 32),
              DropdownButtonFormField<String>(
                value: _selectedRole,
                dropdownColor: AppTheme.surface,
                style: const TextStyle(color: AppTheme.black, fontSize: 16),
                decoration: const InputDecoration(
                  labelText: 'Login Role',
                  prefixIcon: Icon(Icons.badge, color: AppTheme.blackSoft),
                ),
                items: const [
                  DropdownMenuItem(value: 'driver', child: Text('Driver')),
                  DropdownMenuItem(value: 'admin', child: Text('Admin')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _selectedRole = val);
                },
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _loginIdController,
                style: const TextStyle(color: AppTheme.black),
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Login ID',
                  prefixIcon: Icon(Icons.person, color: AppTheme.blackSoft),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                style: const TextStyle(color: AppTheme.black),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _handleLogin(),
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock, color: AppTheme.blackSoft),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      color: AppTheme.blackSoft,
                    ),
                    onPressed: () {
                      setState(() => _obscurePassword = !_obscurePassword);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleLogin,
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
                        'LOGIN',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
