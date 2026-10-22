import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Login from './pages/Login';

/**
 * The tech-admin portal is an internal operations tool. It only needs the
 * system-operator endpoints, which the backend restricts to `tech_admin`
 * (see backend/src/health/health.controller.ts). `admin` is allowed too so
 * the campus administrator can reach the system views.
 */
const ALLOWED_ROLES = ['tech_admin', 'admin'];

function ProtectedRoute({ children, session }) {
  const location = useLocation();

  // While the stored token is being verified we must not redirect, or a
  // page refresh would bounce the user to the login screen before the
  // check had a chance to run.
  if (session.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-blue-600">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="font-semibold">Verifying access…</span>
        </div>
      </div>
    );
  }

  if (session.status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const [authToken, setAuthToken] = useState(() =>
    localStorage.getItem('tech_admin_token'),
  );
  const [session, setSession] = useState({ status: 'loading', user: null });

  /**
   * Verify the stored token against the backend instead of trusting
   * localStorage. Previously a stale or expired token kept the portal
   * "logged in" and every page failed with a confusing 401.
   */
  useEffect(() => {
    let cancelled = false;

    if (!authToken) {
      setSession({ status: 'anonymous', user: null });
      return;
    }

    const verify = async () => {
      try {
        const apiUrl =
          import.meta.env.VITE_API_URL || 'https://bus-saarthi-j3lq.onrender.com';
        const res = await fetch(`${apiUrl}/api/users/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!res.ok) throw new Error(`status ${res.status}`);

        const user = await res.json();
        if (cancelled) return;

        if (!ALLOWED_ROLES.includes(user.role)) {
          localStorage.removeItem('tech_admin_token');
          setAuthToken(null);
          setSession({ status: 'anonymous', user: null });
          return;
        }

        setSession({ status: 'authenticated', user });
      } catch {
        if (cancelled) return;
        localStorage.removeItem('tech_admin_token');
        setAuthToken(null);
        setSession({ status: 'anonymous', user: null });
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleLogout = () => {
    localStorage.removeItem('tech_admin_token');
    setAuthToken(null);
    setSession({ status: 'anonymous', user: null });
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          session.status === 'authenticated'
            ? <Navigate to="/" replace />
            : <Login setAuthToken={(t) => { setAuthToken(t); setSession({ status: 'loading', user: null }); }} />
        } />

        <Route path="/" element={
          <ProtectedRoute session={session}>
            <Layout setAuthToken={handleLogout} user={session.user} />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard authToken={authToken} />} />
          <Route path="logs" element={<Logs authToken={authToken} />} />
          <Route path="health" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
