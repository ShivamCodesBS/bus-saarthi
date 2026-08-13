import { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Splash from './pages/Splash';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Apply dark mode immediately from localStorage (before first render)
if (localStorage.getItem('pref_dark') === 'true') {
  document.body.classList.add('dark-mode');
  document.documentElement.classList.add('dark');
}

// Lazy loading pages for better performance
const Home = lazy(() => import('./pages/Home'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TransportInchargeDashboard = lazy(() => import('./pages/TransportInchargeDashboard'));
const Community = lazy(() => import('./pages/Community'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminSpeedAnalytics = lazy(() => import('./pages/AdminSpeedAnalytics'));
const Settings = lazy(() => import('./pages/Settings'));

// Limiter to prevent toast spam
const TOAST_LIMIT = 4;
function ToastLimiter() {
  const { toasts } = useToasterStore();
  
  useEffect(() => {
    toasts
      .filter((t) => t.visible) 
      .filter((_, i) => i >= TOAST_LIMIT) 
      .forEach((t) => toast.dismiss(t.id)); 
  }, [toasts]);

  return null;
}

import { GraduationCap, Bus, BookOpen, MapPin, Navigation, School, Compass } from 'lucide-react';

const FloatingIcons = ({ iconColor = 'text-[#FF6B00] dark:text-[#FF6B00]' }) => {
  const icons = [
    { Icon: Bus, size: 48, top: '10%', left: '15%', delay: '0s', duration: '15s' },
    { Icon: GraduationCap, size: 56, top: '20%', left: '75%', delay: '2s', duration: '18s' },
    { Icon: MapPin, size: 40, top: '70%', left: '10%', delay: '1s', duration: '20s' },
    { Icon: BookOpen, size: 50, top: '65%', left: '85%', delay: '4s', duration: '17s' },
    { Icon: Navigation, size: 44, top: '45%', left: '25%', delay: '3s', duration: '19s' },
    { Icon: School, size: 64, top: '40%', left: '80%', delay: '5s', duration: '22s' },
    { Icon: Compass, size: 48, top: '85%', left: '50%', delay: '2.5s', duration: '16s' },
    { Icon: Bus, size: 36, top: '35%', left: '5%', delay: '6s', duration: '25s' },
    { Icon: MapPin, size: 48, top: '15%', left: '45%', delay: '1.5s', duration: '14s' },
    { Icon: GraduationCap, size: 42, top: '80%', left: '30%', delay: '4.5s', duration: '21s' },
    { Icon: BookOpen, size: 38, top: '10%', left: '90%', delay: '0.5s', duration: '18s' },
    { Icon: School, size: 50, top: '55%', left: '95%', delay: '3.5s', duration: '19s' },
    { Icon: Navigation, size: 32, top: '90%', left: '75%', delay: '7s', duration: '15s' },
    { Icon: Compass, size: 54, top: '25%', left: '60%', delay: '5.5s', duration: '23s' },
    { Icon: Bus, size: 60, top: '75%', left: '65%', delay: '1s', duration: '17s' },
    // More extra icons (total 30)
    { Icon: GraduationCap, size: 34, top: '5%', left: '35%', delay: '1.2s', duration: '20s' },
    { Icon: BookOpen, size: 46, top: '50%', left: '12%', delay: '8s', duration: '24s' },
    { Icon: Navigation, size: 52, top: '12%', left: '55%', delay: '3.8s', duration: '18s' },
    { Icon: Bus, size: 44, top: '60%', left: '40%', delay: '2.2s', duration: '22s' },
    { Icon: School, size: 38, top: '88%', left: '15%', delay: '6.5s', duration: '16s' },
    { Icon: MapPin, size: 58, top: '30%', left: '88%', delay: '0.8s', duration: '19s' },
    { Icon: Compass, size: 40, top: '95%', left: '90%', delay: '4.2s', duration: '21s' },
    { Icon: BookOpen, size: 62, top: '78%', left: '5%', delay: '7.5s', duration: '26s' },
    { Icon: GraduationCap, size: 48, top: '48%', left: '68%', delay: '2.8s', duration: '17s' },
    { Icon: Bus, size: 50, top: '5%', left: '65%', delay: '5.1s', duration: '20s' },
    { Icon: MapPin, size: 36, top: '65%', left: '55%', delay: '9s', duration: '25s' },
    { Icon: Navigation, size: 42, top: '35%', left: '30%', delay: '1.8s', duration: '15s' },
    { Icon: School, size: 55, top: '82%', left: '45%', delay: '3.2s', duration: '22s' },
    { Icon: Compass, size: 35, top: '22%', left: '95%', delay: '6.8s', duration: '18s' },
    { Icon: Bus, size: 65, top: '45%', left: '2%', delay: '0.3s', duration: '28s' },
  ];

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {icons.map((item, idx) => {
        const { Icon, size, top, left, delay, duration } = item;
        return (
          <div
            key={idx}
            className={`absolute ${iconColor} opacity-10 dark:opacity-20 animate-float-icon`}
            style={{
              top, left,
              animationDelay: delay,
              animationDuration: duration,
              width: size, height: size
            }}
          >
            <Icon size={size} strokeWidth={1.5} />
          </div>
        );
      })}
    </div>
  );
};

// A component to redirect authenticated users away from Login page
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (user.role === 'transport_incharge') return <Navigate to="/transport-incharge-dashboard" replace />;
    return <Navigate to="/home" replace />;
  }
  return children;
};

const BackgroundManager = () => {
  const location = useLocation();
  const path = location.pathname;
  
  let dotClass = 'bg-dot-pattern';
  let iconColor = 'text-[#FF6B00] dark:text-[#FF6B00]';
  
  if (path.includes('transport-incharge')) {
    dotClass = 'bg-dot-pattern-green';
    iconColor = 'text-[#28a745] dark:text-[#28a745]';
  } else if (path.includes('home') || path.includes('community') || path.includes('profile') || path.includes('settings')) {
    dotClass = 'bg-dot-pattern-blue';
    iconColor = 'text-blue-500 dark:text-blue-500';
  }

  return (
    <>
      <div className={`fixed inset-0 z-[-1] pointer-events-none ${dotClass}`}></div>
      <FloatingIcons iconColor={iconColor} />
    </>
  );
};

function App() {
  // Initialize Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.15,
      smoothWheel: true,
      wheelMultiplier: 1.2,
      duration: 1.0,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="app-container relative">
            <BackgroundManager />
            <ToastLimiter />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fontSize: '0.9rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              },
              success: { style: { background: '#e6fae6', color: '#28a745' } },
              error: { style: { background: '#fff1f0', color: '#cf1322' } },
            }}
          />
          <Suspense fallback={<div className="h-screen flex items-center justify-center text-primary-blue font-bold">Loading...</div>}>
            <ErrorBoundary>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Splash />} />
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  } 
                />
                
                {/* Protected Routes */}
                <Route 
                  path="/home" 
                  element={
                    <ProtectedRoute allowedRoles={['passenger']}>
                      <Home />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin-dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/routes/:routeId/analytics" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminSpeedAnalytics />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/transport-incharge-dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['transport_incharge']}>
                      <TransportInchargeDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/community" 
                  element={
                    <ProtectedRoute>
                      <Community />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/settings" 
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } 
                />

                {/* 404 Catch All Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
