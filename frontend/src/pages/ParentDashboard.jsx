import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart, MapPin, Bus, User, LogOut, Bell, Calendar, CheckCircle2,
  XCircle, Clock, TrendingUp, BookOpen, Phone, Navigation,
  Gauge, Compass, AlertOctagon, Menu, X, Activity, ChevronLeft, ChevronRight,
  IndianRupee, Megaphone, Settings, Eye, ArrowLeft
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL, SOCKET_URL } from '../config';
import { io } from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import '../index.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

// -- Purple theme constants for Parent panel --
const PURPLE = '#8b5cf6';
const PURPLE_DARK = '#7c3aed';
const PURPLE_LIGHT = 'rgba(139,92,246,0.12)';

// Map auto-invalidate on resize
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 550);
    const ro = new ResizeObserver(() => map.invalidateSize());
    const container = map.getContainer();
    if (container) ro.observe(container);
    return () => { clearTimeout(t1); clearTimeout(t2); if (container) ro.unobserve(container); };
  }, [map]);
  return null;
};

// --- Stat Card ---
const StatCard = ({ icon, label, value, color, sub }) => (
  <div style={{
    background: 'var(--card-bg)', borderRadius: '16px', padding: '1.1rem 1.25rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s',
  }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    <div style={{ background: color + '1a', borderRadius: '12px', padding: '0.65rem', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-light)' }}>{sub}</p>}
    </div>
  </div>
);

// --- Fee Badge ---
const FeeBadge = ({ status }) => {
  const cfg = {
    paid: { bg: '#e6fae6', color: '#28a745', label: '✅ Fee Paid' },
    unpaid: { bg: '#fff1f0', color: '#cf1322', label: '❌ Fee Unpaid' },
    partial: { bg: '#fffbe6', color: '#d46b08', label: '⚠️ Partial Fee' },
  };
  const c = cfg[status] || cfg.unpaid;
  return (
    <span style={{
      background: c.bg, color: c.color, fontWeight: 700,
      fontSize: '0.82rem', padding: '4px 12px', borderRadius: '20px',
    }}>
      {c.label}
    </span>
  );
};

// --- Attendance Calendar (mini) ---
const AttendanceCalendar = ({ records }) => {
  const [calMonth, setCalMonth] = useState(new Date());

  const presentDays = new Set(
    records.map(r => new Date(r.timestamp).toDateString())
  );

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setCalMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalMonth(new Date(year, month + 1, 1));
  const isFuture = (d) => new Date(year, month, d) > today;
  const isPresent = (d) => presentDays.has(new Date(year, month, d).toDateString());
  const isToday = (d) => new Date(year, month, d).toDateString() === today.toDateString();

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button onClick={prevMonth} style={{ background: PURPLE_LIGHT, border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: PURPLE }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
          {calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextMonth} style={{ background: PURPLE_LIGHT, border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: PURPLE }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const present = isPresent(d);
          const future = isFuture(d);
          const todayCell = isToday(d);
          return (
            <div key={d} style={{
              textAlign: 'center', fontSize: '0.78rem', fontWeight: 600,
              padding: '5px 2px', borderRadius: '8px',
              background: todayCell ? PURPLE : present ? '#e6fae6' : future ? 'transparent' : '#fff1f0',
              color: todayCell ? 'white' : present ? '#28a745' : future ? 'var(--text-light)' : '#cf1322',
              border: todayCell ? `2px solid ${PURPLE_DARK}` : '1px solid var(--border-color)',
            }}>
              {d}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { bg: '#e6fae6', color: '#28a745', label: 'Present' },
          { bg: '#fff1f0', color: '#cf1322', label: 'Absent' },
          { bg: PURPLE, color: 'white', label: 'Today' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg, border: `1px solid ${l.color}` }} />
            <span style={{ color: 'var(--text-light)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Data states
  const [parentData, setParentData] = useState(null);
  const [child, setChild] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [speedData, setSpeedData] = useState(null);
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);

  // Live tracking states
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryStale, setTelemetryStale] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef(null);
  const staleTimerRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };

  // ---- Data fetching ----
  const fetchAll = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/parents/me`, authHeaders);
      setParentData(res.data.parent);
      const c = res.data.children?.[0];
      if (c) {
        setChild(c);

        // Fetch attendance
        const attRes = await axios.get(`${BACKEND_URL}/api/parents/child/${c.loginId}/attendance`, authHeaders);
        setAttendanceData(attRes.data);

        // Fetch route info
        if (c.routeId) {
          const routeRes = await axios.get(`${BACKEND_URL}/api/routes/${c.routeId}`, authHeaders);
          setRouteInfo(routeRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to load parent data', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.token]);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/notifications`, authHeaders);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setBroadcasts(data);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
    }
  }, [user?.token]);

  const fetchSpeedAnalytics = useCallback(async (routeId, date) => {
    if (!routeId) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/telemetry/history/${routeId}?date=${date}`, authHeaders);
      setSpeedData(res.data);
    } catch (err) {
      console.error('Speed analytics fetch failed', err);
      setSpeedData(null);
    }
  }, [user?.token]);

  // Polling for telemetry (every 3-5 seconds)
  const fetchTelemetry = useCallback(async (routeId) => {
    if (!routeId) return;
    try {
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnection: true });
      socket.on('connect', () => {
        socket.emit('join_route', { route_id: routeId });
      });
      socket.on('live_telemetry', (data) => {
        if (data.location?.lat && data.location?.lng) {
          setBusLocation([data.location.lat, data.location.lng]);
        }
        setTelemetry({
          speed: data.speed || 0,
          heading: data.heading || 0,
          comfort: data.comfort || 'Smooth',
          lastUpdated: new Date().toISOString(),
        });
        setTelemetryStale(false);
        // Mark stale after 5s of no update
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = setTimeout(() => setTelemetryStale(true), 5000);
      });
      return socket;
    } catch (err) {
      console.error('Telemetry error', err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchBroadcasts();
  }, [fetchAll, fetchBroadcasts]);

  useEffect(() => {
    if (!child?.routeId) return;
    let socket;
    fetchTelemetry(child.routeId).then(s => { socket = s; });
    return () => {
      clearTimeout(staleTimerRef.current);
      if (socket) socket.disconnect();
    };
  }, [child?.routeId]);

  useEffect(() => {
    if (activeTab === 'analytics' && child?.routeId) {
      fetchSpeedAnalytics(child.routeId, analyticsDate);
    }
  }, [activeTab, analyticsDate, child?.routeId]);

  // Mark leave for child
  const handleMarkLeave = async (date) => {
    if (!child) return;
    try {
      await axios.post(`${BACKEND_URL}/api/parents/child/${child.loginId}/leave`, { date }, authHeaders);
      toast.success(`Leave marked for ${date}`);
    } catch (err) {
      toast.error('Failed to mark leave');
    }
  };

  const getHeadingLabel = (deg) => {
    if (!deg && deg !== 0) return '—';
    if (deg > 315 || deg <= 45) return 'N ↑';
    if (deg > 45 && deg <= 135) return 'E →';
    if (deg > 135 && deg <= 225) return 'S ↓';
    return 'W ←';
  };

  const formatTime = (str) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // ---- Loading ----
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, border: `4px solid ${PURPLE_LIGHT}`, borderTop: `4px solid ${PURPLE}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: PURPLE, fontWeight: 600 }}>Loading Parent Dashboard...</p>
      </div>
    );
  }

  // ---- RENDER ----
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', fontFamily: 'Inter, sans-serif' }}>

      {/* ========= HEADER ========= */}
      <header style={{
        background: `linear-gradient(135deg, ${PURPLE_DARK} 0%, ${PURPLE} 100%)`,
        color: 'white', padding: '0 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '6px' }}>
            <Heart size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px' }}>Parent Dashboard</h1>
            <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.8 }}>Bus Saarthi · Guardian View</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'white' }}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ========= SIDE MENU ========= */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setIsMenuOpen(false)}>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '240px',
            background: 'var(--card-bg)', boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
            padding: '1.5rem 1rem',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: PURPLE_LIGHT, margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={28} color={PURPLE} />
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)' }}>{parentData?.name || user?.name}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>Parent Account</p>
            </div>
            {[
              { icon: <Bus size={18} />, label: 'Overview', tab: 'overview' },
              { icon: <Calendar size={18} />, label: 'Attendance', tab: 'attendance' },
              { icon: <Megaphone size={18} />, label: 'Announcements', tab: 'announcements' },
              { icon: <Activity size={18} />, label: 'Speed Analytics', tab: 'analytics' },
            ].map(item => (
              <button key={item.tab} onClick={() => { setActiveTab(item.tab); setIsMenuOpen(false); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: activeTab === item.tab ? PURPLE_LIGHT : 'transparent',
                color: activeTab === item.tab ? PURPLE : 'var(--text-dark)',
                fontWeight: activeTab === item.tab ? 700 : 500, fontSize: '0.9rem',
                marginBottom: '4px', textAlign: 'left',
              }}>
                {item.icon} {item.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1rem', paddingTop: '1rem' }}>
              <button onClick={() => { logout(); navigate('/login'); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: '#fff1f0', color: '#cf1322', fontWeight: 600, fontSize: '0.9rem',
              }}>
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= CHILD INFO BANNER ========= */}
      {child && (
        <div style={{
          background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
          padding: '0.85rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `linear-gradient(135deg, ${PURPLE_LIGHT}, ${PURPLE}33)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${PURPLE}40`, flexShrink: 0,
          }}>
            {child.profilePic
              ? <img src={child.profilePic} alt={child.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : <User size={24} color={PURPLE} />
            }
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '1rem' }}>{child.name}</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>
              {child.gradeClass && `${child.gradeClass} · `}Route {child.routeId}
              {routeInfo?.busNumber && ` · Bus ${routeInfo.busNumber}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <FeeBadge status={child.feeStatus} />
            <span style={{
              background: child.boardedToday ? '#e6fae6' : '#fff1f0',
              color: child.boardedToday ? '#28a745' : '#cf1322',
              fontWeight: 700, fontSize: '0.82rem', padding: '4px 12px', borderRadius: '20px',
            }}>
              {child.boardedToday ? `✅ Boarded ${formatTime(child.boardedAt)}` : '❌ Not Boarded Yet'}
            </span>
          </div>
        </div>
      )}

      {/* ========= TAB BAR ========= */}
      <div style={{
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
        display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {[
          { id: 'overview', icon: <Bus size={16} />, label: 'Overview' },
          { id: 'attendance', icon: <Calendar size={16} />, label: 'Attendance' },
          { id: 'announcements', icon: <Megaphone size={16} />, label: 'Notices' },
          { id: 'analytics', icon: <Activity size={16} />, label: 'Analytics' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0.85rem 1.25rem', border: 'none', cursor: 'pointer',
              background: 'transparent', fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.85rem', whiteSpace: 'nowrap',
              color: activeTab === tab.id ? PURPLE : 'var(--text-light)',
              borderBottom: activeTab === tab.id ? `3px solid ${PURPLE}` : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ========= CONTENT ========= */}
      <div style={{ padding: '1.25rem', maxWidth: '700px', margin: '0 auto' }}>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Today's Status Hero Card */}
            <div style={{
              background: child?.boardedToday
                ? 'linear-gradient(135deg, #e6fae6 0%, #d4edda 100%)'
                : 'linear-gradient(135deg, #fff1f0 0%, #ffe4e1 100%)',
              borderRadius: '20px', padding: '1.5rem',
              border: `2px solid ${child?.boardedToday ? '#28a74540' : '#cf132240'}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: child?.boardedToday ? '#28a745' : '#cf1322',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${child?.boardedToday ? '#28a74540' : '#cf132240'}`,
                }}>
                  {child?.boardedToday ? <CheckCircle2 size={30} color="white" /> : <XCircle size={30} color="white" />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: child?.boardedToday ? '#155724' : '#721c24' }}>
                    {child?.boardedToday ? 'Child Boarded the Bus' : 'Not Boarded Yet'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: child?.boardedToday ? '#28a745' : '#cf1322', marginTop: '2px' }}>
                    {child?.boardedToday
                      ? `Face recognized at ${formatTime(child.boardedAt)} today`
                      : 'Not marked present on the bus yet today'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <StatCard
                icon={<Calendar size={20} color={PURPLE} />}
                label="This Month"
                value={`${attendanceData?.attendancePercent ?? '—'}%`}
                sub={`${attendanceData?.monthlyAttendance ?? 0}/${attendanceData?.workingDays ?? 0} days`}
                color={PURPLE}
              />
              <StatCard
                icon={<IndianRupee size={20} color={child?.feeStatus === 'paid' ? '#28a745' : '#cf1322'} />}
                label="Fee Status"
                value={child?.feeStatus ? child.feeStatus.charAt(0).toUpperCase() + child.feeStatus.slice(1) : '—'}
                color={child?.feeStatus === 'paid' ? '#28a745' : '#cf1322'}
              />
              <StatCard
                icon={<Gauge size={20} color="#f97316" />}
                label="Bus Speed"
                value={telemetry && !telemetryStale ? `${Math.round(telemetry.speed)} km/h` : 'No Signal'}
                color="#f97316"
              />
              <StatCard
                icon={<Compass size={20} color="#06b6d4" />}
                label="Direction"
                value={telemetry && !telemetryStale ? getHeadingLabel(telemetry.heading) : '—'}
                color="#06b6d4"
              />
            </div>

            {/* Live Bus Map */}
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px',
              border: '1px solid var(--border-color)', overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color={PURPLE} />
                <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>Live Bus Location</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
                  background: telemetryStale || !telemetry ? '#fff1f0' : '#e6fae6',
                  color: telemetryStale || !telemetry ? '#cf1322' : '#28a745',
                  padding: '2px 8px', borderRadius: '10px',
                }}>
                  {telemetryStale || !telemetry ? '● No Signal' : '● Live'}
                </span>
              </div>
              <div style={{ height: '240px' }}>
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup>
                      🚌 Bus — Route {child?.routeId || '—'}
                      {routeInfo?.busNumber && <><br />Bus No: {routeInfo.busNumber}</>}
                      {telemetry && <><br />Speed: {Math.round(telemetry.speed)} km/h</>}
                    </Popup>
                  </Marker>
                  <MapResizer />
                </MapContainer>
              </div>
            </div>

            {/* Route & Driver Info */}
            {routeInfo && (
              <div style={{
                background: 'var(--card-bg)', borderRadius: '20px',
                border: '1px solid var(--border-color)', padding: '1.25rem',
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bus size={18} color={PURPLE} /> Route & Driver Info
                </h3>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {[
                    { label: 'Route', value: routeInfo.routeName },
                    { label: 'Bus Number', value: routeInfo.busNumber },
                    { label: 'Driver', value: routeInfo.driver?.name || '—' },
                    { label: 'Driver Phone', value: routeInfo.driver?.phone
                      ? <a href={`tel:${routeInfo.driver.phone}`} style={{ color: PURPLE, fontWeight: 700, textDecoration: 'none' }}>📞 {routeInfo.driver.phone}</a>
                      : '—'
                    },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>{row.value || '—'}</span>
                    </div>
                  ))}
                  {/* Stops */}
                  {routeInfo.stops && (() => {
                    let stops = [];
                    try { stops = typeof routeInfo.stops === 'string' ? JSON.parse(routeInfo.stops) : routeInfo.stops; } catch {}
                    return stops.length > 0 ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-light)', fontSize: '0.82rem', fontWeight: 500 }}>Stops</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {stops.map((s, i) => (
                            <span key={i} style={{ background: PURPLE_LIGHT, color: PURPLE, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                              {typeof s === 'object' ? s.name || JSON.stringify(s) : s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ATTENDANCE TAB ===== */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                { label: 'Present', value: attendanceData?.monthlyAttendance ?? 0, color: '#28a745', icon: '✅' },
                { label: 'Absent', value: (attendanceData?.workingDays ?? 0) - (attendanceData?.monthlyAttendance ?? 0), color: '#cf1322', icon: '❌' },
                { label: 'Attendance %', value: `${attendanceData?.attendancePercent ?? 0}%`, color: PURPLE, icon: '📊' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--card-bg)', borderRadius: '14px', padding: '1rem',
                  border: '1px solid var(--border-color)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                  <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 500 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Calendar */}
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px', padding: '1.25rem',
              border: '1px solid var(--border-color)', boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={18} color={PURPLE} /> Attendance Calendar
              </h3>
              <AttendanceCalendar records={attendanceData?.records || []} />
            </div>

            {/* Mark leave */}
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px', padding: '1.25rem',
              border: '1px solid var(--border-color)',
            }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>
                📝 Mark Leave for Child
              </h3>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                Notify the transport team about your child's planned absence
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  defaultValue={new Date().toISOString().split('T')[0]}
                  id="leave-date-input"
                  style={{
                    padding: '0.6rem 0.9rem', borderRadius: '10px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-color)',
                    color: 'var(--text-dark)', fontSize: '0.9rem', cursor: 'pointer',
                  }}
                />
                <button
                  onClick={() => handleMarkLeave(document.getElementById('leave-date-input')?.value)}
                  style={{
                    background: PURPLE, color: 'white', border: 'none',
                    padding: '0.6rem 1.25rem', borderRadius: '10px',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                    boxShadow: `0 4px 12px ${PURPLE}40`,
                  }}
                >
                  Mark Leave
                </button>
              </div>
            </div>

            {/* Recent attendance log */}
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px', padding: '1.25rem',
              border: '1px solid var(--border-color)',
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={18} color={PURPLE} /> Recent Attendance Log
              </h3>
              {(attendanceData?.records || []).slice(0, 15).map((r, i) => {
                const date = new Date(r.timestamp);
                return (
                  <div key={r.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0', borderBottom: i < 14 ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <CheckCircle2 size={16} color="#28a745" />
                      <span style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.88rem' }}>
                        {date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>
                      {formatTime(r.timestamp)}
                      {r.confidence && ` · ${Math.round(r.confidence * 100)}% confidence`}
                    </span>
                  </div>
                );
              })}
              {(!attendanceData?.records?.length) && (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.88rem', padding: '1rem 0' }}>
                  No attendance records yet
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== ANNOUNCEMENTS TAB ===== */}
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ margin: '0 0 0.25rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>
              {broadcasts.length} announcements from administration
            </p>
            {broadcasts.length === 0 && (
              <div style={{
                background: 'var(--card-bg)', borderRadius: '20px', padding: '2.5rem',
                textAlign: 'center', border: '1px solid var(--border-color)',
              }}>
                <Megaphone size={40} color={PURPLE} style={{ opacity: 0.4 }} />
                <p style={{ margin: '0.75rem 0 0', color: 'var(--text-light)', fontWeight: 500 }}>No announcements yet</p>
              </div>
            )}
            {broadcasts.map((b, i) => (
              <div key={b.id || i} style={{
                background: 'var(--card-bg)', borderRadius: '16px', padding: '1.1rem 1.25rem',
                border: `1px solid var(--border-color)`,
                borderLeft: `4px solid ${PURPLE}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ background: PURPLE_LIGHT, borderRadius: '10px', padding: '6px', flexShrink: 0 }}>
                    <Megaphone size={16} color={PURPLE} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {b.title && (
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.92rem' }}>
                        {b.title}
                      </p>
                    )}
                    <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.5 }}>{b.message}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                      {b.timestamp ? new Date(b.timestamp).toLocaleString('en-IN') : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== ANALYTICS TAB ===== */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px', padding: '1.25rem',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={18} color={PURPLE} /> Speed Analytics
                </h3>
                <input
                  type="date"
                  value={analyticsDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setAnalyticsDate(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '10px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-color)',
                    color: 'var(--text-dark)', fontSize: '0.85rem', cursor: 'pointer',
                  }}
                />
              </div>

              {/* Stats row */}
              {speedData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Max Speed', value: `${speedData.maxSpeed ?? '—'} km/h`, color: '#ef4444' },
                    { label: 'Avg Speed', value: `${speedData.avgSpeed ?? '—'} km/h`, color: PURPLE },
                    { label: 'Overspeeds', value: speedData.overspeedCount ?? 0, color: '#f97316' },
                  ].map(s => (
                    <div key={s.label} style={{
                      textAlign: 'center', background: 'var(--bg-color)',
                      borderRadius: '12px', padding: '0.75rem',
                    }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: s.color }}>{s.value}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 500 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              {speedData?.telemetry?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={speedData.telemetry} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 10, fill: 'var(--text-light)' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-light)' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', fontSize: '0.82rem', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(v) => [`${v} km/h`, 'Speed']}
                      labelFormatter={(l) => new Date(l).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    />
                    {speedData.speedLimit && (
                      <ReferenceLine y={speedData.speedLimit} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Limit ${speedData.speedLimit}`, fill: '#ef4444', fontSize: 10 }} />
                    )}
                    <Line type="monotone" dataKey="speed" stroke={PURPLE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-light)' }}>
                  <Activity size={36} style={{ opacity: 0.3 }} color={PURPLE} />
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem' }}>No telemetry data for {analyticsDate}</p>
                </div>
              )}
            </div>

            {/* Comfort & extra info */}
            {telemetry && (
              <div style={{
                background: 'var(--card-bg)', borderRadius: '20px', padding: '1.25rem',
                border: '1px solid var(--border-color)',
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>
                  🚌 Current Journey Status
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                  {[
                    { label: 'Live Speed', value: `${Math.round(telemetry.speed)} km/h`, icon: <Gauge size={16} color="#f97316" /> },
                    { label: 'Direction', value: getHeadingLabel(telemetry.heading), icon: <Navigation size={16} color="#06b6d4" /> },
                    { label: 'Comfort', value: telemetry.comfort || 'Smooth', icon: <TrendingUp size={16} color="#28a745" /> },
                    { label: 'Last Update', value: formatTime(telemetry.lastUpdated), icon: <Clock size={16} color={PURPLE} /> },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'var(--bg-color)', borderRadius: '12px', padding: '0.75rem 1rem',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                      {item.icon}
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-light)' }}>{item.label}</p>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
