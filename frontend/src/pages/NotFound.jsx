import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import '../index.css';

const NotFound = () => {
  const { t } = useLang();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-dark)',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'var(--white)',
        padding: '3rem',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-lg)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <AlertTriangle size={64} color="var(--secondary-orange)" style={{ margin: '0 auto 1rem' }} />
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-blue)', marginBottom: '1rem' }}>
          404
        </h1>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>{t('pageNotFound')}</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
          {t('pageNotFoundDesc')}
        </p>
        <Link to="/" style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--primary-blue)',
          color: 'var(--white)',
          textDecoration: 'none',
          borderRadius: '12px',
          fontWeight: '600',
          transition: 'transform 0.2s'
        }}>
          {t('goBackHome')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
