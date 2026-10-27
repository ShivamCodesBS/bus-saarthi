import 'package:shared_preferences/shared_preferences.dart';

/// Local user-facing notification preferences shared by settings and event handlers.
class NotificationPreferences {
  static const sosKey = 'pref_sos';
  static const pushKey = 'pref_push';

  static Future<bool> sosAlertsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(sosKey) != 'false';
  }

  static Future<bool> pushNotificationsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(pushKey) != 'false';
  }

  static Future<void> setSosAlertsEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(sosKey, enabled ? 'true' : 'false');
  }

  static Future<void> setPushNotificationsEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(pushKey, enabled ? 'true' : 'false');
  }
}
