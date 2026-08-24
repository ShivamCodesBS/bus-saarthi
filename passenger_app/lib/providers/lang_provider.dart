import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/translations.dart';

class LangProvider with ChangeNotifier {
  String _lang = 'en';
  final SharedPreferences _prefs;

  String get lang => _lang;

  LangProvider(this._prefs) {
    _lang = _prefs.getString('pref_lang') ?? 'en';
  }

  void setLanguage(String newLang) {
    _lang = newLang;
    _prefs.setString('pref_lang', newLang);
    notifyListeners();
  }

  void toggleLanguage() {
    setLanguage(_lang == 'en' ? 'hi' : 'en');
  }

  String t(String key) {
    return translations[_lang]?[key] ?? translations['en']?[key] ?? key;
  }
}
