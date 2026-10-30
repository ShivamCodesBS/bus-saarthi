/// App-wide constants for the Bus Saarthi student/parent app.
///
/// API URLs are configured at build time via --dart-define flags:
///   flutter run --dart-define=API_URL=http://10.0.2.2:5000
///   flutter build apk --dart-define=API_URL=https://your-vps.com
class AppConstants {
  // API URL — configurable via --dart-define=API_URL=...
  // Defaults to the production Render backend (same as the web app).
  static const String restApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://invertis-bus-saarthi.onrender.com',
  );

  // WebSocket URL — defaults to same as REST API.
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://invertis-bus-saarthi.onrender.com',
  );

  // ── Session storage keys (mirror the web app's localStorage keys) ──
  static const String storageTokenKey = 'jwt_token';
  static const String storageUserKey = 'bus_saarthi_user';

  // ── Preference keys (mirror Settings.jsx localStorage keys) ──
  static const String prefLangKey = 'pref_lang';
  static const String prefDarkKey = 'pref_dark';

  // ── Role values (mirror the backend UserRole enum) ──
  static const String rolePassenger = 'passenger';
  static const String roleParent = 'parent';

  // App version shown on the Settings page.
  static const String appVersion = '1.0.0';
}
