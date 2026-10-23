import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Bus, User, LogOut, Calendar, CheckCircle2,
  XCircle, Clock, TrendingUp, Phone, Navigation,
  Gauge, Compass, AlertOctagon, Menu, X, Activity, ChevronLeft, ChevronRight,
  IndianRupee, Megaphone, Settings, Eye, ArrowLeft, GitMerge,
  MessageSquareWarning, RotateCcw, Check, Wrench, Timer, ShieldAlert,
  Maximize2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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
import { friendlyError } from '../lib/errors';
import { StatCardSkeleton, ComplaintSkeleton } from '../components/ui/skeleton';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- Color constants ---
const PURPLE = '#7c3aed';
const PURPLE_LIGHT = '#f3e8ff';
const PURPLE_DARK = '#6d28d9';

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

// STOP_COORDS from Home page for route polyline
const STOP_COORDS = {
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
  'Shahjahanpur': [27.8805, 79.9140],
  'Shahjahanpur Bus Stand': [27.8820, 79.9100],
  'Roza Junction': [27.8350, 79.9200],
  'Tilhar': [28.0200, 79.7300],
  'Miranpur Katra': [28.1100, 79.6200],
  'Badaun': [28.0300, 79.1200],
  'Badaun Road': [28.2000, 79.2800],
  'Ujhani': [28.0100, 79.0100],
  'Dataganj': [27.9400, 79.3500],
  'Pilibhit': [28.6300, 79.8000],
  'Bisalpur': [28.3000, 79.8000],
  'Nawabganj': [28.5400, 79.6300],
  'Faridpur': [28.2100, 79.5400],
};

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
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Data states
  const [parentData, setParentData] = useState(null);
  const [child, setChild] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [speedData, setSpeedData] = useState(null);
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);
  const [childMergeInfo, setChildMergeInfo] = useState(null);
  const [childGrievances, setChildGrievances] = useState([]);
  const [grievanceBusy, setGrievanceBusy] = useState(new Set());
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Live tracking states
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryStale, setTelemetryStale] = useState(false);
  
  // Map instance ref for proper map control
  const mapInstance = useRef(null);
  
  // Dynamic Route Polyline based on routeInfo (same as student Home map)
  const dynamicRoutePolyline = useMemo(() => {
    if (!routeInfo || !routeInfo.stops) {
      return [
        [28.3180, 79.4670],
        [28.3250, 79.4750],
        [28.3320, 79.4800],
        [28.3400, 79.4900],
      ];
    }
    let stopsArray = [];
    if (Array.isArray(routeInfo.stops)) {
      stopsArray = routeInfo.stops;
    } else {
      try {
        const parsed = JSON.parse(routeInfo.stops);
        if (Array.isArray(parsed)) stopsArray = parsed;
        else stopsArray = String(routeInfo.stops).split(',').map((s) => s.trim());
      } catch {
        stopsArray = String(routeInfo.stops).split(',').map((s) => s.trim());
      }
    }

    const coords = stopsArray
      .map((s) => {
        const name = typeof s === 'object' && s !== null ? (s.name || s.stopName) : String(s).trim();
        return STOP_COORDS[name];
      })
      .filter(Boolean);

    if (coords.length > 0) {
      const lastStop = typeof stopsArray[stopsArray.length - 1] === 'object'
        ? (stopsArray[stopsArray.length - 1]?.name || '')
        : String(stopsArray[stopsArray.length - 1]).trim();
      if (lastStop !== 'Invertis University') {
        coords.push(STOP_COORDS['Invertis University']);
      }
      return coords;
    }

    return [
      [28.3180, 79.4670],
      [28.3400, 79.4900],
    ];
  }, [routeInfo]);

  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef(null);
  const staleTimerRef = useRef(null);

  // A shared headers object is a new reference on every render, which makes
  // the useCallback dependency lists permanently stale. A ref keeps one
  // stable object that always carries the current token.
  const authHeadersRef = useRef({ headers: {} });
  authHeadersRef.current = { headers: { Authorization: `Bearer ${user?.token}` } };
  const authHeaders = authHeadersRef.current;

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

        // Fetch route info & check for active merge
        if (c.routeId) {
          // Check if child's route is merged today
          let activeRouteId = c.routeId;
          try {
            const mRes = await axios.get(`${BACKEND_URL}/api/merge/check/${c.routeId}`, authHeaders);
            if (mRes.data?.status === 'success' && mRes.data.data?.isCancelled && mRes.data.data?.merge) {
              const m = mRes.data.data.merge;
              activeRouteId = m.targetRouteId;
              setChildMergeInfo({
                originalRouteId: c.routeId,
                activeRouteId: m.targetRouteId,
                targetBusNumber: m.targetBusNumber,
                targetRouteName: m.targetRouteName,
              });
            } else {
              setChildMergeInfo(null);
            }
          } catch (e) {
            console.warn('Merge check failed', e);
          }

          // Fetch route info for the active bus
          const routeRes = await axios.get(`${BACKEND_URL}/api/routes/${activeRouteId}`, authHeaders);
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

  /**
   * Grievances raised by any linked child. This is what lets a parent follow
   * up on their child's complaints and confirm or reject a fix.
   */
  const fetchChildGrievances = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/parents/grievances`, authHeaders);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setChildGrievances(data);
    } catch (err) {
      console.error('Failed to fetch child grievances', err);
    }
  }, [user?.token]);

  /** The parent confirms the transport team's fix — the complaint closes. */
  const handleConfirmGrievance = async (id) => {
    setGrievanceBusy((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/confirm`,
        {},
        authHeaders,
      );
      setChildGrievances((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: 'closed' } : g)),
      );
      toast.success('Thank you! The complaint is now closed.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not confirm the fix. Please try again.'));
    } finally {
      setGrievanceBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /**
   * The parent says the issue is still not fixed. The complaint is reopened
   * and moves back to the top of the transport team's queue.
   */
  const handleRejectGrievance = async (id) => {
    setGrievanceBusy((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/reopen`,
        { reason: rejectReason },
        authHeaders,
      );
      setChildGrievances((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                status: 'reopened',
                reopenCount: (g.reopenCount || 0) + 1,
                priority: (g.priority || 0) + 10,
              }
            : g,
        ),
      );
      setRejectingId(null);
      setRejectReason('');
      toast.success('Complaint reopened. It is now at the top of the queue.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not reopen the complaint. Please try again.'));
    } finally {
      setGrievanceBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

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
    fetchChildGrievances();
  }, [fetchAll, fetchBroadcasts, fetchChildGrievances]);

  useEffect(() => {
    const routeToTrack = childMergeInfo?.activeRouteId || child?.routeId;
    if (!routeToTrack) return;
    let socket;
    fetchTelemetry(routeToTrack).then(s => { socket = s; });
    return () => {
      clearTimeout(staleTimerRef.current);
      if (socket) socket.disconnect();
    };
  }, [child?.routeId, childMergeInfo]);

  useEffect(() => {
    const routeToAnalyze = childMergeInfo?.activeRouteId || child?.routeId;
    if (activeTab === 'analytics' && routeToAnalyze) {
      fetchSpeedAnalytics(routeToAnalyze, analyticsDate);
    }
  }, [activeTab, analyticsDate, child?.routeId, childMergeInfo]);

  // Mark leave for child
  const handleMarkLeave = async (date) => {
    if (!child) return;
    try {
      await axios.post(`${BACKEND_URL}/api/parents/child/${child.loginId}/leave`, { date }, authHeaders);
      toast.success(`Leave marked for ${date}`);
    } catch (err) {
      toast.error('We could not mark the leave. Please try again.');
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
        color: 'white', padding: '0 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '52px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 3px 14px rgba(139,92,246,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ height: '34px', padding: '3px 8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
            <img src="/logo.png" alt="Invertis University" style={{ height: '100%', width: 'auto', maxHeight: '26px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.3px' }}>Parent Dashboard</h1>
            <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.9 }}>Invertis Bus Saarthi · Guardian View</p>
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

      {/* ========= SIDE MENU (Mobile Only - Hamburger) ========= */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
          display: 'flex',
        }} onClick={() => setIsMenuOpen(false)}>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '240px',
            background: 'var(--card-bg)', boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
            padding: '1.5rem 1rem',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: PURPLE_LIGHT, margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={28} color={PURPLE} />
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)' }}>{parentData?.name || user?.name}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>Parent Account</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {[
                { icon: <Bus size={18} />, label: 'Overview', tab: 'overview' },
                { icon: <Calendar size={18} />, label: 'Attendance', tab: 'attendance' },
                { icon: <MessageSquareWarning size={18} />, label: 'Complaints', tab: 'complaints' },
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
            </div>
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
      {isLoading && !child ? (
        <div style={{
          background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
          padding: '0.85rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div className="animate-pulse" style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#e9ecef' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="animate-pulse" style={{ width: '140px', height: '16px', borderRadius: '4px', backgroundColor: '#e9ecef' }} />
            <div className="animate-pulse" style={{ width: '90px', height: '12px', borderRadius: '4px', backgroundColor: '#e9ecef' }} />
          </div>
          <div className="animate-pulse" style={{ width: '80px', height: '28px', borderRadius: '20px', backgroundColor: '#e9ecef' }} />
        </div>
      ) : child && (
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
              {child.gradeClass && `${child.gradeClass} · `}
              {childMergeInfo ? (
                <span>
                  Route {child.routeId} ➔ <strong style={{ color: '#ea580c' }}>Bus {childMergeInfo.targetBusNumber} ({childMergeInfo.targetRouteName})</strong>
                </span>
              ) : (
                <span>Route {child.routeId} {routeInfo?.busNumber && `· Bus ${routeInfo.busNumber}`}</span>
              )}
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

      {/* ========= TOP TABS (Desktop Only) ========= */}
      <div style={{
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
        display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
        '@media (max-width: 768px)': { display: 'none' }
      }}>
        {[
          { id: 'overview', icon: <Bus size={16} />, label: 'Overview' },
          { id: 'attendance', icon: <Calendar size={16} />, label: 'Attendance' },
          { id: 'complaints', icon: <MessageSquareWarning size={16} />, label: 'Complaints' },
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

            {/* Merge Notification Banner for Parents */}
            {childMergeInfo && (
              <div style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white', borderRadius: '16px', padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 4px 14px rgba(249,115,22,0.25)',
              }}>
                <GitMerge size={26} color="white" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                    🚌 Bus Route Changed Today
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', opacity: 0.95, lineHeight: 1.4 }}>
                    Your child's regular bus was merged into <strong>Bus {childMergeInfo.targetBusNumber} ({childMergeInfo.targetRouteName})</strong> today. Live tracking is automatically showing the active bus.
                  </p>
                </div>
              </div>
            )}

            {/* Today's Status Hero Card */}
            {isLoading && !child ? (
              <div className="glass p-6 rounded-2xl flex flex-col gap-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="animate-pulse" style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#e9ecef' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="animate-pulse" style={{ width: '180px', height: '18px', borderRadius: '4px', backgroundColor: '#e9ecef' }} />
                    <div className="animate-pulse" style={{ width: '120px', height: '12px', borderRadius: '4px', backgroundColor: '#e9ecef' }} />
                  </div>
                </div>
              </div>
            ) : (
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
            )}

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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    background: telemetryStale || !telemetry ? '#fff1f0' : '#e6fae6',
                    color: telemetryStale || !telemetry ? '#cf1322' : '#28a745',
                    padding: '2px 8px', borderRadius: '10px',
                  }}>
                    {telemetryStale || !telemetry ? '● No Signal' : '● Live'}
                  </span>
                  <button
                    onClick={() => setIsMapExpanded(true)}
                    style={{
                      background: PURPLE_LIGHT, border: `1px solid ${PURPLE}`, color: PURPLE,
                      padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                    title="Expand Map"
                  >
                    <Maximize2 size={14} /> Fullscreen
                  </button>
                </div>
              </div>
              <div style={{ height: '320px', position: 'relative' }}>
                <MapContainer 
                  center={busLocation} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }} 
                  zoomControl={true}
                  attributionControl={true}
                  scrollWheelZoom={true}
                  dragging={true}
                  whenCreated={(map) => { mapInstance.current = map; }}
                >
                  <MapResizer />
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    attribution='&copy; Google Maps'
                  />
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup>
                      <b>Bus {routeInfo?.busNumber || routeInfo?.bus_number || child?.routeId || 'UP 25 AB 1234'}</b><br />
                      Speed: {telemetry && !telemetryStale ? Math.round(telemetry.speed) : 0} km/h
                    </Popup>
                  </Marker>
                  <Polyline positions={dynamicRoutePolyline} color="#0056b3" weight={5} opacity={0.8} />
                  <Marker position={dynamicRoutePolyline[dynamicRoutePolyline.length - 1]}>
                    <Popup>Destination</Popup>
                  </Marker>
                </MapContainer>
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

        {/* ===== COMPLAINTS TAB ===== */}
        {activeTab === 'complaints' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.85rem' }}>
              {childGrievances.length} complaint{childGrievances.length === 1 ? '' : 's'} raised by your child
            </p>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[1, 2].map((i) => (
                  <ComplaintSkeleton key={i} style={{ opacity: 1 - i * 0.2 }} />
                ))}
              </div>
            ) : childGrievances.length === 0 ? (
              <div style={{
                background: 'var(--card-bg)', borderRadius: '20px', padding: '2.5rem',
                textAlign: 'center', border: '1px solid var(--border-color)',
              }}>
                <MessageSquareWarning size={40} color={PURPLE} style={{ opacity: 0.4 }} />
                <p style={{ margin: '0.75rem 0 0', color: 'var(--text-light)', fontWeight: 500 }}>
                  No complaints have been raised yet
                </p>
              </div>
            ) : null}

            {!isLoading && childGrievances.map((g) => {
              const meta = GRIEVANCE_STATUS[g.status] || GRIEVANCE_STATUS.pending;
              const { Icon } = meta;
              const busy = grievanceBusy.has(g.id);
              return (
                <div key={g.id} style={{
                  background: 'var(--card-bg)', borderRadius: '16px', padding: '1.1rem 1.25rem',
                  border: '1px solid var(--border-color)',
                  borderLeft: `4px solid ${meta.color}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                      <div style={{ background: meta.bg, borderRadius: '9px', padding: '6px', flexShrink: 0 }}>
                        <Icon size={15} color={meta.color} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
                          {g.childName || 'Your child'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-light)' }}>
                          #{String(g.id).substring(0, 6).toUpperCase()}
                          {g.category ? ` · ${g.category}` : ''}
                          {g.busNumber ? ` · Bus ${g.busNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: meta.bg, color: meta.color, fontWeight: 700,
                      fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px',
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      whiteSpace: 'nowrap',
                    }}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </div>

                  <p style={{ margin: 0, color: 'var(--text-dark)', fontSize: '0.9rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                    {g.text}
                  </p>

                  {/* Media Attachment */}
                  {g.type === 'photo' && g.mediaUrl && (
                    <div
                      style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center', cursor: 'zoom-in' }}
                    >
                      <img src={g.mediaUrl} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {g.type === 'video' && g.mediaUrl && (
                    <div
                      style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <video src={g.mediaUrl} controls style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {g.type === 'audio' && g.mediaUrl && (
                    <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                      <audio src={g.mediaUrl} controls style={{ width: '100%' }} />
                    </div>
                  )}

                  {g.adminResponse && (
                    <div style={{
                      marginTop: '0.7rem', padding: '0.7rem 0.9rem',
                      background: 'rgba(0,86,179,0.06)', borderLeft: '3px solid var(--primary-blue)',
                      borderRadius: '8px',
                    }}>
                      <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary-blue)', textTransform: 'uppercase' }}>
                        Response from the transport team
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                        {g.adminResponse}
                      </p>
                    </div>
                  )}

                  {g.reopenCount > 0 && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', fontWeight: 700, color: '#cf1322' }}>
                      Reopened {g.reopenCount} time{g.reopenCount === 1 ? '' : 's'} — still not resolved
                    </p>
                  )}

                  {/* The parent confirms or rejects the fix. */}
                  {g.status === 'resolved' && (
                    <div style={{ marginTop: '0.8rem' }}>
                      <p style={{ margin: '0 0 0.55rem', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        Has this been fixed? Your answer decides whether the complaint closes.
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleConfirmGrievance(g.id)}
                          disabled={busy}
                          style={{
                            background: '#28a745', color: 'white', border: 'none',
                            padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 700,
                            fontSize: '0.8rem', cursor: busy ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                          }}
                        >
                          <Check size={14} /> Yes, Fixed
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(rejectingId === g.id ? null : g.id);
                            setRejectReason('');
                          }}
                          disabled={busy}
                          style={{
                            background: '#cf1322', color: 'white', border: 'none',
                            padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 700,
                            fontSize: '0.8rem', cursor: busy ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                          }}
                        >
                          <RotateCcw size={14} /> Not Fixed Yet
                        </button>
                      </div>
                    </div>
                  )}

                  {rejectingId === g.id && (
                    <div style={{
                      marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                      padding: '0.9rem', background: 'rgba(207,19,34,0.05)',
                      borderRadius: '10px', border: '1px solid rgba(207,19,34,0.2)',
                    }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                        What is still not fixed?
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        placeholder="e.g. The bus was on time today but the AC was still not working."
                        style={{
                          width: '100%', padding: '0.7rem', borderRadius: '8px',
                          border: '1px solid var(--border-color)', fontSize: '0.9rem',
                          outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                          boxSizing: 'border-box', background: 'var(--card-bg)', color: 'var(--text-dark)',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          style={{
                            padding: '0.45rem 1rem', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'transparent',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-dark)',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectGrievance(g.id)}
                          disabled={busy}
                          style={{
                            padding: '0.45rem 1rem', borderRadius: '8px', border: 'none',
                            background: '#cf1322', color: 'white', cursor: busy ? 'default' : 'pointer',
                            fontWeight: 600, fontSize: '0.82rem',
                          }}
                        >
                          Reopen Complaint
                        </button>
                      </div>
                    </div>
                  )}

                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                    Raised {g.createdAt ? new Date(g.createdAt).toLocaleString('en-IN') : ''}
                    {g.resolvedAt && ` · Marked fixed ${new Date(g.resolvedAt).toLocaleString('en-IN')}`}
                  </p>
                </div>
              );
            })}
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

      {/* EXPANDED MAP MODAL */}
      {isMapExpanded && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col animate-in fade-in duration-200">
          <div className="p-4 md:px-6 flex justify-between items-center text-white shrink-0 shadow-md" style={{ background: PURPLE_DARK }}>
            <h2 className="font-bold flex items-center gap-2 text-lg m-0">
              <MapPin size={20} /> Full Screen Tracking — Route {child?.routeId || '—'} {routeInfo?.busNumber ? `(Bus ${routeInfo.busNumber})` : ''}
            </h2>
            <button
              onClick={() => setIsMapExpanded(false)}
              className="text-white hover:bg-white/20 p-2 rounded-full border-none bg-transparent cursor-pointer flex items-center justify-center transition-colors"
              title="Close Fullscreen"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 z-0 relative">
            <MapContainer center={busLocation} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={true} scrollWheelZoom={true} dragging={true}>
              <MapResizer />
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='&copy; Google Maps'
              />
              <Marker position={busLocation} icon={busIcon}>
                <Popup>
                  <b>Bus {routeInfo?.busNumber || routeInfo?.bus_number || child?.routeId || 'UP 25 AB 1234'}</b><br />
                  Speed: {telemetry && !telemetryStale ? Math.round(telemetry.speed) : 0} km/h
                </Popup>
              </Marker>
              <Polyline positions={dynamicRoutePolyline} color="#0056b3" weight={6} />
              <Marker position={dynamicRoutePolyline[dynamicRoutePolyline.length - 1]}>
                <Popup>Destination</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
