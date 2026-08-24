import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus } from 'lucide-react';
import '../index.css';

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, var(--primary-blue), #003366)',
      color: 'white'
    }}>
      <div className="animate-fade-in flex flex-col items-center text-center">
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          marginBottom: '1rem',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '4px solid var(--secondary-orange)'
        }}>
          <img src="/logo.png" alt="Invertis Bus Saarthi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=Bus+Saarthi&background=0056b3&color=fff&size=120'; }} />
        </div>
        <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }}>
          INVERTIS<br/><span style={{ color: 'var(--secondary-orange)', fontSize: '2rem' }}>BUS SAARTHI</span>
        </h1>
        <p style={{ color: '#e0e0e0', marginTop: '0.5rem', fontSize: '1.1rem' }}>Smart Transport System</p>
      </div>
    </div>
  );
};

export default Splash;
