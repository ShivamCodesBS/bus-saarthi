import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants.dart';
import '../core/translations.dart';

/// Port of the web LanguageContext: `lang`, `setLanguage`, `t(key)`,
/// and the Hindi `translateName` transliterator. The language choice is
/// persisted in the same `pref_lang` SharedPreferences key the web app
/// uses in localStorage.
class LanguageProvider extends ChangeNotifier {
  String _lang = 'en';

  String get lang => _lang;

  /// Same label list the Settings page shows. Urdu/Bengali have no
  /// dictionary yet and fall back to English (exactly like the web).
  static const List<String> languageOptions = [
    'English',
    'Hindi (हिंदी)',
    'Urdu (اردو)',
    'Bengali (বাংলা)',
  ];

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    // Web rule: stored 'Hindi (हिंदी)' → 'hi', anything else → 'en'.
    _lang = prefs.getString(AppConstants.prefLangKey) == 'Hindi (हिंदी)' ? 'hi' : 'en';
  }

  /// [langCode] is 'en' or 'hi' (the two supported dictionaries).
  Future<void> setLanguage(String langCode) async {
    if (langCode != 'en' && langCode != 'hi') return;
    _lang = langCode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      AppConstants.prefLangKey,
      langCode == 'hi' ? 'Hindi (हिंदी)' : 'English',
    );
    notifyListeners();
  }

  /// Same fallback chain as the web `t()`: lang → en → key.
  String t(String key) =>
      translations[_lang]?[key] ?? translations['en']?[key] ?? key;

  /// Port of the web `translateName` — maps known names and falls back to a
  /// syllable-based phonetic transliteration when the language is Hindi.
  String? translateName(String? name) {
    if (name == null || name.isEmpty || _lang != 'hi') return name;

    const nameMap = {
      'abhinav': 'अभिनव', 'srivastava': 'श्रीवास्तव', 'lovish': 'लविश',
      'chauhan': 'चौहान', 'gaurav': 'गौरव', 'kumar': 'कुमार',
      'passenger': 'छात्र', 'driver': 'चालक', 'admin': 'प्रशासक',
      'singh': 'सिंह', 'sharma': 'शर्मा', 'verma': 'वर्मा', 'gupta': 'गुप्ता',
      'amit': 'अमित', 'rahul': 'राहुल', 'rohit': 'रोहित', 'priya': 'प्रिया',
      'preeti': 'प्रीति', 'pooja': 'पूजा', 'sneha': 'स्नेहा', 'neha': 'नेहा',
      'anil': 'अनिल', 'sunil': 'सुनील', 'sanjay': 'संजय', 'rajesh': 'राजेश',
      'vikram': 'विक्रम', 'karan': 'करण', 'deepak': 'दीपक',
      'sandeep': 'संदीप', 'manish': 'मनीष', 'kapil': 'कपिल', 'raj': 'राज',
    };

    return name
        .split(RegExp(r'\s+'))
        .map((word) {
          final clean = word.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
          if (clean.isEmpty) return word;
          return nameMap[clean] ?? _transliterateWordPhonetic(clean);
        })
        .join(' ');
  }

  /// Syllable-based phonetic fallback transliterator (from the web app).
  static String _transliterateWordPhonetic(String word) {
    bool isVowel(String c) => 'aeiou'.contains(c);
    final result = StringBuffer();
    var i = 0;
    while (i < word.length) {
      final char = word[i];
      final next = i + 1 < word.length ? word[i + 1] : '';
      var hiChar = '';
      var step = 1;

      if (isVowel(char)) {
        final isStart = i == 0;
        if (char == 'a') {
          if (next == 'a') {
            hiChar = isStart ? 'आ' : 'ा'; step = 2;
          } else if (next == 'i') {
            hiChar = isStart ? 'ऐ' : 'ै'; step = 2;
          } else if (next == 'u') {
            hiChar = isStart ? 'औ' : 'ौ'; step = 2;
          } else {
            hiChar = isStart ? 'अ' : '';
          }
        } else if (char == 'e') {
          if (next == 'e') {
            hiChar = isStart ? 'ई' : 'ी'; step = 2;
          } else {
            hiChar = isStart ? 'ए' : 'े';
          }
        } else if (char == 'i') {
          hiChar = isStart ? 'इ' : 'ि';
        } else if (char == 'o') {
          if (next == 'o') {
            hiChar = isStart ? 'ऊ' : 'ू'; step = 2;
          } else {
            hiChar = isStart ? 'ओ' : 'ो';
          }
        } else if (char == 'u') {
          hiChar = isStart ? 'उ' : 'ु';
        }
        result.write(hiChar);
        i += step;
        continue;
      }

      switch (char) {
        case 'k':
          if (next == 'h') { hiChar = 'ख'; step = 2; } else { hiChar = 'क'; }
          break;
        case 'g':
          if (next == 'h') { hiChar = 'घ'; step = 2; } else { hiChar = 'ग'; }
          break;
        case 'c':
          if (next == 'h') { hiChar = 'च'; step = 2; } else { hiChar = 'क'; }
          break;
        case 'j':
          hiChar = 'ज';
          break;
        case 't':
          if (next == 'h') { hiChar = 'थ'; step = 2; } else { hiChar = 'त'; }
          break;
        case 'd':
          if (next == 'h') { hiChar = 'ध'; step = 2; } else { hiChar = 'द'; }
          break;
        case 'n':
          hiChar = 'न';
          break;
        case 'p':
          if (next == 'h') { hiChar = 'फ'; step = 2; } else { hiChar = 'प'; }
          break;
        case 'b':
          if (next == 'h') { hiChar = 'भ'; step = 2; } else { hiChar = 'ब'; }
          break;
        case 'm':
          hiChar = 'म';
          break;
        case 'y':
          hiChar = 'य';
          break;
        case 'r':
          hiChar = 'र';
          break;
        case 'l':
          hiChar = 'ल';
          break;
        case 'v':
        case 'w':
          hiChar = 'व';
          break;
        case 's':
          if (next == 'h') { hiChar = 'श'; step = 2; } else { hiChar = 'स'; }
          break;
        case 'h':
          hiChar = 'ह';
          break;
        default:
          hiChar = char;
      }
      result.write(hiChar);
      i += step;
    }
    return result.toString();
  }
}
