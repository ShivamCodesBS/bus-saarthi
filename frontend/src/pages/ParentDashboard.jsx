import UserAvatar from '../components/UserAvatar';
import HamburgerMenu from '../components/HamburgerMenu';
import MediaViewer from '../components/MediaViewer';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Bus, User, LogOut, Calendar, CheckCircle2,
  XCircle, Clock, TrendingUp, Phone, Navigation,
  Gauge, Compass, AlertOctagon, Menu, X, Activity, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  IndianRupee, Megaphone, Settings, Eye, ArrowLeft, GitMerge,
  MessageSquareWarning, RotateCcw, Check, Wrench, Timer, ShieldAlert,
  AlertTriangle
} from 'lucide-react';
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
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate';
import { StatCardSkeleton, ComplaintSkeleton } from '../components/ui/skeleton';
import UnifiedMap from '../components/UnifiedMap';

// --- Broadcast priority detection helper ---
const getBroadcastMeta = (b) => {
  const text = `${b.title || ''} ${b.message || ''}`.toLowerCase();
  if (text.includes('urgent') || text.includes('emergency') || text.includes('alert') || text.includes('cancel')) {
    return {
      tag: '🚨 Urgent Alert',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeColor: '#dc2626',
    };
  }
  if (text.includes('route') || text.includes('bus') || text.includes('delay') || text.includes('traffic') || text.includes('diver')) {
    return {
      tag: '🚌 Route Update',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: '#f97316',
      badgeBg: 'rgba(249, 115, 22, 0.15)',
      badgeColor: '#ea580c',
    };
  }
  return {
    tag: '📢 Notice',
    bg: `${PURPLE}12`,
    border: PURPLE,
    badgeBg: PURPLE_LIGHT,
    badgeColor: PURPLE,
  };
};

// --- Grievance lifecycle states ---
const GRIEVANCE_STATUS = {
  pending:      { label: 'Pending',                   bg: 'rgba(239, 68, 68, 0.12)',  color: '#dc2626', Icon: AlertTriangle },
  in_progress:  { label: 'In Progress',               bg: 'rgba(249, 115, 22, 0.12)', color: '#ea580c', Icon: Wrench },
  resolved:     { label: 'Awaiting Confirmation',     bg: 'rgba(37, 99, 235, 0.12)',  color: '#2563eb', Icon: Timer },
  reopened:     { label: 'Not Resolved (Reopened)',   bg: 'rgba(239, 68, 68, 0.15)',  color: '#dc2626', Icon: RotateCcw },
  closed:       { label: 'Closed - Confirmed',        bg: 'rgba(34, 197, 94, 0.12)',  color: '#16a34a', Icon: CheckCircle2 },
};

// --- Color constants ---
const PURPLE = '#7c3aed';
const PURPLE_LIGHT = '#f3e8ff';
const PURPLE_DARK = '#6d28d9';

