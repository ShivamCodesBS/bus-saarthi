import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { Bus, Menu, MapPin, Phone, User, Maximize2, X, Compass, Activity, Navigation, Wind, AlertOctagon, Bell, AlarmClock, Users, Home as HomeIcon, Settings, LogOut, MessageSquare, GitMerge } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import HamburgerMenu from '../components/HamburgerMenu';
import WakeAlarmModal from '../components/WakeAlarmModal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import { BACKEND_URL, SOCKET_URL } from '../config';
import { useNavigate } from 'react-router-dom';

import '../index.css';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Bus Icon
const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [35, 35],
  iconAnchor: [17, 17],
});

// Component to handle map container resizing and CSS animations
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    // Invalidate size after delay to account for CSS transition-all duration-500
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 550);
    
    // Robust resize handling
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    const container = map.getContainer();
    if (container) ro.observe(container);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (container) ro.unobserve(container);
    };
  }, [map]);
  return null;
};

const STOP_COORDS = {
  // Bareilly Core
  'Civil Lines': [28.3615, 79.4180],
  'Rajendra Nagar': [28.3610, 79.4501],
  'DD Puram': [28.3715, 79.4452],
  'Pilibhit Bypass': [28.3842, 79.4310],
  'Invertis University': [28.3180, 79.4670],
  'labela chowk': [28.3500, 79.4200],
  'police line': [28.3550, 79.4250],
  'Chauki Chauraha': [28.3580, 79.4120],
  'Satellite Bus Stand': [28.3440, 79.4420],
  'Bareilly Mod': [28.2500, 79.5200],
  // Shahjahanpur Hubs
  'Shahjahanpur': [27.8805, 79.9140],
  'Shahjahanpur Bus Stand': [27.8820, 79.9100],
  'Roza Junction': [27.8350, 79.9200],
  'Tilhar': [28.0200, 79.7300],
  'Miranpur Katra': [28.1100, 79.6200],
  // Badaun Hubs
  'Badaun': [28.0300, 79.1200],
  'Badaun Road': [28.2000, 79.2800],
  'Ujhani': [28.0100, 79.0100],
  'Dataganj': [27.9400, 79.3500],
  // Pilibhit & Others
  'Pilibhit': [28.6300, 79.8000],
  'Bisalpur': [28.3000, 79.8000],
  'Nawabganj': [28.5400, 79.6300],
  'Faridpur': [28.2100, 79.5400],
};

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, lang, translateName } = useLang();

  const translateStatus = (status) => {
    if (!status) return '';
    const clean = status.trim().toLowerCase();
    if (lang === 'hi') {
      if (clean === 'low') return 'कम';
      if (clean === 'medium') return 'मध्यम';
      if (clean === 'high') return 'अधिक';
      if (clean === 'loading...') return 'लोड हो रहा है...';
    }
    return status;
  };

  const translateComfort = (comfort) => {
    if (!comfort) return '';
    const clean = comfort.trim().toLowerCase();
    if (lang === 'hi') {
      if (clean === 'smooth') return 'सुगम';
      if (clean === 'bumpy') return 'अस्थिर';
    }
    return comfort;
  };

  const getDirection = (heading) => {
    const dir = heading > 315 || heading <= 45 ? 'North' :
      heading > 45 && heading <= 135 ? 'East' :
      heading > 135 && heading <= 225 ? 'South' : 'West';
    return t(dir.toLowerCase());
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [alarmSet, setAlarmSet] = useState(() => localStorage.getItem('wake_alarm_enabled') === 'true');
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const alarmAudioRef = useRef(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosTimer, setSosTimer] = useState(null);

  const sosTimeoutRef = useRef(null);
  const sosIntervalRef = useRef(null);

  const [crowdStatus, setCrowdStatus] = useState({ filled: 0, total: 50, status: 'Loading...' });

  // Real Data State
  const [routeInfo, setRouteInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('passenger_seen_notif_ids') || '[]'); } 
    catch { return []; }
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Global Broadcast State
  const [notices, setNotices] = useState([]);
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  // Merge & Cancellation State (When student's bus is merged)
  const [mergeInfo, setMergeInfo] = useState(null);

  // Initial Bus Location (Example: Near Invertis University, Bareilly)
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);

  // Dynamic Effective Route ID: Switches instantly to newRouteId when merged
  const effectiveRouteId = mergeInfo?.newRouteId || user?.routeId || user?.route_id || '4';

  // Connect to Socket.IO for real-time telemetry updates and fetch initial status
  useEffect(() => {
    const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };

    // Check if student's home route is currently cancelled/merged today
    const checkMergeStatus = async () => {
      try {
        const homeRouteId = user?.routeId || user?.route_id || '4';
        const res = await axios.get(`${BACKEND_URL}/api/merge/check/${homeRouteId}`, authHeaders);
        if (res.data.status === 'success' && res.data.data?.isCancelled && res.data.data?.merge) {
          const m = res.data.data.merge;
          setMergeInfo({
            newRouteId: m.targetRouteId,
            newBusNumber: m.targetBusNumber,
            newRouteName: m.targetRouteName,
            reason: m.reason,
            cancelledBusNumber: m.cancelledBusNumber,
            cancelledRouteName: m.cancelledRouteName,
            message: `Your bus (${m.cancelledBusNumber || m.cancelledRouteId}) is cancelled today. Please board Bus ${m.targetBusNumber} (${m.targetRouteName}).`
          });
        } else {
          setMergeInfo(null);
        }
      } catch (err) {
        console.warn("Failed to check merge status");
      }
    };
    checkMergeStatus();

    // Fetch Crowd Status for the dynamically active bus
    const fetchCrowdStatus = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/route_status/${effectiveRouteId}`, authHeaders);
        if (res.data.status === 'success') {
          setCrowdStatus(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch crowd status");
      }
    };
    fetchCrowdStatus();
    
    // Add periodic polling every 30 seconds for crowd count
    const crowdInterval = setInterval(fetchCrowdStatus, 30000);

    // Fetch Route and Driver Info for the dynamically active bus
    const fetchRouteData = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/routes/${effectiveRouteId}`, authHeaders);
        if (res.data) {
          setRouteInfo(res.data);
          if (res.data.driver) {
            setDriverInfo(res.data.driver);
          } else {
            setDriverInfo(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch route data");
      }
    };
    fetchRouteData();

    // Fetch Notifications
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/notifications`, authHeaders);
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (data.length > 0) {
          setNotices(data);
        }
      } catch (err) {
        console.error("Failed to fetch notifications");
      }
    };
    fetchNotifications();

    // Socket.io connection for live data
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      const loginId = user?.loginId || user?.login_id;
      socket.emit('join_route', { route_id: effectiveRouteId, login_id: loginId });
    });

    let telemetryTimeout;

    // Listen for live telemetry data
    socket.on('live_telemetry', (data) => {
      if (data.route_id && String(data.route_id) !== String(effectiveRouteId)) return;
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
      }
      setTelemetry({
        speed: data.speed || 0,
        heading: data.heading || 0,
        comfort: data.comfort || 'Smooth',
        lastUpdated: new Date().toISOString()
      });

      if (telemetryTimeout) clearTimeout(telemetryTimeout);
      telemetryTimeout = setTimeout(() => {
        setTelemetry(null);
      }, 5000);
    });

    socket.on('live_attendance', () => {
       fetchCrowdStatus();
    });

    // Listen for real-time bus merge event
    socket.on('your_route_merged', (data) => {
      setMergeInfo(data);
      toast.error(`🚌 BUS MERGED: ${data.message}`, { duration: 10000 });
      if (data.newRouteId) {
        socket.emit('join_route', { route_id: data.newRouteId });
      }
    });

    // Listen for route restored event
    socket.on('route_restored', () => {
      setMergeInfo(null);
      toast.success('Your original bus route has been restored!', { duration: 6000 });
      const homeRouteId = user?.routeId || user?.route_id || '4';
      socket.emit('join_route', { route_id: homeRouteId });
    });

    // Listen for global emergency broadcasts
    socket.on('global_broadcast', (data) => {
      setActiveBroadcast(data);
    });

    // Listen for wake alarm trigger from server
    socket.on('wake_alarm_trigger', (data) => {
      toast(`🚌 Bus is ${data.distanceKm}km away! Get ready!`, {
        duration: 10000,
        icon: '⏰',
        style: { background: '#1d4ed8', color: 'white', fontWeight: 700, borderRadius: '12px' },
      });
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 1.5);
      } catch(e) { console.warn('Audio play failed', e); }
    });

    return () => {
      clearInterval(crowdInterval);
      if (telemetryTimeout) clearTimeout(telemetryTimeout);
      setTimeout(() => socket.disconnect(), 500);
    };
  }, [user, effectiveRouteId]);


  const acknowledgeBroadcast = () => {
    setActiveBroadcast(null);
  };

  const handleWakeAlarm = async () => {
    if (alarmSet) {
      // Cancel the alarm
      setAlarmLoading(true);
      try {
        const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
        await axios.delete(`${BACKEND_URL}/api/users/me/wake-alarm`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAlarmSet(false);
        localStorage.removeItem('wake_alarm_enabled');
        localStorage.removeItem('wake_alarm_data');
        toast.success('🔕 Wake alarm cancelled.', { style: { borderRadius: '10px' } });
      } catch (err) {
        toast.error('Failed to cancel alarm.');
      } finally {
        setAlarmLoading(false);
      }
    } else {
      // Open modal to set alarm
      setShowAlarmModal(true);
    }
  };

  const startSosCountdown = () => {
    let countdown = 5;
    setSosTimer(countdown);

    sosIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setSosTimer(countdown);
      if (countdown <= 0) {
        clearInterval(sosIntervalRef.current);
      }
    }, 1000);

    sosTimeoutRef.current = setTimeout(async () => {
      setSosTimer(null);
      setSosActive(true);
      
      // Call backend to trigger SOS (using /api/sos endpoint)
      try {
        await axios.post(`${BACKEND_URL}/api/sos/trigger`, {}, { headers: { Authorization: `Bearer ${user?.token}` } });
        toast.error("SOS Alert Triggered! Help is on the way.", { duration: 5000 });
      } catch (err) {
        toast.error("Failed to send SOS. Check connection.");
      }
    }, 5000);
  };

  const handleSosClick = async () => {
    if (sosTimer !== null) {
      clearTimeout(sosTimeoutRef.current);
      clearInterval(sosIntervalRef.current);
      setSosTimer(null);
      return;
    }

    if (sosActive) {
      if (!window.confirm("Do you want to cancel the active SOS alert?")) return;
      try {
        await axios.post(`${BACKEND_URL}/api/sos/cancel`, {
          passenger: user?.name || 'Anonymous',
          login_id: user?.loginId || user?.login_id || user?.id || 'Unknown',
          route: user?.routeId || user?.route_id || '4'
        }, { headers: { Authorization: `Bearer ${user?.token}` } });
        setSosActive(false);
        toast.success("SOS Alert Cancelled.");
      } catch (err) {
        toast.error("Failed to cancel SOS. Check connection.");
      }
      return;
    }

    startSosCountdown();
  };


  // Dynamic Route Polyline based on routeInfo
  const dynamicRoutePolyline = (() => {
    if (!routeInfo || !routeInfo.stops) {
      return [
        [28.3180, 79.4670],
        [28.3250, 79.4750],
        [28.3320, 79.4800],
        [28.3400, 79.4900],
      ];
    }
    const stopsArray = routeInfo.stops.split(',').map(s => s.trim());
    const coords = stopsArray.map(stop => STOP_COORDS[stop]).filter(Boolean);
    if (coords.length > 0) {
      // Add a default final destination if Invertis University isn't already the last stop
      if (stopsArray[stopsArray.length - 1] !== 'Invertis University') {
        coords.push(STOP_COORDS['Invertis University']);
      }
      return coords;
    }
    // Fallback if no valid coords found
    return [
      [28.3180, 79.4670],
      [28.3400, 79.4900],
    ];
  })();

  return (
    <div className="min-h-screen w-full flex flex-col bg-transparent text-slate-900 dark:text-slate-50 transition-colors duration-300">
      
      {/* HEADER */}
      <header className="flex justify-between items-center px-4 py-3 md:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 z-50 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-md shadow-blue-500/20">
            <Bus size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight leading-tight">
              INVERTIS <span className="text-orange-500">BUS<br className="block sm:hidden" /> SAARTHI</span>
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('welcome')}, {translateName(user?.name) || 'Passenger'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {/* PC NAVIGATION BAR */}
          <nav className="hidden lg:flex items-center gap-1 mr-2 pr-4 border-r border-slate-200 dark:border-slate-700">
            <Button onClick={() => navigate('/community')} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-md border-none transition-all hover:scale-[1.02] h-10 px-4">
              <Users className="mr-2" size={16} /> Bus Community
            </Button>
            
            <Button variant="ghost" onClick={() => navigate('/home')} className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 px-4">
              <HomeIcon className="mr-2" size={16} /> Home
            </Button>

            <Button variant="ghost" onClick={() => navigate('/profile')} className="h-10 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 px-4">
              <User className="mr-2" size={16} /> Profile
            </Button>

            <Button variant="ghost" onClick={() => navigate('/settings')} className="h-10 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 px-4">
              <Settings className="mr-2" size={16} /> Settings
            </Button>
          </nav>

          <div className="relative">
            {(() => {
              const allNotifications = [];
              if (activeBroadcast) {
                allNotifications.push({
                  id: 'broadcast-active',
                  type: 'broadcast',
                  title: activeBroadcast.title || 'Broadcast',
                  message: activeBroadcast.message,
                  time: 'Now',
                  icon: <Activity size={20} className="text-blue-500 shrink-0 mt-0.5" />,
                  bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50',
                  textTitle: 'text-blue-600 dark:text-blue-400',
                  textDesc: 'text-blue-500 dark:text-blue-300'
                });
              }
              if (sosActive) {
                allNotifications.push({
                  id: 'sos-active',
                  type: 'sos',
                  title: 'SOS Active',
                  message: 'Your SOS signal is being transmitted.',
                  time: 'Now',
                  icon: <AlertOctagon size={20} className="text-red-500 shrink-0 mt-0.5" />,
                  bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50',
                  textTitle: 'text-red-600 dark:text-red-400',
                  textDesc: 'text-red-500 dark:text-red-300'
                });
              }
              notices.forEach(notice => {
                allNotifications.push({
                  id: `notice-${notice.id || notice._id || Math.random()}`,
                  type: 'info',
                  title: notice.title || 'Admin Notice',
                  message: notice.message,
                  time: (notice.timestamp || notice.created_at) ? new Date(notice.timestamp || notice.created_at).toLocaleDateString() : 'Recent',
                  icon: <MessageSquare size={20} className="text-slate-500 shrink-0 mt-0.5" />,
                  bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                  textTitle: 'text-slate-700 dark:text-slate-300',
                  textDesc: 'text-slate-500 dark:text-slate-400'
                });
              });

              const currentIds = allNotifications.map(n => n.id);
              const hasNew = currentIds.some(id => !seenIds.includes(id));
              if (hasNew && !showNotifications && !hasUnread) {
                setTimeout(() => setHasUnread(true), 0);
              }

              return (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${hasUnread ? 'animate-bell-ring' : ''}`} 
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications) {
                        setHasUnread(false);
                        const newIds = allNotifications.map(n => n.id);
                        setSeenIds(newIds);
                        localStorage.setItem('passenger_seen_notif_ids', JSON.stringify(newIds));
                      }
                    }}
                  >
                    <Bell size={22} className={hasUnread ? "text-red-500" : "text-slate-700 dark:text-slate-300"} />
                    {hasUnread && (
                      <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                    )}
                  </Button>
                  {showNotifications && (
                    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 animate-fade-in">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white m-0">
                          {t('notifications')} {allNotifications.length > 0 && `(${allNotifications.length})`}
                        </h4>
                        <button onClick={() => setShowNotifications(false)} className="bg-transparent border-none cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                          <X size={18} className="text-slate-500 dark:text-slate-400" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto hide-scrollbar">
                    {allNotifications.length > 0 ? (
                      allNotifications.map(notification => (
                        <div key={notification.id} className={`p-3 border rounded-xl flex gap-3 items-start ${notification.bg}`}>
                          {notification.icon}
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <p className={`m-0 text-sm font-bold truncate ${notification.textTitle}`}>{notification.title}</p>
                              <span className={`text-[10px] whitespace-nowrap mt-0.5 ${notification.textDesc}`}>{notification.time}</span>
                            </div>
                            <p className={`m-0 text-xs mt-1 leading-relaxed ${notification.textDesc}`}>{notification.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="m-0 text-sm font-medium">{t('noNewUpdates')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </>
            );
          })()}
          </div>

          {/* PROFILE DROPDOWN (Desktop only) */}
          <div className="relative hidden lg:block">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="bg-transparent p-[2px] rounded-full cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center border-none shadow-sm hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)' }}
            >
              <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-2 border-transparent relative">
                {user?.profile_pic ? (
                  <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User size={18} className="text-blue-500" />}
                  </span>
                )}
              </div>
            </button>
            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-3 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-1">
                
                {/* User Info Header */}
                <div className="flex items-center gap-3 p-3 mb-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/40 dark:to-violet-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl flex-shrink-0 overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-sm">
                    {user?.profile_pic ? (
                      <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.name ? user.name.charAt(0).toUpperCase() : <User size={24} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{user?.name || 'Passenger User'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email || user?.login_id || 'passenger@invertis.edu'}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <Button variant="ghost" onClick={() => { logout(); navigate('/'); }} className="w-full justify-start h-11 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/30">
                    <LogOut className="mr-3" size={18} />
                    Log Out
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setIsMenuOpen(true)}>
            <Menu size={24} className="text-slate-700 dark:text-slate-300" />
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto w-full flex flex-col gap-8 scroll-smooth pb-24">
        
        {/* BUS MERGE & CANCELLATION NOTICE BANNER */}
        {mergeInfo && (
          <div className="p-5 rounded-3xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-xl shadow-orange-500/20 border-2 border-white/20 animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shrink-0">
                <GitMerge size={26} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white text-red-600 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Bus Changed Today</span>
                  <h3 className="font-bold text-base m-0">Board Bus {mergeInfo.newBusNumber} ({mergeInfo.newRouteName})</h3>
                </div>
                <p className="text-xs text-white/90 m-0 mt-1">
                  Your regular bus ({mergeInfo.cancelledBusNumber || 'assigned'}) was merged today. Your face recognition & attendance are eligible on <strong>Bus {mergeInfo.newBusNumber}</strong>.
                </p>
              </div>
            </div>
            <div className="bg-black/20 px-3.5 py-2 rounded-xl text-center shrink-0 w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-orange-200 block">Tracking Active</span>
              <span className="font-extrabold text-sm text-white">Route {mergeInfo.newRouteId}</span>
            </div>
          </div>
        )}

        {/* ACTION BAR (Floating / Sticky) */}
        <div className="flex gap-3 overflow-x-auto pb-2 flex-shrink-0 hide-scrollbar snap-x z-0">
          <Button
            variant={sosTimer !== null ? "default" : (sosActive ? "outline" : "destructive")}
            onClick={handleSosClick}
            className={`flex-1 min-w-[140px] h-12 md:h-14 rounded-2xl font-bold shadow-sm snap-center transition-all duration-300 ${sosTimer !== null ? 'bg-amber-500 hover:bg-amber-600 text-white' : (sosActive ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100' : 'bg-[#E52B36] hover:bg-red-700 text-white')}`}
          >
            <AlertOctagon size={18} className="mr-2" />
            {sosTimer !== null ? `${t('cancelCountdown')} (${sosTimer}s)` : (sosActive ? t('cancelSos') : t('emergency').toUpperCase())}
          </Button>

          <Button
            variant={alarmSet ? "default" : "outline"}
            onClick={handleWakeAlarm}
            disabled={alarmLoading}
            className={`flex-1 min-w-[140px] h-12 md:h-14 rounded-2xl font-bold shadow-sm snap-center transition-all duration-300 ${alarmSet ? 'bg-[#EEF6FF] text-[#1D63ED] border border-[#1D63ED] hover:bg-blue-100' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800'}`}
          >
            <AlarmClock size={18} className="mr-2" />
            {alarmLoading ? t('setting') : alarmSet ? t('alarmOn') : t('wakeAlarm')}
          </Button>
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 transition-all duration-500">
          
          {/* LEFT COLUMN: Info & Telemetry */}
          <div className={`${showMap ? 'lg:col-span-6 xl:col-span-5' : 'lg:col-span-8 lg:col-start-3 xl:col-span-6 xl:col-start-4'} flex flex-col gap-8 transition-all duration-500`}>
            
            {/* ROUTE DETAILS CARD */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 pb-5 px-6 pt-6">
                <CardTitle className="flex justify-between items-center text-lg font-bold text-blue-700 dark:text-blue-400">
                  {t('yourRouteDetails')}
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 border-none font-semibold px-3 py-1 text-sm">
                    {t('boardedStatus')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-6">
                
                {/* Crowd Predictor */}
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
                      <Users size={16} /> {t('liveCrowdStatus')}
                    </span>
                    <span className={`text-sm font-bold ${crowdStatus.status === 'Over Crowd' ? 'text-red-600 dark:text-red-400' : crowdStatus.status === 'Medium' ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
                      {crowdStatus.status === 'Over Crowd' ? 'Over Crowd' : translateStatus(crowdStatus.status)}
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center">
                    <div 
                      className={`absolute left-0 h-2 rounded-full transition-all duration-500 ${crowdStatus.status === 'Over Crowd' ? 'bg-red-500' : crowdStatus.status === 'Medium' ? 'bg-orange-500' : 'bg-green-500'}`} 
                      style={{ width: `${(crowdStatus.filled / crowdStatus.total) * 100}%` }}
                    ></div>
                    {crowdStatus.filled > 0 && (
                      <div 
                        className={`absolute w-3 h-3 rounded-full shadow-sm z-10 transition-all duration-500 ${crowdStatus.status === 'Over Crowd' ? 'bg-red-500' : crowdStatus.status === 'Medium' ? 'bg-orange-500' : 'bg-green-500'}`} 
                        style={{ left: `calc(${(crowdStatus.filled / crowdStatus.total) * 100}% - 6px)` }}
                      ></div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 m-0">
                    {crowdStatus.filled}/{crowdStatus.total} {t('seatsFilled')} • {crowdStatus.status === 'Over Crowd' ? t('likelyStanding') : t('seatsAvailable')}
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
                      <Bus size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 m-0">
                          {t('route')} {effectiveRouteId}
                        </p>
                        {mergeInfo && (
                          <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                            Active Merged Bus
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-slate-900 dark:text-white m-0 mt-0.5">
                        {routeInfo?.busNumber || routeInfo?.bus_number || 'Loading...'}
                        {routeInfo?.routeName && <span className="text-xs font-semibold text-slate-500 ml-1.5 font-normal">({routeInfo.routeName})</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-2xl text-orange-500 shrink-0">
                      <User size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 m-0">{t('driverName')}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white m-0 truncate">
                        {translateName(driverInfo?.name) || (routeInfo?.driver ? routeInfo.driver.name : t('assigning'))}
                      </p>
                      {(driverInfo?.phone || routeInfo?.driver?.phone) && (
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 m-0 mt-0.5">
                          {driverInfo?.phone || routeInfo?.driver?.phone}
                        </p>
                      )}
                    </div>
                    <a 
                      href={`tel:${driverInfo?.phone || routeInfo?.driver?.phone || '+919999999999'}`} 
                      className="ml-auto bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-3 rounded-full hover:bg-green-200 transition-colors shadow-sm shrink-0"
                      title="Call Active Bus Driver"
                    >
                      <Phone size={18} />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LIVE TELEMETRY CARD */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 pb-5 px-6 pt-6">
                <CardTitle className="flex justify-between items-center text-lg font-bold text-blue-700 dark:text-blue-400">
                  {t('liveSensors')}
                  <Badge variant="outline" className={`font-semibold px-3 py-1 text-sm ${telemetry ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'}`}>
                    {telemetry && <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>}
                    {telemetry ? t('sensorLive') : t('sensorOffline')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {telemetry ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex flex-col gap-2 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[13px] font-semibold capitalize tracking-wide">
                        <Activity size={16} className="text-blue-500" /> Speed
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {telemetry.speed.toFixed(1)} <span className="text-sm font-semibold text-slate-500">km/h</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex flex-col gap-2 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[13px] font-semibold capitalize tracking-wide">
                        <Compass size={16} className="text-orange-500" /> Direction
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                        <Navigation size={18} style={{ transform: `rotate(${telemetry.heading}deg)` }} className="text-slate-700 dark:text-slate-300 transition-transform duration-500" />
                        {getDirection(telemetry.heading)}
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 px-5 rounded-2xl col-span-2 flex justify-between items-center border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold capitalize tracking-wide">
                        <Wind size={18} className={telemetry.comfort === 'Smooth' ? 'text-green-500' : 'text-orange-500'} /> {t('rideComfort')}
                      </div>
                      <div className={`text-base font-bold ${telemetry.comfort === 'Smooth' ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                        {translateComfort(telemetry.comfort)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900/50 flex flex-col items-center gap-2">
                    <AlertOctagon size={32} className="text-red-500 mb-2 opacity-50" />
                    <p className="m-0 font-bold text-red-600 dark:text-red-400">{t('sensorsNotConnected')}</p>
                    <p className="m-0 text-sm text-red-500/70 dark:text-red-400/70">{t('waitingForHardware')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {!showMap && (
              <Button
                variant="secondary"
                onClick={() => setShowMap(true)}
                className="w-full h-14 rounded-2xl font-bold text-base shadow-md bg-[#FF6B00] hover:bg-[#e66000] text-white border-none"
              >
                <MapPin size={20} className="mr-2" />
                Open Live Map
              </Button>
            )}

            {/* TIMELINE */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
               <CardHeader className="pb-3 px-6 pt-6">
                 <CardTitle className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('upcomingStops')}</CardTitle>
               </CardHeader>
               <CardContent className="p-6 pt-2">
                 <div className="relative pl-6 flex flex-col gap-5 mt-2">
                   <div className="absolute left-2 top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>
                   
                   {(() => {
                      const stopsArray = routeInfo?.stops ? routeInfo.stops.split(',').map(s => s.trim()) : ['Civil Lines', 'Rajendra Nagar', 'DD Puram', 'Invertis University'];

                      const getDistance = (lat1, lon1, lat2, lon2) => {
                        const R = 6371;
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                  Math.sin(dLon/2) * Math.sin(dLon/2);
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                      };

                      const currentSpeedKmH = telemetry?.speed || 20;
                      
                      const stopData = stopsArray.map(stop => {
                        const coords = STOP_COORDS[stop] || [28.35, 79.45];
                        const distanceKm = getDistance(busLocation[0], busLocation[1], coords[0], coords[1]);
                        let etaMins = Math.round((distanceKm / (currentSpeedKmH < 5 ? 20 : currentSpeedKmH)) * 60);
                        if (etaMins < 1) etaMins = 1;
                        return { stop, distanceKm, etaMins };
                      });

                      let closestIdx = 0;
                      let minDistance = stopData[0].distanceKm;
                      for (let i = 1; i < stopData.length; i++) {
                        if (stopData[i].distanceKm < minDistance) {
                          minDistance = stopData[i].distanceKm;
                          closestIdx = i;
                        }
                      }

                      return stopData.map((data, idx, arr) => {
                        const isActive = idx === closestIdx;
                        const isPassed = idx < closestIdx;
                        
                        let etaText = isActive ? (data.etaMins <= 2 ? t('arrivingSoon') : `${data.etaMins} ${t('minsAway')}`) : `${data.etaMins} ${t('minsAway')}`;
                        if (isPassed) etaText = "Passed";
                        if (idx === arr.length - 1 && !isPassed) etaText += ` (${t('destination')})`;

                        return (
                          <div key={idx} className={`relative z-10 ${isPassed ? 'opacity-50' : 'opacity-100'}`}>
                            <div className={`absolute -left-[1.6rem] top-1.5 w-3 h-3 rounded-full border-[3px] ${isPassed ? 'border-green-500 bg-white' : (isActive ? 'border-[#FF6B00] bg-[#FF6B00] outline outline-[3px] outline-orange-200' : 'border-slate-300 bg-white')}`}></div>
                            <p className={`m-0 font-bold text-[15px] ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{data.stop}</p>
                            <p className={`m-0 text-[13px] mt-0.5 ${isActive ? 'font-bold text-[#FF6B00]' : 'text-slate-500'}`}>
                              {isPassed ? "Stop Passed" : etaText}
                            </p>
                          </div>
                        )
                      });
                   })()}
                 </div>
               </CardContent>
            </Card>

          </div>

          {/* RIGHT COLUMN: Real Leaflet Map */}
          <div className={`lg:col-span-6 xl:col-span-7 flex-col min-h-[450px] h-full ${showMap ? 'flex animate-in slide-in-from-right-8 fade-in duration-500' : 'hidden'}`}>
            <Card className="rounded-3xl border-4 border-blue-500/20 shadow-lg overflow-hidden flex-1 relative flex flex-col bg-slate-100 dark:bg-slate-800">
              <div className="bg-blue-600/95 backdrop-blur-md text-white p-3 px-5 flex justify-between items-center z-10 shrink-0">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <MapPin size={16} /> GPS Tracking: <span className="text-orange-200 font-medium">Live</span>
                </h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 rounded-full" onClick={() => setIsMapExpanded(true)} title="Expand Map">
                    <Maximize2 size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 rounded-full" onClick={() => setShowMap(false)} title="Close Map">
                    <X size={16} />
                  </Button>
                </div>
              </div>

              <div className="flex-1 relative z-0">
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <MapResizer />
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    attribution='&copy; Google Maps'
                  />
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup>
                      <b>Bus {routeInfo?.bus_number || 'UP 25 AB 1234'}</b><br />
                      Speed: {telemetry ? telemetry.speed.toFixed(0) : 0} km/h
                    </Popup>
                  </Marker>
                  <Polyline positions={dynamicRoutePolyline} color="#0056b3" weight={5} opacity={0.8} />
                  <Marker position={dynamicRoutePolyline[dynamicRoutePolyline.length - 1]}>
                    <Popup>Destination</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </Card>
          </div>

        </div>
        
        {/* FOOTER */}
        <div className="w-full text-center py-6 mt-auto">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400/80 m-0">
            © {new Date().getFullYear()} Invertis Innovation and Incubation.
          </p>
        </div>
      </main>

      {/* EXPANDED MAP MODAL */}
      {isMapExpanded && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col animate-in fade-in duration-200">
          <div className="p-4 md:px-6 flex justify-between items-center bg-blue-700 text-white shrink-0 shadow-md">
            <h2 className="font-bold flex items-center gap-2 text-lg">
              <MapPin size={20} /> Full Screen Tracking
            </h2>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setIsMapExpanded(false)}>
              <X size={24} />
            </Button>
          </div>
          <div className="flex-1 z-0 relative">
            <MapContainer center={busLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='&copy; Google Maps'
              />
              <Marker position={busLocation} icon={busIcon}>
                <Popup><b>Bus {routeInfo?.bus_number || 'UP 25 AB 1234'}</b><br />Speed: {telemetry ? telemetry.speed.toFixed(0) : 0} km/h</Popup>
              </Marker>
              <Polyline positions={dynamicRoutePolyline} color="#0056b3" weight={6} />
              <Marker position={dynamicRoutePolyline[dynamicRoutePolyline.length - 1]}>
                <Popup>Destination</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {/* GLOBAL BROADCAST POPUP */}
      {activeBroadcast && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-sm rounded-3xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300 bg-white dark:bg-slate-900">
            <div className="bg-red-50 dark:bg-red-950/30 p-6 flex flex-col items-center text-center border-b border-red-100 dark:border-red-900/30">
              <div className="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 p-4 rounded-full mb-4 ring-8 ring-red-50 dark:ring-red-950">
                <Bell size={40} className="animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{activeBroadcast.title || t('importantNotice')}</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {activeBroadcast.message}
              </p>
            </div>
            <div className="p-5 flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 text-center font-medium">
                {t('sentBy')}: {activeBroadcast.sender} • {new Date(activeBroadcast.timestamp).toLocaleTimeString()}
              </p>
              <Button onClick={acknowledgeBroadcast} size="lg" className="w-full rounded-2xl font-bold shadow-md h-12">
                {t('acknowledgeClose')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {showAlarmModal && (
        <WakeAlarmModal
          user={user}
          onClose={() => setShowAlarmModal(false)}
          onAlarmSet={(state) => setAlarmSet(state)}
        />
      )}
    </div>
  );
};

export default Home;
