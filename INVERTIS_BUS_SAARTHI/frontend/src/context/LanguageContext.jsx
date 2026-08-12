import { createContext, useContext, useState, useEffect } from 'react';
import translations from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('pref_lang') === 'Hindi (हिंदी)' ? 'hi' : 'en');

  const setLanguage = (langCode) => {
    setLang(langCode);
    // Also sync with the localStorage key that Settings.jsx uses
    localStorage.setItem('pref_lang', langCode === 'hi' ? 'Hindi (हिंदी)' : 'English');
  };

  // Listen for localStorage changes (when Settings.jsx changes language)
  useEffect(() => {
    const syncLang = () => {
      const stored = localStorage.getItem('pref_lang');
      setLang(stored === 'Hindi (हिंदी)' ? 'hi' : 'en');
    };
    window.addEventListener('storage', syncLang);
    return () => window.removeEventListener('storage', syncLang);
  }, []);

  const t = (key) => translations[lang]?.[key] || translations['en']?.[key] || key;

  const translateName = (name) => {
    if (!name || lang !== 'hi') return name;
    
    // Syllable-based phonetic fallback transliterator for any future unknown name
    const transliterateWordPhonetic = (word) => {
      let result = '';
      let i = 0;
      while (i < word.length) {
        const char = word[i];
        const next = word[i + 1] || '';
        
        let hiChar = '';
        let isVowel = 'aeiou'.includes(char);
        let step = 1;

        if (isVowel) {
          const isStart = i === 0;
          if (char === 'a') {
            if (next === 'a') { hiChar = isStart ? 'आ' : 'ा'; step = 2; }
            else if (next === 'i') { hiChar = isStart ? 'ऐ' : 'ै'; step = 2; }
            else if (next === 'u') { hiChar = isStart ? 'औ' : 'ौ'; step = 2; }
            else { hiChar = isStart ? 'अ' : ''; }
          } else if (char === 'e') {
            if (next === 'e') { hiChar = isStart ? 'ई' : 'ी'; step = 2; }
            else { hiChar = isStart ? 'ए' : 'े'; }
          } else if (char === 'i') {
            hiChar = isStart ? 'इ' : 'ि';
          } else if (char === 'o') {
            if (next === 'o') { hiChar = isStart ? 'ऊ' : 'ू'; step = 2; }
            else { hiChar = isStart ? 'ओ' : 'ो'; }
          } else if (char === 'u') {
            hiChar = isStart ? 'उ' : 'ु';
          }
          result += hiChar;
          i += step;
          continue;
        }

        if (char === 'k') {
          if (next === 'h') { hiChar = 'ख'; step = 2; }
          else { hiChar = 'क'; }
        } else if (char === 'g') {
          if (next === 'h') { hiChar = 'घ'; step = 2; }
          else { hiChar = 'ग'; }
        } else if (char === 'c') {
          if (next === 'h') { hiChar = 'च'; step = 2; }
          else { hiChar = 'क'; }
        } else if (char === 'j') {
          hiChar = 'ज';
        } else if (char === 't') {
          if (next === 'h') { hiChar = 'थ'; step = 2; }
          else { hiChar = 'त'; }
        } else if (char === 'd') {
          if (next === 'h') { hiChar = 'ध'; step = 2; }
          else { hiChar = 'द'; }
        } else if (char === 'n') {
          hiChar = 'न';
        } else if (char === 'p') {
          if (next === 'h') { hiChar = 'फ'; step = 2; }
          else { hiChar = 'प'; }
        } else if (char === 'b') {
          if (next === 'h') { hiChar = 'भ'; step = 2; }
          else { hiChar = 'ब'; }
        } else if (char === 'm') {
          hiChar = 'म';
        } else if (char === 'y') {
          hiChar = 'य';
        } else if (char === 'r') {
          hiChar = 'र';
        } else if (char === 'l') {
          hiChar = 'ल';
        } else if (char === 'v' || char === 'w') {
          hiChar = 'व';
        } else if (char === 's') {
          if (next === 'h') { hiChar = 'श'; step = 2; }
          else { hiChar = 'स'; }
        } else if (char === 'h') {
          hiChar = 'ह';
        } else {
          hiChar = char;
        }

        result += hiChar;
        i += step;
      }
      return result;
    };

    const nameMap = {
      'abhinav': 'अभिनव',
      'srivastava': 'श्रीवास्तव',
      'lovish': 'लविश',
      'chauhan': 'चौहान',
      'gaurav': 'गौरव',
      'kumar': 'कुमार',
      'passenger': 'छात्र',
      'passenger user': 'छात्र',
      'driver': 'चालक',
      'driver user': 'चालक',
      'admin': 'प्रशासक',
      'admin user': 'प्रशासक',
      'singh': 'सिंह',
      'sharma': 'शर्मा',
      'verma': 'वर्मा',
      'gupta': 'गुप्ता',
      'amit': 'अमित',
      'rahul': 'राहुल',
      'rohit': 'रोहित',
      'priya': 'प्रिया',
      'preeti': 'प्रीति',
      'pooja': 'पूजा',
      'sneha': 'स्नेहा',
      'neha': 'नेहा',
      'anil': 'अनिल',
      'sunil': 'सुनील',
      'sanjay': 'संजय',
      'rajesh': 'राजेश',
      'vikram': 'विक्रम',
      'karan': 'करण',
      'deepak': 'दीपक',
      'sandeep': 'संदीप',
      'manish': 'मनीष',
      'kapil': 'कपिल',
      'raj': 'राज'
    };

    const words = name.split(/\s+/);
    const translated = words.map(word => {
      const clean = word.toLowerCase().trim().replace(/[^a-z]/g, '');
      if (!clean) return word;
      return nameMap[clean] || transliterateWordPhonetic(clean);
    });

    return translated.join(' ');
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, translateName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
export default LanguageContext;
