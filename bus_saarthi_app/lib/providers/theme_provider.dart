import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';

/// Port of the web dark-mode behaviour: Settings toggle persisted in the
/// same `pref_dark` localStorage key (`'true'` string, like the web).
class ThemeProvider extends ChangeNotifier {
  bool _darkMode = false;

  bool get darkMode => _darkMode;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _darkMode = prefs.getString(AppConstants.prefDarkKey) == 'true';
  }

  Future<void> setDarkMode(bool value) async {
    _darkMode = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.prefDarkKey, value ? 'true' : 'false');
  }

  Future<void> toggle() => setDarkMode(!_darkMode);
}
