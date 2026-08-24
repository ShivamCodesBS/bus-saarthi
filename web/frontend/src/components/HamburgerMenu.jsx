import { X, Users, Home, User, Settings, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import '../index.css';

const HamburgerMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = useLang();

  const isActive = (path) => location.pathname === path;

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)', zIndex: 40, transition: 'opacity 0.3s'
        }}
        onClick={onClose}
      />
      <div 
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '70%', maxWidth: '350px',
          zIndex: 50,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          display: 'flex', flexDirection: 'column'
        }}
        className="animate-slide-up glass"
      >
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border-color)' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}>
            <X size={28} />
          </button>
        </div>

        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <button 
            onClick={() => { onClose(); navigate('/community'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem', backgroundColor: 'var(--secondary-orange)',
              color: 'var(--white)', borderRadius: '12px', border: 'none',
              fontSize: '1.2rem', fontWeight: '600', cursor: 'pointer',
              boxShadow: '0 4px 14px 0 rgba(255, 102, 0, 0.3)',
              marginBottom: '1rem', transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Users size={24} />
            {t('busCommunity')}
          </button>

          {[
            { icon: Home, label: t('home'), path: '/home' },
            { icon: User, label: t('profile'), path: '/profile' },
            { icon: Settings, label: t('settings'), path: '/settings' },
          ].map((item, index) => (
            <button 
              key={index}
              onClick={() => { onClose(); navigate(item.path); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem', backgroundColor: isActive(item.path) ? 'var(--bg-color)' : 'transparent',
                color: isActive(item.path) ? 'var(--primary-blue)' : 'var(--text-dark)', borderRadius: '10px', border: 'none',
                fontSize: '1.05rem', fontWeight: isActive(item.path) ? '600' : '500', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-color)';
                  e.currentTarget.style.color = 'var(--primary-blue)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-dark)';
                }
              }}
            >
              <item.icon size={22} />
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
              onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem', width: '100%', backgroundColor: 'rgba(207, 19, 34, 0.1)',
              color: '#cf1322', borderRadius: '10px', border: 'none',
              fontSize: '1.05rem', fontWeight: '600', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={22} />
            {t('logout')}
          </button>
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
