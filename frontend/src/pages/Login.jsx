import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, User, Lock, ArrowRight, Shield, Car, Eye, EyeOff, Languages, Heart, Phone, GraduationCap, Users, ChevronDown, Briefcase, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import '../index.css';

import axios from 'axios';
import { BACKEND_URL } from '../config';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, setLanguage } = useLang();
  const [loginType, setLoginType] = useState('passenger'); // 'passenger', 'admin', 'transport_incharge', 'parent'
  // Inside "Passenger" the user can be a student or a member of staff
  // (teacher / driver). It only changes the label and the role sent to the
  // backend — the styling stays exactly as it was.
  const [passengerKind, setPassengerKind] = useState('student'); // 'student' | 'staff'
  const [passengerMenuOpen, setPassengerMenuOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Close the Student/Staff dropdown when clicking outside of it.
  useEffect(() => {
    if (!passengerMenuOpen) return;
    const onDocClick = (e) => {
      if (!e.target.closest?.('[data-passenger-select]')) {
        setPassengerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [passengerMenuOpen]);

  useEffect(() => {
    let interval;
    if (lockoutTimer) {
      setIsLocked(true);
      interval = setInterval(() => {
        const remaining = lockoutTimer - Date.now();
        if (remaining <= 0) {
          setLockoutTimer(null);
          setIsLocked(false);
          setErrorMessage('');
        } else {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setErrorMessage(`${t('loginAttemptsBlock')}${m}:${s < 10 ? '0'+s : s}`);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  /**
   * The role actually sent to the backend. For the "Passenger" tile this
   * depends on whether the user picked Student or Staff.
   */
  const resolveRole = () => {
    if (loginType !== 'passenger') return loginType;
    return passengerKind === 'staff' ? 'teacher' : 'passenger';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setErrorMessage('');
    if (userId && password) {
      setIsLoading(true);
      try {
        const response = await axios.post(`${BACKEND_URL}/api/login`, {
          login_id: userId,
          password: password
        });

        if (response.data.status === 'success') {
          const userData = {
            ...response.data.user,
            id: response.data.user.loginId || response.data.user.login_id || userId,
            token: response.data.token
          };

          login(userData);

          if (userData.role === 'admin') {
            navigate('/admin-dashboard', { replace: true });
          } else if (userData.role === 'transport_incharge') {
            navigate('/transport-incharge-dashboard', { replace: true });
          } else if (userData.role === 'parent') {
            navigate('/parent-dashboard', { replace: true });
          } else {
            navigate('/home', { replace: true });
          }
        }
      } catch (error) {
        console.error("Login failed:", error);
        if (error.response?.status === 429 && error.response?.data?.blockedUntil) {
          const remaining = error.response.data.blockedUntil - Date.now();
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setErrorMessage(`${t('loginAttemptsBlock')}${m}:${s < 10 ? '0'+s : s}`);
          setLockoutTimer(error.response.data.blockedUntil);
        } else {
          setErrorMessage(error.response?.data?.message || error.response?.data?.detail || t('invalidCredentials'));
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-4" style={{ backgroundColor: 'transparent', overflow: 'hidden' }}>
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: -2,
          opacity: 0.85
        }}
      >
        <source src="https://www.invertisuniversity.ac.in/uploads/banner/20251029150922.mp4" type="video/mp4" />
      </video>

      {/* Lightened overlay for better video visibility while keeping text readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
        zIndex: -1
      }}></div>

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '6px solid #333333',
        borderBottom: '4px solid var(--secondary-orange)',
        padding: '0.75rem 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img 
            src="/logo.png" 
            alt="Invertis Bus Saarthi" 
            style={{ height: '52px', maxHeight: '52px', objectFit: 'contain' }}
            onError={(e) => { e.target.onerror = null; e.target.src = '/favicon.png'; }}
          />
          <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--primary-blue)', letterSpacing: '-0.3px' }} className="hidden sm:inline">
            INVERTIS <span style={{ color: 'var(--secondary-orange)' }}>BUS SAARTHI</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            onClick={() => setLanguage(lang === 'en' ? 'hi' : 'en')}
            style={{
              backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none',
              padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold',
              fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(0,86,179,0.2)', transition: 'all 0.2s'
            }}
          >
            <Languages size={18} />
            {lang === 'en' ? 'हिंदी' : 'English'}
          </button>
        </div>
      </div>

      <div className="animate-slide-up p-login relative" style={{
        width: '100%', maxWidth: '540px', height: 'fit-content',
        borderRadius: '20px', zIndex: 2, margin: '100px 1rem 0 1rem',
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="flex flex-col items-center" style={{ marginBottom: '1.25rem' }}>
          <div className="w-20 h-20 mb-2 p-1.5 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg flex items-center justify-center">
            <img src="/logo.png" alt="Invertis Bus Saarthi" className="w-full h-full object-contain filter drop-shadow-md" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', margin: 0, lineHeight: 1.2 }}>{t('loginTitle')}</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '0.9rem' }}>{t('loginSubtitle')}</p>
        </div>

        {/* Toggle Switch */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '1.25rem',
          gap: '3px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}>
          {[
            {
              id: 'passenger',
              label:
                loginType === 'passenger' && passengerKind === 'staff'
                  ? (lang === 'hi' ? 'स्टाफ़' : 'Staff')
                  : (lang === 'hi' ? 'यात्री' : 'Passenger'),
              icon:
                loginType === 'passenger' && passengerKind === 'staff'
                  ? Briefcase
                  : GraduationCap,
            },
            { id: 'parent', label: lang === 'hi' ? 'पेरेंट' : 'Parent', icon: Users },
            { id: 'transport_incharge', label: lang === 'hi' ? 'टी.आई.' : 'T.I.', icon: Bus },
            { id: 'admin', label: lang === 'hi' ? 'एडमिन' : 'Admin', icon: Shield },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = loginType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setLoginType(id); setUserId(''); setPassword(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '0.55rem 0.15rem',
                  borderRadius: '10px',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.32)' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: 'clamp(0.68rem, 2.2vw, 0.8rem)',
                  letterSpacing: '-0.2px',
                  boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.18)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Student / Staff sub-selection.
            Only shown for the "Passenger" tile. It reuses the same
            translucent white styling as the tile row above so the page
            keeps its original look. */}
        {loginType === 'passenger' && (
          <div data-passenger-select style={{ position: 'relative', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setPassengerMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={passengerMenuOpen}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                backgroundColor: 'rgba(12, 30, 54, 0.62)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
              }}
            >
              {passengerKind === 'staff' ? (
                <Briefcase size={16} style={{ flexShrink: 0 }} />
              ) : (
                <GraduationCap size={16} style={{ flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                {passengerKind === 'staff'
                  ? (lang === 'hi' ? 'स्टाफ़ / शिक्षक' : 'Staff / Teacher')
                  : (lang === 'hi' ? 'विद्यार्थी' : 'Student')}
              </span>
              <ChevronDown
                size={16}
                style={{
                  flexShrink: 0,
                  transform: passengerMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {passengerMenuOpen && (
              <div
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.35rem',
                  zIndex: 60,
                  background: 'rgba(12, 30, 54, 0.82)',
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                  overflow: 'hidden',
                }}
              >
                {[
                  {
                    id: 'student',
                    icon: GraduationCap,
                    en: 'Student',
                    hi: 'विद्यार्थी',
                    hint: { en: 'Bus pass, attendance, complaints', hi: 'बस पास, उपस्थिति, शिकायतें' },
                  },
                  {
                    id: 'staff',
                    icon: Briefcase,
                    en: 'Staff / Teacher',
                    hi: 'स्टाफ़ / शिक्षक',
                    hint: { en: 'Employee ID for faculty and drivers', hi: 'faculty और drivers के लिए कर्मचारी आईडी' },
                  },
                ].map((opt) => {
                  const active = passengerKind === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setPassengerKind(opt.id);
                        setPassengerMenuOpen(false);
                        setUserId('');
                        setPassword('');
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem',
                        padding: '0.7rem 0.9rem',
                        background: active
                          ? 'rgba(255, 255, 255, 0.18)'
                          : 'transparent',
                        border: 'none',
                        borderLeft: active
                          ? '3px solid rgba(255, 255, 255, 0.85)'
                          : '3px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#ffffff',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <opt.icon
                        size={17}
                        color={active ? '#ffffff' : 'rgba(255,255,255,0.75)'}
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>
                          {lang === 'hi' ? opt.hi : opt.en}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.74rem', color: 'rgba(255,255,255,0.75)' }}>
                          {lang === 'hi' ? opt.hint.hi : opt.hint.en}
                        </span>
                      </span>
                      {active && <Check size={16} color="#ffffff" style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: '1rem' }}>
          <div className="animate-fade-in" key={loginType + 'id'}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'white' }}>
              {loginType === 'passenger'
                ? (passengerKind === 'staff' ? 'Employee ID' : t('passengerId'))
                : loginType === 'parent' ? 'Phone Number / Parent ID' : loginType === 'transport_incharge' ? t('transportInchargeId') : t('adminId')}
            </label>
            <div className="relative">
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)' }}>
                {loginType === 'parent' ? <Phone size={18} /> : loginType === 'passenger' && passengerKind === 'staff' ? <Briefcase size={18} /> : <User size={18} />}
              </div>
              <input
                type="text"
                placeholder={loginType === 'passenger'
                  ? (passengerKind === 'staff' ? 'e.g. T001' : t('enterPassengerId'))
                  : loginType === 'parent' ? 'Enter Phone Number or ID' : loginType === 'transport_incharge' ? t('enterTransportInchargeId') : t('enterAdminId')}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                style={{
                  width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s',
                  background: 'rgba(255,255,255,0.05)', color: 'white',
                }}
              />
            </div>
          </div>
 
          <div className="animate-fade-in" key={loginType + 'pass'}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'white' }}>{t('password')}</label>
            <div className="relative">
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t('enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '0.8rem 3.5rem 0.8rem 2.8rem',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s',
                  background: 'rgba(255,255,255,0.05)', color: 'white',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="animate-fade-in" style={{
              color: '#ff6b6b', backgroundColor: 'rgba(207,19,34,0.15)', padding: '0.75rem', borderRadius: '8px', 
              fontSize: '0.85rem', fontWeight: '500', marginTop: '0.5rem', textAlign: 'center', border: '1px solid rgba(255,99,99,0.3)'
            }}>
              {errorMessage}
            </div>
          )}

          <button type="submit" disabled={isLocked || isLoading} className={`btn hover-scale`} style={{
            marginTop: '0.5rem', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem',
            backgroundColor: (isLocked || isLoading) ? 'rgba(255,255,255,0.2)' : (loginType === 'admin' ? 'var(--secondary-orange)' : loginType === 'transport_incharge' ? '#28a745' : loginType === 'parent' ? '#9b59b6' : 'var(--primary-blue)'),
            color: 'white', border: 'none', cursor: (isLocked || isLoading) ? 'not-allowed' : 'pointer'
          }}>
            {isLocked ? t('locked') : (isLoading ? t('signingIn') : t('signIn'))}
            {!isLocked && !isLoading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

