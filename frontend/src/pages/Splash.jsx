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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden select-none"
      style={{
        background: 'radial-gradient(circle at center, #004b99 0%, #002244 100%)',
        color: 'white',
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute w-96 h-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />

      <div className="animate-fade-in flex flex-col items-center text-center z-10 max-w-sm">
        {/* Full Official Emblem Logo */}
        <div className="relative mb-6 transform hover:scale-105 transition-transform duration-500">
          <div className="w-56 h-56 md:w-64 md:h-64 flex items-center justify-center filter drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)]">
            <img
              src="/logo.png"
              alt="Invertis Bus Saarthi Official Logo"
              className="w-full h-full object-contain animate-in zoom-in-90 duration-700"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/favicon.png';
              }}
            />
          </div>
        </div>

        {/* Brand Caption & Status */}
        <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase drop-shadow-sm mb-1">
          Smart Transport System
        </h2>
        <p className="text-sm font-semibold text-orange-400 tracking-wider uppercase mb-8">
          Invertis University · Bareilly
        </p>

        {/* Smooth loading bar */}
        <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full w-full animate-[progress_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};

export default Splash;