// --- Stat Card ---
const StatCard = ({ icon, label, value, color, sub, isMobile }) => (
  <div style={{
    background: 'var(--card-bg)', borderRadius: '16px',
    padding: isMobile ? '0.85rem 0.9rem' : '1.1rem 1.25rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', gap: isMobile ? '0.65rem' : '1rem',
    transition: 'transform 0.2s', minWidth: 0,
  }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    <div style={{ background: color + '1a', borderRadius: '12px', padding: isMobile ? '0.5rem' : '0.65rem', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ minWidth: 0, overflow: 'hidden' }}>
      <p style={{ margin: 0, fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-light)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
      <p style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>}
    </div>
  </div>
);

// --- Fee Badge ---
const FeeBadge = ({ status }) => {
  const cfg = {
    paid:    { bg: 'rgba(34, 197, 94, 0.14)',  color: '#16a34a', label: '✅ Fee Paid' },
    unpaid:  { bg: 'rgba(239, 68, 68, 0.14)',  color: '#dc2626', label: '❌ Fee Unpaid' },
    partial: { bg: 'rgba(249, 115, 22, 0.14)', color: '#ea580c', label: '⚠️ Partial Fee' },
  };
  const c = cfg[status] || cfg.unpaid;
  return (
    <span style={{
      background: c.bg, color: c.color, fontWeight: 700,
      fontSize: '0.82rem', padding: '4px 12px', borderRadius: '20px',
      border: `1px solid ${c.color}33`,
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
        <button onClick={prevMonth} style={{ background: 'rgba(124, 58, 237, 0.12)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: PURPLE }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
          {calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextMonth} style={{ background: 'rgba(124, 58, 237, 0.12)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: PURPLE }}>
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
          const isSunday = new Date(year, month, d).getDay() === 0;

          let cellBg = 'transparent';
          let cellColor = 'var(--text-light)';
          let cellBorder = '1px solid var(--border-color)';

          if (todayCell) {
            cellBg = PURPLE;
            cellColor = 'white';
            cellBorder = `2px solid ${PURPLE_DARK}`;
          } else if (present) {
            cellBg = 'rgba(34, 197, 94, 0.15)';
            cellColor = '#16a34a';
            cellBorder = '1px solid rgba(34, 197, 94, 0.35)';
          } else if (future) {
            cellBg = 'transparent';
            cellColor = 'var(--text-light)';
          } else if (isSunday) {
            cellBg = 'rgba(156, 163, 175, 0.12)';
            cellColor = 'var(--text-light)';
            cellBorder = '1px dashed var(--border-color)';
          } else {
            cellBg = 'rgba(239, 68, 68, 0.12)';
            cellColor = '#ef4444';
            cellBorder = '1px solid rgba(239, 68, 68, 0.25)';
          }

          return (
            <div key={d} style={{
              textAlign: 'center', fontSize: '0.78rem', fontWeight: 600,
              padding: '5px 2px', borderRadius: '8px',
              background: cellBg,
              color: cellColor,
              border: cellBorder,
            }}>
              {d}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { bg: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', label: 'Present' },
          { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Absent' },
          { bg: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-light)', label: 'Weekend / Off' },
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [isMapExpanded, setIsMapExpanded] = useState(true);

  // Responsive breakpoint: true if screen width < 768px (phone view)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data states with instant LocalStorage caching
  const [parentData, setParentData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_parent') || 'null'); } catch { return null; }
  });
  const [child, setChild] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_child') || 'null'); } catch { return null; }
  });
  const [children, setChildren] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_children') || '[]'); } catch { return []; }
  });
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('Sick / Medical Leave');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [attendanceData, setAttendanceData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_attendance') || 'null'); } catch { return null; }
  });
  const [routeInfo, setRouteInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_route') || 'null'); } catch { return null; }
  });
  const [broadcasts, setBroadcasts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_broadcasts') || '[]'); } catch { return []; }
  });
  const [speedData, setSpeedData] = useState(null);
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);
  const [childMergeInfo, setChildMergeInfo] = useState(null);
  const [childGrievances, setChildGrievances] = useState(() => {
    try { return JSON.parse(localStorage.getItem('parent_dashboard_grievances') || '[]'); } catch { return []; }
  });
  const [grievanceBusy, setGrievanceBusy] = useState(new Set());
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Live tracking states
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryStale, setTelemetryStale] = useState(false);

  // Last DB-recorded GPS fix for the child's route. While the bus is
  // offline the marker sits at the last place it was actually seen — the
  // same last-seen behaviour the student/admin/TI maps have.
  const routeToTrackNow = childMergeInfo?.activeRouteId || child?.routeId;
  const { data: lastKnownData } = useStaleWhileRevalidate(
    `/api/telemetry/last/${routeToTrackNow || ''}`,
    { cacheKey: `parent:last-loc:${routeToTrackNow || 'none'}`, staleTime: 15000, token: user?.token, skip: !routeToTrackNow },
  );
  const lastKnown = useMemo(() => {
    const d = lastKnownData?.data;
    if (!d?.lat || !d?.lng) return null;
    return { position: [d.lat, d.lng], timestamp: d.timestamp, speed: d.speed };
  }, [lastKnownData]);

  useEffect(() => {
    if (telemetryStale && lastKnown) {
      setBusLocation(lastKnown.position);
    }
  }, [telemetryStale, lastKnown]);
  
  // View locking & map controls (handled by UnifiedMap)
  const [autoFollow, setAutoFollow] = useState(true);
  

  const [isLoading, setIsLoading] = useState(() => {
    try {
      return !localStorage.getItem('parent_dashboard_parent');
    } catch {
      return true;
    }
  });
  const pollingRef = useRef(null);
  const staleTimerRef = useRef(null);

  // Fallback safety timeout so dashboard never hangs indefinitely on slow network
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 3500);
    return () => clearTimeout(t);
  }, []);

  // A shared headers object is a new reference on every render, which makes
  // the useCallback dependency lists permanently stale. A ref keeps one
  // stable object that always carries the current token.
  const authHeadersRef = useRef({ headers: {} });
  authHeadersRef.current = { headers: { Authorization: `Bearer ${user?.token}` } };
  const authHeaders = authHeadersRef.current;

  // ---- Child details loader (Runs in parallel with Promise.allSettled) ----
  const loadChildData = useCallback(async (c) => {
    if (!c) return;
    setChild(c);
    try {
      localStorage.setItem('parent_dashboard_child', JSON.stringify(c));
    } catch {}

    try {
      const [attResult, mergeResult, routeResult] = await Promise.allSettled([
        axios.get(`${BACKEND_URL}/api/parents/child/${c.loginId}/attendance`, authHeaders),
        c.routeId ? axios.get(`${BACKEND_URL}/api/merge/check/${c.routeId}`, authHeaders) : Promise.resolve(null),
        c.routeId ? axios.get(`${BACKEND_URL}/api/routes/${c.routeId}`, authHeaders) : Promise.resolve(null),
      ]);

      if (attResult.status === 'fulfilled' && attResult.value?.data) {
        setAttendanceData(attResult.value.data);
        try { localStorage.setItem('parent_dashboard_attendance', JSON.stringify(attResult.value.data)); } catch {}
      }

      let activeRouteId = c.routeId;
      if (mergeResult.status === 'fulfilled' && mergeResult.value?.data?.status === 'success' && mergeResult.value.data.data?.isCancelled && mergeResult.value.data.data?.merge) {
        const m = mergeResult.value.data.data.merge;
        activeRouteId = m.targetRouteId;
        setChildMergeInfo({
          originalRouteId: c.routeId,
          activeRouteId: m.targetRouteId,
          targetBusNumber: m.targetBusNumber,
          targetRouteName: m.targetRouteName,
        });
        try {
          const mergedRouteRes = await axios.get(`${BACKEND_URL}/api/routes/${m.targetRouteId}`, authHeaders);
          setRouteInfo(mergedRouteRes.data);
          try { localStorage.setItem('parent_dashboard_route', JSON.stringify(mergedRouteRes.data)); } catch {}
        } catch {}
      } else {
        setChildMergeInfo(null);
        if (routeResult.status === 'fulfilled' && routeResult.value?.data) {
          setRouteInfo(routeResult.value.data);
          try { localStorage.setItem('parent_dashboard_route', JSON.stringify(routeResult.value.data)); } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load child data', err);
    }
  }, [user?.token]);

  // ---- Data fetching (Non-blocking: unblocks UI immediately when parent data arrives) ----
  const fetchAll = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/parents/me`, authHeaders);
      const parent = res.data.parent;
      const kids = res.data.children || [];
      setParentData(parent);
      setChildren(kids);
      try {
        localStorage.setItem('parent_dashboard_parent', JSON.stringify(parent));
        localStorage.setItem('parent_dashboard_children', JSON.stringify(kids));
      } catch {}

      const currentKid = kids[selectedChildIndex] || kids[0];
      if (currentKid) {
        // Load child details asynchronously without keeping the whole dashboard waiting
        loadChildData(currentKid);
      }
    } catch (err) {
      console.error('Failed to load parent data', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.token, selectedChildIndex, loadChildData]);

  const handleSelectChild = (idx) => {
    setSelectedChildIndex(idx);
    if (children[idx]) {
      loadChildData(children[idx]);
    }
  };

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/notifications`, authHeaders);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setBroadcasts(data);
      try { localStorage.setItem('parent_dashboard_broadcasts', JSON.stringify(data)); } catch {}
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
      try { localStorage.setItem('parent_dashboard_grievances', JSON.stringify(data)); } catch {}
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
      // Refetch to ensure data is fresh
      await fetchChildGrievances();
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
      // Refetch to ensure data is fresh
      await fetchChildGrievances();
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

  // Live telemetry socket for the child's (possibly merged) route
  const connectTelemetry = useCallback((routeId, token) => {
    if (!routeId) return null;
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
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
  }, []);

  useEffect(() => {
    fetchAll();
    fetchBroadcasts();
    fetchChildGrievances();
  }, [fetchAll, fetchBroadcasts, fetchChildGrievances]);

  useEffect(() => {
    const routeToTrack = childMergeInfo?.activeRouteId || child?.routeId;
    if (!routeToTrack) return;
    const socket = connectTelemetry(routeToTrack, user?.token);
    return () => {
      clearTimeout(staleTimerRef.current);
      if (socket) socket.disconnect();
    };
  }, [child?.routeId, childMergeInfo, connectTelemetry, user?.token]);

  useEffect(() => {
    const routeToAnalyze = childMergeInfo?.activeRouteId || child?.routeId;
    if (activeTab === 'analytics' && routeToAnalyze) {
      fetchSpeedAnalytics(routeToAnalyze, analyticsDate);
    }
  }, [activeTab, analyticsDate, child?.routeId, childMergeInfo]);

  // Mark leave for child
  const handleMarkLeave = async () => {
    if (!child || !leaveDate) return;
    setIsSubmittingLeave(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/parents/child/${child.loginId}/leave`,
        { date: leaveDate, reason: leaveReason },
        authHeaders
      );
      toast.success(`Leave marked for ${leaveDate} (${leaveReason})`);
      await fetchAll();
    } catch (err) {
      toast.error('We could not mark the leave. Please try again.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const getHeadingLabel = (deg) => {
    if (deg == null || isNaN(deg)) return '—';
    let h = Number(deg) % 360;
    if (h < 0) h += 360;
    if (h >= 315 || h < 45) return 'N ↑';
    if (h >= 45 && h < 135) return 'E →';
    if (h >= 135 && h < 225) return 'S ↓';
    return 'W ←';
  };

  const formatTime = (str) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // ---- Loading (Only blocks if there is zero cached data to show) ----
  if (isLoading && !parentData && !child) {
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

      {/* ========= HEADER (Consistent with Home/Admin/TI panels) ========= */}
      <header
        className="px-3.5 py-2 md:px-6 md:py-2.5 flex justify-between items-center gap-2 z-50 sticky top-0"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8.5 md:h-10 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xs">
            <img src="/logo.png" alt="Invertis University" className="h-full w-auto max-h-7 md:max-h-8 object-contain filter drop-shadow-xs" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight m-0 truncate">
              Parent <span style={{ color: PURPLE }}>Portal</span>
            </h1>
            <p className="text-[11px] md:text-xs font-medium text-slate-500 dark:text-slate-400 m-0 truncate">
              Welcome, {user?.name || parentData?.name || 'Guardian'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* PROFILE DROPDOWN (Desktop only) */}
          <div className="relative hidden md:block" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="bg-transparent p-[2px] rounded-full cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center border-none shadow-sm hover:shadow-md"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #a855f7, #ec4899)` }}
              title="Account Menu"
            >
              <UserAvatar
                src={user?.profile_pic}
                name={user?.name || parentData?.name || 'Guardian'}
                size={36}
                className="border-2 border-transparent"
              />
            </button>

            {showProfileMenu && (
              <div
                className="absolute top-full right-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-1"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                {/* User Info Header */}
                <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <UserAvatar
                    src={user?.profile_pic}
                    name={user?.name || parentData?.name || 'Guardian'}
                    size={46}
                    className="ring-2 ring-white dark:ring-slate-800 shadow-sm"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">
                      {user?.name || parentData?.name || 'Parent / Guardian'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                      {user?.email || user?.phone || 'Guardian Account'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 border-none bg-transparent cursor-pointer flex items-center gap-3 transition-colors text-sm"
                >
                  <Settings size={18} style={{ color: PURPLE }} />
                  Settings & Preferences
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 border-none bg-transparent cursor-pointer flex items-center gap-3 transition-colors text-sm"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MOBILE HAMBURGER MENU BUTTON (Phone only) */}
          <button
            className="bg-transparent border border-slate-200 dark:border-slate-700 cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center md:hidden"
            onClick={() => setIsMenuOpen(true)}
            title="Open Menu"
          >
            <Menu size={22} className="text-slate-700 dark:text-slate-300" />
          </button>
        </div>
      </header>

            {/* ========= MULTI-CHILD SWITCHER ========= */}
      {children.length > 1 && (
        <div style={{
          background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
          padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '8px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-light)', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            Students:
          </span>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {children.map((ch, idx) => (
              <button
                key={ch.loginId || idx}
                onClick={() => handleSelectChild(idx)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: idx === selectedChildIndex ? `2px solid ${PURPLE}` : '1px solid var(--border-color)',
                  background: idx === selectedChildIndex ? 'rgba(124, 58, 237, 0.16)' : 'var(--bg-color)',
                  color: idx === selectedChildIndex ? PURPLE : 'var(--text-dark)',
                  fontWeight: idx === selectedChildIndex ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
              >
                <User size={13} /> {ch.name}
              </button>
            ))}
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
          <div className="animate-pulse" style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="animate-pulse" style={{ width: '140px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--border-color)' }} />
            <div className="animate-pulse" style={{ width: '90px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--border-color)' }} />
          </div>
          <div className="animate-pulse" style={{ width: '80px', height: '28px', borderRadius: '20px', backgroundColor: 'var(--border-color)' }} />
        </div>
      ) : child && (
        <div style={{
          background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)',
          padding: '0.85rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.25))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${PURPLE}40`, flexShrink: 0, overflow: 'hidden'
          }}>
            {child.profilePic ? (
              <img
                src={child.profilePic}
                alt={child.name}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }
                }}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : null}
            <span style={{ display: child.profilePic ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color={PURPLE} />
            </span>
          </div>
          <div style={{ flex: '1 1 180px', minWidth: '140px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <FeeBadge status={child.feeStatus} />
            <span style={{
              background: child.boardedToday ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
              color: child.boardedToday ? '#16a34a' : '#dc2626',
              border: child.boardedToday ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              fontWeight: 700, fontSize: '0.82rem', padding: '4px 12px', borderRadius: '20px',
            }}>
              {child.boardedToday ? `✅ Boarded ${formatTime(child.boardedAt)}` : '❌ Not Boarded Yet'}
            </span>
          </div>
        </div>
      )}

      {/* ========= TOP TABS (Desktop Only - Not rendered on phone) ========= */}
      {!isMobile && (
        <div
          style={{
            background: 'var(--card-bg)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'overview', icon: <Bus size={16} />, label: 'Overview' },
            { id: 'attendance', icon: <Calendar size={16} />, label: 'Attendance' },
            { id: 'complaints', icon: <MessageSquareWarning size={16} />, label: 'Complaints' },
            { id: 'announcements', icon: <Megaphone size={16} />, label: 'Notices' },
            { id: 'analytics', icon: <Activity size={16} />, label: 'Analytics' },
            { id: 'settings', icon: <Settings size={16} />, label: 'Settings', isNav: true },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.isNav) {
                  navigate('/settings');
                } else {
                  setActiveTab(tab.id);
                }
              }}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.85rem 1.25rem',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                color: activeTab === tab.id ? PURPLE : 'var(--text-light)',
                borderBottom: activeTab === tab.id ? `3px solid ${PURPLE}` : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ========= CONTENT ========= */}
      <div
        style={{
          padding: isMobile ? '1rem 1rem 100px 1rem' : '1.25rem 1.25rem 2.5rem 1.25rem',
          maxWidth: '750px',
          margin: '0 auto',
        }}
      >

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
                  <div className="animate-pulse" style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="animate-pulse" style={{ width: '180px', height: '18px', borderRadius: '4px', backgroundColor: 'var(--border-color)' }} />
                    <div className="animate-pulse" style={{ width: '120px', height: '12px', borderRadius: '4px', backgroundColor: 'var(--border-color)' }} />
                  </div>
                </div>
              </div>
            ) : (() => {
              const isSunday = new Date().getDay() === 0;
              if (child?.boardedToday) {
                return (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.22) 100%)',
                    borderRadius: '20px', padding: '1.25rem 1.5rem',
                    border: '2px solid rgba(34,197,94,0.4)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: '#16a34a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(22,163,74,0.4)', flexShrink: 0,
                      }}>
                        <CheckCircle2 size={28} color="white" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-dark)' }}>
                          Child Boarded the Bus
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                          Face recognized at {formatTime(child.boardedAt)} today
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (isSunday) {
                return (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(59,130,246,0.08) 100%)',
                    borderRadius: '20px', padding: '1.25rem 1.5rem',
                    border: '2px solid rgba(124,58,237,0.25)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: PURPLE,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 12px ${PURPLE}40`, flexShrink: 0,
                      }}>
                        <Calendar size={26} color="white" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.08rem', color: 'var(--text-dark)' }}>
                          Weekend — No Scheduled Bus Today
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                          It's Sunday! Regular campus transit service resumes Monday morning.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.18) 100%)',
                  borderRadius: '20px', padding: '1.25rem 1.5rem',
                  border: '2px solid rgba(239,68,68,0.35)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: '#ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(239,68,68,0.35)', flexShrink: 0,
                    }}>
                      <XCircle size={28} color="white" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-dark)' }}>
                        Not Boarded Yet
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>
                        Not marked present on the bus yet today
                      </p>
                    </div>
                  </div>
                </div>
              );
            })() }

            {/* Route & Driver Info - UP FRONT for quick access */}
            {(routeInfo || child?.routeId) && (
              <div style={{
                background: 'var(--card-bg)', borderRadius: '20px',
                border: '1px solid var(--border-color)', padding: '1.25rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'column', gap: '0.9rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: PURPLE_LIGHT, borderRadius: '10px', padding: '6px', color: PURPLE, display: 'flex' }}>
                      <Bus size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-dark)', fontSize: '1rem' }}>
                        {childMergeInfo ? `Bus ${childMergeInfo.targetBusNumber}` : (routeInfo?.busNumber ? `Bus ${routeInfo.busNumber}` : `Route ${child?.routeId}`)}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-light)', fontWeight: 500 }}>
                        {childMergeInfo?.targetRouteName || routeInfo?.routeName || 'Assigned Transit Route'}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    background: telemetry && !telemetryStale ? '#e6fae6' : '#f3f4f6',
                    color: telemetry && !telemetryStale ? '#16a34a' : '#6b7280',
                    fontWeight: 700, fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px',
                    display: 'inline-flex', alignItems: 'center', gap: '5px'
                  }}>
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: telemetry && !telemetryStale ? '#16a34a' : '#9ca3af',
                    }} />
                    {telemetry && !telemetryStale ? 'Active on Route' : 'Standby / Offline'}
                  </span>
                </div>

                {/* Driver Contact Section */}
                <div style={{
                  background: 'var(--bg-color)',
                  borderRadius: '14px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${PURPLE_LIGHT}, ${PURPLE}33)`,
                      color: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                      border: `1.5px solid ${PURPLE}40`,
                    }}>
                      <User size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Assigned Driver
                      </p>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                        {routeInfo?.driver?.name || 'Assigned Driver'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-light)' }}>
                        {routeInfo?.driver?.phone || 'Contact via Transport Office'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {routeInfo?.driver?.phone ? (
                      <a
                        href={`tel:${routeInfo.driver.phone}`}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          color: 'white',
                          textDecoration: 'none',
                          padding: '8px 14px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 3px 10px rgba(22,163,74,0.25)',
                          transition: 'transform 0.15s',
                        }}
                      >
                        <Phone size={13} /> Call Driver
                      </a>
                    ) : null}

                    <a
                      href="tel:+915812460442"
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '8px 14px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 3px 10px rgba(37,99,235,0.25)',
                        transition: 'transform 0.15s',
                      }}
                      title="Transport In-charge Helpdesk"
                    >
                      <Phone size={13} /> Transport Desk
                    </a>
                  </div>
                </div>

                {/* Stops */}
                {routeInfo?.stops && (() => {
                  let stops = [];
                  try { stops = typeof routeInfo.stops === 'string' ? JSON.parse(routeInfo.stops) : routeInfo.stops; } catch {}
                  return Array.isArray(stops) && stops.length > 0 ? (
                    <div style={{ marginTop: '0.2rem' }}>
                      <p style={{ margin: '0 0 0.4rem 0', color: 'var(--text-light)', fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Route Stops ({stops.length})
                      </p>
                      <div
                        className="hide-scrollbar"
                        style={{
                          display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '85px',
                          overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none'
                        }}
                      >
                        {stops.map((s, i) => {
                          const stopTitle = typeof s === 'object' && s !== null
                            ? (s.name || s.stopName || s.stop_name || s.title || `Stop ${i + 1}`)
                            : String(s);
                          return (
                            <span
                              key={i}
                              style={{
                                background: 'rgba(124, 58, 237, 0.12)',
                                color: PURPLE, fontSize: '0.74rem', padding: '3px 9px',
                                borderRadius: '10px', fontWeight: 600
                              }}
                            >
                              {i + 1}. {stopTitle}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Live Bus Map (Collapsible) */}
            <div style={{
              background: 'var(--card-bg)', borderRadius: '20px',
              border: '1px solid var(--border-color)', overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            }}>
              <div style={{
                padding: '0.9rem 1.25rem',
                borderBottom: isMapExpanded ? '1px solid var(--border-color)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} color={PURPLE} />
                  <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>Live Bus Location</span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: telemetry && !telemetryStale ? '#e6fae6' : '#f3f4f6',
                    color: telemetry && !telemetryStale ? '#16a34a' : '#6b7280',
                  }}>
                    {telemetry && !telemetryStale ? '● LIVE' : '○ OFFLINE'}
                  </span>
                </div>
                <button
                  onClick={() => setIsMapExpanded(prev => !prev)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: PURPLE,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                  }}
                  title={isMapExpanded ? 'Collapse Map' : 'Expand Map'}
                >
                  {isMapExpanded ? (
                    <>Hide Map <ChevronUp size={14} /></>
                  ) : (
                    <>Show Map <ChevronDown size={14} /></>
                  )}
                </button>
              </div>

              {!isMapExpanded ? (
                <div style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  background: 'var(--bg-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '10px',
                      background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: PURPLE, flexShrink: 0
                    }}>
                      <Navigation size={18} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>
                        {telemetry && !telemetryStale
                          ? `Moving at ${Math.round(telemetry.speed)} km/h · Heading ${getHeadingLabel(telemetry.heading)}`
                          : lastKnown
                            ? `Last seen location recorded`
                            : 'GPS standby · Waiting for live bus fix'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-light)' }}>
                        {busLocation ? `Coordinates: ${busLocation[0].toFixed(4)}, ${busLocation[1].toFixed(4)}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMapExpanded(true)}
                    style={{
                      background: PURPLE,
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: `0 2px 8px ${PURPLE}40`,
                    }}
                  >
                    Open Live Map <ChevronDown size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <UnifiedMap
                    busLocation={busLocation}
                    routeInfo={routeInfo}
                    telemetry={telemetry}
                    isLive={!!telemetry && !telemetryStale}
                    lastKnown={lastKnown}
                    initialZoom={14}
                    height="320px"
                    busLabel={`Bus ${routeInfo?.busNumber || routeInfo?.bus_number || child?.routeId || ''}`}
                    showFullscreenButton={true}
                    showAutoFollowToggle={true}
                    showRecenterButton={true}
                    showTelemetryPanel={true}
                    showRoutePolyline={true}
                    showDestinationMarker={true}
                  />
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '0.6rem' : '0.75rem' }}>
              <StatCard
                icon={<Calendar size={20} color={PURPLE} />}
                label="This Month"
                value={`${attendanceData?.attendancePercent ?? '—'}%`}
                sub={`${attendanceData?.monthlyAttendance ?? 0}/${attendanceData?.workingDays ?? 0} days`}
                color={PURPLE}
                isMobile={isMobile}
              />
              <StatCard
                icon={<IndianRupee size={20} color={child?.feeStatus === 'paid' ? '#16a34a' : '#ef4444'} />}
                label="Fee Status"
                value={child?.feeStatus ? child.feeStatus.charAt(0).toUpperCase() + child.feeStatus.slice(1) : '—'}
                color={child?.feeStatus === 'paid' ? '#16a34a' : '#ef4444'}
                isMobile={isMobile}
              />
              <StatCard
                icon={<Gauge size={20} color="#f97316" />}
                label="Bus Speed"
                value={telemetry && !telemetryStale ? `${Math.round(telemetry.speed)} km/h` : 'No Signal'}
                color="#f97316"
                isMobile={isMobile}
              />
              <StatCard
                icon={<Compass size={20} color="#06b6d4" />}
                label="Direction"
                value={telemetry && !telemetryStale ? getHeadingLabel(telemetry.heading) : '—'}
                color="#06b6d4"
                isMobile={isMobile}
              />
            </div>
          </div>
        )}

        {/* ===== ATTENDANCE TAB ===== */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '0.75rem' }}>
              {[
                { label: 'Present', value: attendanceData?.monthlyAttendance ?? 0, color: '#16a34a', icon: '✅' },
                { label: 'Absent', value: (attendanceData?.workingDays ?? 0) - (attendanceData?.monthlyAttendance ?? 0), color: '#ef4444', icon: '❌' },
                { label: 'Attendance %', value: `${attendanceData?.attendancePercent ?? 0}%`, color: PURPLE, icon: '📊' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--card-bg)', borderRadius: '14px',
                  padding: isMobile ? '0.75rem 0.35rem' : '1rem',
                  border: '1px solid var(--border-color)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>{s.icon}</div>
                  <p style={{ margin: '3px 0 0', fontWeight: 800, fontSize: isMobile ? '1.15rem' : '1.4rem', color: s.color }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: isMobile ? '0.68rem' : '0.72rem', color: 'var(--text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</p>
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
              <h3 style={{ margin: '0 0 0.4rem 0', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>
                📝 Mark Leave for Student
              </h3>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                Notify the transport department about your child's planned leave so the bus does not wait at the stop.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr auto', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '4px' }}>
                    Leave Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem', borderRadius: '10px',
                      border: '1.5px solid var(--border-color)', background: 'var(--bg-color)',
                      color: 'var(--text-dark)', fontSize: '0.88rem', cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '4px' }}>
                    Reason
                  </label>
                  <select
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem', borderRadius: '10px',
                      border: '1.5px solid var(--border-color)', background: 'var(--bg-color)',
                      color: 'var(--text-dark)', fontSize: '0.88rem', cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Sick / Medical Leave">Sick / Medical Leave</option>
                    <option value="Family Function / Event">Family Function / Event</option>
                    <option value="Out of Station">Out of Station</option>
                    <option value="Personal / Other Reason">Personal / Other Reason</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleMarkLeave}
                    disabled={isSubmittingLeave}
                    style={{
                      width: isMobile ? '100%' : 'auto',
                      background: PURPLE, color: 'white', border: 'none',
                      padding: '0.62rem 1.35rem', borderRadius: '10px',
                      fontWeight: 700, cursor: isSubmittingLeave ? 'default' : 'pointer', fontSize: '0.88rem',
                      boxShadow: `0 4px 12px ${PURPLE}40`,
                      opacity: isSubmittingLeave ? 0.7 : 1,
                    }}
                  >
                    {isSubmittingLeave ? 'Marking...' : 'Mark Leave'}
                  </button>
                </div>
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
            {broadcasts.map((b, i) => {
              const meta = getBroadcastMeta(b);
              return (
                <div key={b.id || i} style={{
                  background: 'var(--card-bg)', borderRadius: '16px', padding: '1.1rem 1.25rem',
                  border: `1px solid var(--border-color)`,
                  borderLeft: `4px solid ${meta.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ background: meta.bg, borderRadius: '10px', padding: '8px', flexShrink: 0, color: meta.border }}>
                      <Megaphone size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                        {b.title && (
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.92rem' }}>
                            {b.title}
                          </p>
                        )}
                        <span style={{
                          background: meta.badgeBg, color: meta.badgeColor,
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px'
                        }}>
                          {meta.tag}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.5 }}>{b.message}</p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                        {b.timestamp && !isNaN(new Date(b.timestamp).getTime()) ? new Date(b.timestamp).toLocaleString('en-IN') : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
                      onClick={() => setPreviewMedia({ type: 'photo', url: g.mediaUrl, caption: g.text })}
                      style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                      title="Click to view full image"
                    >
                      <img src={g.mediaUrl} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '350px', objectFit: 'contain' }} />
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
                      padding: '0.9rem', background: 'rgba(239, 68, 68, 0.08)',
                      borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)',
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
                            background: '#dc2626', color: 'white', cursor: busy ? 'default' : 'pointer',
                            fontWeight: 600, fontSize: '0.82rem',
                          }}
                        >
                          Reopen Complaint
                        </button>
                      </div>
                    </div>
                  )}

                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                    Raised {g.createdAt && !isNaN(new Date(g.createdAt).getTime()) ? new Date(g.createdAt).toLocaleString('en-IN') : ''}
                    {g.resolvedAt && !isNaN(new Date(g.resolvedAt).getTime()) && ` · Marked fixed ${new Date(g.resolvedAt).toLocaleString('en-IN')}`}
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
                      tickFormatter={(t) => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
                      tick={{ fontSize: 10, fill: 'var(--text-light)' }}
                      interval="preserveStartEnd"
                      minTickGap={25}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-light)' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', fontSize: '0.82rem', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(v) => [`${v} km/h`, 'Speed']}
                      labelFormatter={(l) => new Date(l).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
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

      {/* ========= MOBILE BOTTOM NAVIGATION BAR (Rendered ONLY on phone view) ========= */}
      {isMobile && (
        <nav
          className="parent-mobile-nav"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--card-bg)',
            borderTop: '1px solid var(--border-color)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            paddingTop: '6px',
            paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {[
            { id: 'overview', icon: <Bus size={19} />, label: 'Overview' },
            { id: 'attendance', icon: <Calendar size={19} />, label: 'Attendance' },
            {
              id: 'complaints',
              icon: <MessageSquareWarning size={19} />,
              label: 'Complaints',
              badge: childGrievances?.filter(g => g.status !== 'closed').length || null,
            },
            {
              id: 'announcements',
              icon: <Megaphone size={19} />,
              label: 'Notices',
              badge: broadcasts?.length || null,
            },
            { id: 'analytics', icon: <Activity size={19} />, label: 'Analytics' },
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 0',
                  cursor: 'pointer',
                  position: 'relative',
                  color: isActive ? PURPLE : 'var(--text-light)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    padding: '4px 14px',
                    borderRadius: '16px',
                    background: isActive ? `${PURPLE}1a` : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    color: isActive ? PURPLE : 'var(--text-light)',
                  }}>
                    {item.icon}
                  </div>
                  {item.badge ? (
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '6px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      minWidth: '16px',
                      height: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '1.5px solid var(--card-bg)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </div>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 700 : 500,
                  marginTop: '2px',
                  letterSpacing: '-0.1px',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
      {/* Media Viewer Lightbox Modal */}
      <MediaViewer media={previewMedia} onClose={() => setPreviewMedia(null)} />

      {/* Hamburger Drawer Menu (Consistent with Home/Admin/TI panels) */}
      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
          </div>
  );
};

export default ParentDashboard;
