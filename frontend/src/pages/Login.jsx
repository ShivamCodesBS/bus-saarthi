import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, User, Lock, ArrowRight, Shield, Car, Eye, EyeOff, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import '../index.css';

import axios from 'axios';
import { BACKEND_URL } from '../config';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, setLanguage } = useLang();
  const [loginType, setLoginType] = useState('passenger'); // 'passenger', 'admin', 'transport_incharge'
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setErrorMessage('');
    if (userId && password) {
      setIsLoading(true);
      try {
        const response = await axios.post(`${BACKEND_URL}/api/login`, {
          login_id: userId,
          password: password,
          role: loginType
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
        <img 
          src="/images/logo.png" 
          alt="Bus Saarthi" 
          style={{ height: '65px', maxHeight: '65px', objectFit: 'contain' }}
        />
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
        width: '100%', maxWidth: '400px', height: 'fit-content',
        borderRadius: '20px', zIndex: 2, margin: '100px 1rem 0 1rem',
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="flex flex-col items-center" style={{ marginBottom: '1.25rem' }}>
          <div style={{
            background: loginType === 'admin' ? 'var(--secondary-orange)' : loginType === 'transport_incharge' ? '#28a745' : 'var(--primary-blue)',
            padding: '0.75rem',
            borderRadius: '16px', marginBottom: '0.5rem',
            transition: 'background-color 0.3s'
          }}>
            {loginType === 'admin' ? <Shield size={24} color="white" /> : loginType === 'transport_incharge' ? <Car size={24} color="white" /> : <Bus size={24} color="white" />}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', margin: 0, lineHeight: 1.2 }}>{t('loginTitle')}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.9rem' }}>{t('loginSubtitle')}</p>
        </div>

        {/* Toggle Switch */}
        <div style={{
          display: 'flex', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '4px', marginBottom: '1.25rem'
        }}>
          {['passenger', 'transport_incharge', 'admin'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => { setLoginType(type); setUserId(''); setPassword(''); }}
              style={{
                flex: 1, padding: '0.6rem 0.25rem', borderRadius: '10px', border: 'none',
                backgroundColor: loginType === type ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: loginType === type ? 'white' : 'rgba(255,255,255,0.6)',
                fontWeight: loginType === type ? '600' : '500',
                fontSize: '0.85rem',
                boxShadow: loginType === type ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                cursor: 'pointer', transition: 'all 0.3s'
              }}
            >
              {t(type === 'transport_incharge' ? 'transportInchargeLogin' : type + 'Login')}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: '1rem' }}>
          <div className="animate-fade-in" key={loginType + 'id'}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'white' }}>
              {loginType === 'passenger' ? t('passengerId') : loginType === 'transport_incharge' ? t('transportInchargeId') : t('adminId')}
            </label>
            <div className="relative">
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.7)' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder={loginType === 'passenger' ? t('enterPassengerId') : loginType === 'transport_incharge' ? t('enterTransportInchargeId') : t('enterAdminId')}
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
                  width: '100%', padding: '0.8rem 2.8rem 0.8rem 2.8rem',
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
            backgroundColor: (isLocked || isLoading) ? 'rgba(255,255,255,0.2)' : (loginType === 'admin' ? 'var(--secondary-orange)' : loginType === 'transport_incharge' ? '#28a745' : 'var(--primary-blue)'),
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

