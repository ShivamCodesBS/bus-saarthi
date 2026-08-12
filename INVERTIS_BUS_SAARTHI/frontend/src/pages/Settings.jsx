import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Moon, Sun, Shield, Globe, Camera, ChevronRight, LogOut, CheckCircle2, Lock, Eye, EyeOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';

// --- Toggle Switch Component ---
const Toggle = ({ value, onChange, color = 'var(--secondary-orange)' }) => (
  <div
    onClick={onChange}
    style={{
      width: '48px', height: '26px',
      backgroundColor: value ? color : '#ccc',
      borderRadius: '13px', position: 'relative',
      cursor: 'pointer', transition: 'background 0.3s',
      flexShrink: 0,
    }}
  >
    <div style={{
      width: '20px', height: '20px', backgroundColor: 'var(--card-bg)', borderRadius: '50%',
      position: 'absolute', top: '3px',
      left: value ? '25px' : '3px',
      transition: 'left 0.3s',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    }} />
  </div>
);

// --- Settings Row Component ---
const SettingRow = ({ icon, label, sublabel, rightEl, onClick, last }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', padding: '1rem 1.25rem',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.2s',
      backgroundColor: 'transparent',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.backgroundColor = 'rgba(0,86,179,0.04)'; }}
    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
  >
    <div style={{ marginRight: '1rem', flexShrink: 0 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)', fontSize: '0.95rem' }}>{label}</p>
      {sublabel && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '2px' }}>{sublabel}</p>}
    </div>
    {rightEl}
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang, setLanguage, t, translateName } = useLang();

  // Persist settings in localStorage
  const [pushNotifications, setPushNotifications] = useState(() => localStorage.getItem('pref_push') !== 'false');
  const [sosAlerts, setSosAlerts] = useState(() => localStorage.getItem('pref_sos') !== 'false');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pref_dark') === 'true');
  const [faceResetRequested, setFaceResetRequested] = useState(false);

  // Change Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // Language modal
  const [showLangModal, setShowLangModal] = useState(false);
  const languages = ['English', 'Hindi (हिंदी)', 'Urdu (اردو)', 'Bengali (বাংলা)'];

  // Apply dark mode to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pref_dark', darkMode);
  }, [darkMode]);

  const handleTogglePush = async () => {
    if (!pushNotifications) {
      // Request browser notification permission
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setPushNotifications(true);
          localStorage.setItem('pref_push', 'true');
          toast.success('Push notifications enabled!');
          new Notification('Bus Saarthi', { body: 'You will now receive bus alerts.', icon: '/vite.svg' });
        } else {
          toast.error('Notification permission denied. Allow it in browser settings.');
        }
      } else {
        toast.error('Your browser does not support notifications.');
      }
    } else {
      setPushNotifications(false);
      localStorage.setItem('pref_push', 'false');
      toast('Push notifications disabled.', { icon: '🔕' });
    }
  };

  const handleToggleSos = () => {
    const next = !sosAlerts;
    setSosAlerts(next);
    localStorage.setItem('pref_sos', next ? 'true' : 'false');
    toast(next ? 'SOS alerts enabled!' : 'SOS alerts disabled.', { icon: next ? '🚨' : '🔕' });
  };

  const handleToggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    toast(next ? 'Dark mode on!' : 'Light mode on!', { icon: next ? '🌙' : '☀️' });
  };

  const handleFaceReset = () => {
    setFaceResetRequested(true);
    toast.success('Request sent! Admin will contact you.');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      toast.error('New passwords do not match!');
      return;
    }
    if (newPass.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setPassLoading(true);
    try {
      const loginIdToUse = user?.loginId || user?.login_id || user?.id;
      await axios.put(`${BACKEND_URL}/api/users/${loginIdToUse}/password`, {
        old_password: oldPass,
        new_password: newPass,
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      toast.success('Password changed successfully!');
      setShowPasswordModal(false);
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password. Check old password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleSelectLanguage = (langName) => {
    const code = langName === 'Hindi (हिंदी)' ? 'hi' : 'en';
    setLanguage(code);
    setShowLangModal(false);
    toast.success(code === 'hi' ? 'भाषा हिंदी में बदल गई!' : `Language set to ${langName}`);
  };

  const handleLogout = () => {
    document.body.classList.remove('dark-mode');
    document.documentElement.classList.remove('dark');
    logout();
    navigate('/login', { replace: true });
  };

  const sectionStyle = {
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: 'var(--glass-bg)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border-color)',
  };

  return (
    <div className="min-h-screen" style={{ transition: 'background 0.3s' }}>
      {/* Header */}
      <header className="p-header sticky top-0 z-50" style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        backgroundColor: 'var(--primary-blue)', color: 'white',
        boxShadow: '0 2px 12px rgba(0,86,179,0.3)',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>{t('settings')}</h1>
      </header>

      <main className="p-main pb-24" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>

        <div style={{ ...sectionStyle, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user?.profile_pic ? (
            <img 
              src={user.profile_pic} 
              alt="Profile" 
              style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
            />
          ) : (
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              backgroundColor: 'var(--primary-blue)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: '1.4rem', flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: 'var(--text-dark)' }}>{translateName(user?.name) || 'Unknown User'}</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)', textTransform: 'capitalize' }}>
              {t(user?.role || 'passenger')} · {t('route')} {user?.routeId || user?.route_id || 'N/A'}
            </p>
          </div>
        </div>

        {/* Account Section */}
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', marginBottom: '0.6rem', marginLeft: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('account')}</p>
          <div style={sectionStyle}>
            <SettingRow
              icon={<Lock size={20} color="var(--primary-blue)" />}
              label={t('changePassword')}
              sublabel={t('updateLoginPassword')}
              rightEl={<ChevronRight size={18} color="var(--text-light)" />}
              onClick={() => setShowPasswordModal(true)}
            />
            <SettingRow
              icon={<Camera size={20} color={faceResetRequested ? '#28a745' : 'var(--primary-blue)'} />}
              label={faceResetRequested ? t('faceRescanRequested') : t('requestFaceDataReset')}
              sublabel={faceResetRequested ? t('adminWillContact') : t('ifFaceRecognitionFailing')}
              rightEl={faceResetRequested ? <CheckCircle2 size={20} color="#28a745" /> : <ChevronRight size={18} color="var(--text-light)" />}
              onClick={!faceResetRequested ? handleFaceReset : undefined}
              last
            />
          </div>
        </div>

        {/* Notifications Section */}
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', marginBottom: '0.6rem', marginLeft: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('notificationsSection')}</p>
          <div style={sectionStyle}>
            <SettingRow
              icon={<Bell size={20} color="var(--primary-blue)" />}
              label={t('pushNotifications')}
              sublabel={t('busArrivalAlerts')}
              rightEl={<Toggle value={pushNotifications} onChange={handleTogglePush} />}
            />
            <SettingRow
              icon={<Shield size={20} color="#cf1322" />}
              label={t('sosAlertsLabel')}
              sublabel={t('receiveSOSNotifs')}
              rightEl={<Toggle value={sosAlerts} onChange={handleToggleSos} color="#cf1322" />}
              last
            />
          </div>
        </div>

        {/* Appearance Section */}
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', marginBottom: '0.6rem', marginLeft: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('appearance')}</p>
          <div style={sectionStyle}>
            <SettingRow
              icon={darkMode ? <Moon size={20} color="var(--primary-blue)" /> : <Sun size={20} color="var(--secondary-orange)" />}
              label={t('darkMode')}
              sublabel={darkMode ? t('usingDarkTheme') : t('usingLightTheme')}
              rightEl={<Toggle value={darkMode} onChange={handleToggleDark} color="var(--primary-blue)" />}
            />
            <SettingRow
              icon={<Globe size={20} color="var(--primary-blue)" />}
              label={t('language')}
              sublabel={t('appDisplayLanguage')}
              rightEl={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: '600' }}>{lang === 'hi' ? 'हिंदी' : 'English'}</span>
                  <ChevronRight size={18} color="var(--text-light)" />
                </div>
              }
              onClick={() => setShowLangModal(true)}
              last
            />
          </div>
        </div>

        {/* App Info */}
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', marginBottom: '0.6rem', marginLeft: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('about')}</p>
          <div style={sectionStyle}>
            <SettingRow icon={<Shield size={20} color="var(--primary-blue)" />} label={t('appVersion')} rightEl={<span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>v1.0.0</span>} />
            <SettingRow icon={<Globe size={20} color="var(--primary-blue)" />} label={t('privacyPolicy')} rightEl={<ChevronRight size={18} color="var(--text-light)" />} onClick={() => toast('Privacy policy coming soon!')} last />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '1rem', backgroundColor: '#fff1f0', color: '#cf1322',
            border: '1px solid #ffa39e', borderRadius: '16px', fontWeight: '700', fontSize: '1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffe4e1'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff1f0'}
        >
          <LogOut size={20} /> {t('logout')}
        </button>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="p-glass" style={{ backgroundColor: 'var(--white)', borderRadius: '20px', width: '100%', maxWidth: '420px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-dark)' }}>{t('changePassword')}</h2>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="var(--text-light)" /></button>
            </div>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: t('oldPassword'), val: oldPass, set: setOldPass, show: showOld, toggle: () => setShowOld(!showOld) },
                { label: t('newPassword'), val: newPass, set: setNewPass, show: showNew, toggle: () => setShowNew(!showNew) },
                { label: t('confirmNewPassword'), val: confirmPass, set: setConfirmPass, show: showNew, toggle: () => setShowNew(!showNew) },
              ].map(({ label, val, set, show, toggle }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-light)', marginBottom: '0.4rem' }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      required
                      type={show ? 'text' : 'password'}
                      value={val}
                      onChange={e => set(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.9rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-dark)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={toggle} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', display: 'flex' }}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              ))}
              <button type="submit" disabled={passLoading} style={{ padding: '0.85rem', backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                {passLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {showLangModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="p-glass" style={{ backgroundColor: 'var(--white)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontWeight: '700', color: 'var(--text-dark)' }}>{t('selectLanguage')}</h3>
              <button onClick={() => setShowLangModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="var(--text-light)" /></button>
            </div>
             {languages.map(langName => {
               const isActive = (langName === 'Hindi (हिंदी)' && lang === 'hi') || (langName === 'English' && lang === 'en');
               return (
                 <div
                   key={langName}
                   onClick={() => handleSelectLanguage(langName)}
                   style={{
                     padding: '1rem', borderRadius: '12px', cursor: 'pointer',
                     backgroundColor: isActive ? 'rgba(0,86,179,0.08)' : 'transparent',
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     marginBottom: '0.25rem', transition: 'all 0.2s',
                   }}
                 >
                   <span style={{ fontWeight: isActive ? '700' : '500', color: isActive ? 'var(--primary-blue)' : 'var(--text-dark)' }}>{langName}</span>
                   {isActive && <CheckCircle2 size={18} color="var(--primary-blue)" />}
                 </div>
               );
             })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
