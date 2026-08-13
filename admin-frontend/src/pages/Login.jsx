import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldAlert, Server, Activity, ArrowRight, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Login({ setAuthToken }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
      const res = await axios.post(`${apiUrl}/api/login`, {
        login_id: loginId,
        password: password,
      });

      if (res.data.status === 'success' && res.data.token) {
        // Must be TECH_ADMIN or ADMIN
        if (res.data.user?.role !== 'tech_admin' && res.data.user?.role !== 'admin') {
          throw new Error('Unauthorized role. Tech Admin access only.');
        }
        
        localStorage.setItem('tech_admin_token', res.data.token);
        setAuthToken(res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Floating Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-400/20 blur-[150px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-orange-400/10 blur-[100px]" />
        
        {/* Floating Icons */}
        <div className="absolute top-1/4 left-1/4 animate-bounce duration-[3000ms] opacity-20"><Server size={48} className="text-blue-500" /></div>
        <div className="absolute bottom-1/3 right-1/4 animate-pulse opacity-20"><Activity size={64} className="text-violet-500" /></div>
        <div className="absolute top-1/3 right-1/3 animate-bounce duration-[4000ms] opacity-10"><ShieldAlert size={56} className="text-orange-500" /></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden p-8">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl shadow-lg flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-center">Tech Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1 text-center font-medium">Bus Saarthi System Control</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-semibold p-3 rounded-xl border border-red-100 flex items-center">
                <ShieldAlert size={16} className="mr-2" />
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Admin ID</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
                placeholder="techadmin"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Secure Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
                placeholder="••••••••"
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center group"
            >
              {loading ? 'Authenticating...' : 'Secure Login'}
              {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

        </div>
        
        <div className="mt-6 text-center text-slate-500 text-sm font-medium flex items-center justify-center">
          <Bus size={14} className="mr-2 text-slate-400" /> Invertis Bus Saarthi © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
