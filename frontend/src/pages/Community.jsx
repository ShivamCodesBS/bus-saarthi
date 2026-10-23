import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  Video,
  Mic,
  X,
  ThumbsUp,
  ShieldAlert,
  CheckCircle2,
  UserCircle2,
  Search,
  SlidersHorizontal,
  MapPin,
  Play,
  Wrench,
  RotateCcw,
  Check,
  Bus,
  AlertTriangle,
  Timer,
  ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { friendlyError, reportError } from '../lib/errors';
import BusPicker from '../components/BusPicker';
import MediaViewer from '../components/MediaViewer';
import { ComplaintSkeleton, MyComplaintSkeleton } from '../components/ui/skeleton';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate';
import '../index.css';

/**
 * Bus-service categories. Every grievance is anchored to the passenger's
 * route, so the categories describe the bus service itself.
 */
const CATEGORIES = [
  'AC Problem',
  'Late Arrival',
  'Rash Driving',
  'Overcrowding',
  'Cleanliness',
  'Driver Behavior',
  'Route Issue',
  'Other',
];

/** Visual treatment for each lifecycle state. */
const STATUS_META = {
  pending: {
    label: 'Pending',
    bg: '#fff1f0',
    color: '#cf1322',
    Icon: ShieldAlert,
  },
  in_progress: {
    label: 'In Progress',
    bg: '#fff7e6',
    color: '#d46b08',
    Icon: Wrench,
  },
  resolved: {
    label: 'Awaiting Your Confirmation',
    bg: '#e6f4ff',
    color: '#0958d9',
    Icon: Timer,
  },
  reopened: {
    label: 'Reopened — Not Resolved',
    bg: '#fff1f0',
    color: '#cf1322',
    Icon: RotateCcw,
  },
  closed: {
    label: 'Closed — Confirmed',
    bg: '#e6fae6',
    color: '#28a745',
    Icon: CheckCircle2,
  },
};

const STATUS_ORDER = ['reopened', 'pending', 'in_progress', 'resolved', 'closed'];

/** One row of the complaint timeline shown in the detail sheet. */
const TimelineRow = ({ icon: Icon, tone, label, value, note }) => (
  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
    <span
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: tone,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '1px',
      }}
    >
      <Icon size={12} />
    </span>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-light)' }}>
        {value}
        {note ? ` — ${note}` : ''}
      </p>
    </div>
  </div>
);

const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [newComplaintText, setNewComplaintText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [processingUpvotes, setProcessingUpvotes] = useState(new Set());
  const [mediaType, setMediaType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  // Complaints are anonymous by default. The reporter may choose to have
  // their name shown to the transport staff instead.
  const [showMyName, setShowMyName] = useState(false);
  const [busyIds, setBusyIds] = useState(new Set());
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const fileInputRef = useRef(null);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Staff work bus by bus: they pick a bus and see only that bus's
   * complaints. The bus shown is the LIVE one serving the route — the
   * route is the stable identity, the bus can be swapped out.
   */
  const [selectedBus, setSelectedBus] = useState('all');
  const [busList, setBusList] = useState([]);

  /** The complaint whose full detail sheet is open. */
  const [detailId, setDetailId] = useState(null);

  /** The attachment currently open in the media viewer. */
  const [mediaOpen, setMediaOpen] = useState(null);

  /** Shows the "My complaints" panel for the signed-in user. */
  const [showMyComplaints, setShowMyComplaints] = useState(false);

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'tech_admin' ||
    user?.role === 'transport_incharge';

  // Route name lookup — fetched from backend
  const [routeMap, setRouteMap] = useState({});

  const token = user?.token;

  const formatTime = useCallback(
    (createdAtStr) => {
      if (!createdAtStr) return lang === 'hi' ? 'अभी-अभी' : 'Just now';
      const date = new Date(createdAtStr);
      if (isNaN(date.getTime())) return createdAtStr;
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      if (diffMins < 1) return lang === 'hi' ? 'अभी-अभी' : 'Just now';
      if (diffMins < 60)
        return lang === 'hi' ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
      if (diffHours < 24)
        return lang === 'hi' ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
      if (diffDays === 1) return lang === 'hi' ? 'कल' : 'Yesterday';
      if (diffDays < 7)
        return lang === 'hi' ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
      return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    },
    [lang],
  );

  // Stale-while-revalidate for complaints - fast cached load, then live update
  const {
    data: complaintsData,
    isLoading: complaintsLoading,
    isStale: complaintsStale,
    refetch: refetchComplaints,
    invalidate: invalidateComplaints,
    setToken: setComplaintsToken,
  } = useStaleWhileRevalidate('/api/grievances', {
    cacheKey: 'community:grievances',
    staleTime: 30000, // 30 seconds
    onData: (data) => {
      // Transform data to add isMine flag
      const userLoginId = user?.login_id || user?.loginId;
      const processed = data.map(c => ({
        ...c,
        isMine: c.isMine === true || (userLoginId && c.loginId === userLoginId),
      }));
      setComplaints(processed);
    },
  });

  // Stale-while-revalidate for routes
  const {
    data: routesData,
    isLoading: routesLoading,
    refetch: refetchRoutes,
    setToken: setRoutesToken,
  } = useStaleWhileRevalidate('/api/routes', {
    cacheKey: 'community:routes',
    staleTime: 60000, // 60 seconds - routes change less frequently
    onData: (routes) => {
      const map = {};
      routes.forEach((r) => {
        const liveBus = r.bus?.busNumber || r.busNumber;
        map[r.routeId] = {
          name: r.routeName || `Route ${r.routeId}`,
          // The live bus serving the route. The route is the stable
          // identity; the bus can change.
          busNumber: liveBus,
        };
      });
      setRouteMap(map);

      // The bus list for the staff selector.
      setBusList(
        routes.map((r) => {
          const liveBus = r.bus?.busNumber || r.busNumber;
          return {
            routeId: String(r.routeId),
            routeName: r.routeName || `Route ${r.routeId}`,
            busNumber: liveBus || 'Unknown',
            registrationNumber: r.registrationNumber || r.bus?.registrationNumber || '—',
            vehicleModel: r.vehicleModel || r.bus?.vehicleModel || '—',
            capacity: r.seatingCapacity || r.bus?.seatingCapacity || '—',
            city: r.city || 'Bareilly',
            driverId: r.driverId || '—',
          };
        }),
      );
    },
  });

  // Update tokens when user changes
  useEffect(() => {
    if (token) {
      setComplaintsToken(token);
      setRoutesToken(token);
    }
  }, [token, setComplaintsToken, setRoutesToken]);

  // Sync complaints state with hook data
  const [complaints, setComplaints] = useState([]);
  useEffect(() => {
    if (complaintsData) {
      const userLoginId = user?.login_id || user?.loginId;
      const processed = complaintsData.map(c => ({
        ...c,
        isMine: c.isMine === true || (userLoginId && c.loginId === userLoginId),
      }));
      setComplaints(processed);
    }
  }, [complaintsData, user]);

  // Combined loading state
  const isLoading = complaintsLoading || routesLoading;

  /**
   * Format the route of a complaint. Shows the route name and the bus that
   * is currently serving it.
   */
  const formatRoute = useCallback(
    (routeId, busNumber) => {
      if (!routeId || routeId === 'unknown') return 'Route not assigned';
      const info = routeMap[routeId];
      if (!info) return `Route ${routeId}`;
      const liveBus = busNumber || info.busNumber;
      return liveBus ? `${info.name} · Bus ${liveBus}` : info.name;
    },
    [routeMap],
  );

  // Derived stats
  const stats = useMemo(() => {
    const total = complaints.length;
    const closed = complaints.filter((c) => c.status === 'closed').length;
    const pending = complaints.filter(
      (c) => c.status === 'pending' || c.status === 'in_progress',
    ).length;
    const awaiting = complaints.filter((c) => c.status === 'resolved').length;
    const reopened = complaints.filter((c) => c.status === 'reopened').length;
    return { total, closed, pending, awaiting, reopened };
  }, [complaints]);

  /**
   * Live complaint counts per bus. A complaint is attributed to the bus that
   * was serving its route when it was raised, so the operator can see which
   * bus needs attention before selecting it.
   */
  const busCounts = useMemo(() => {
    const counts = {};
    complaints.forEach((c) => {
      const bus = c.busNumber || routeMap[c.route]?.busNumber;
      if (!bus) return;
      if (!counts[bus])
        counts[bus] = { unresolved: 0, awaiting: 0, total: 0 };
      counts[bus].total += 1;
      if (
        c.status === 'pending' ||
        c.status === 'in_progress' ||
        c.status === 'reopened'
      ) {
        counts[bus].unresolved += 1;
      } else if (c.status === 'resolved') {
        counts[bus].awaiting += 1;
      }
    });
    return counts;
  }, [complaints, routeMap]);

  /**
   * The complaints the signed-in user raised themselves. A student or a
   * parent gets their own list here, with the full status of each one.
   */
  const myComplaints = useMemo(
    () => complaints.filter((c) => c.isMine || c.loginId === user?.login_id),
    [complaints, user],
  );

  // Filtered + sorted complaints
  const filteredComplaints = useMemo(() => {
    let list = [...complaints];

    if (filterRoute === 'mine') {
      const myRoute = user?.route_id || user?.routeId;
      if (myRoute) {
        list = list.filter((c) => String(c.route) === String(myRoute));
      }
    }

    // A student, teacher or parent only ever sees the complaints for the
    // route they are allocated to. They never get a bus picker — the
    // transport staff do that.
    const myRoute = user?.route_id || user?.routeId;
    if (!isAdmin && myRoute) {
      list = list.filter((c) => String(c.route) === String(myRoute));
    }

    // The transport staff can narrow the list to one bus.
    if (isAdmin && selectedBus !== 'all') {
      const bus = busList.find((b) => b.busNumber === selectedBus);
      if (bus) {
        list = list.filter(
          (c) => String(c.route) === String(bus.routeId),
        );
      }
    }

    if (filterStatus !== 'all') list = list.filter((c) => c.status === filterStatus);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qWithoutHash = q.replace(/^#/, '');

      list = list.filter((c) => {
        const textMatch = (c.text || '').toLowerCase().includes(q);
        const routeIdMatch = String(c.route || '').toLowerCase().includes(q);
        const routeNameMatch = formatRoute(c.route, c.busNumber)
          .toLowerCase()
          .includes(q);
        const statusMatch = (c.status || '').toLowerCase().includes(q);
        const categoryMatch = (c.category || '').toLowerCase().includes(q);

        const ticketId = (c.id || '').substring(0, 6).toLowerCase();
        const ticketIdMatch = ticketId
          ? ticketId.includes(qWithoutHash) || q.includes(ticketId)
          : false;

        return (
          textMatch ||
          routeIdMatch ||
          routeNameMatch ||
          statusMatch ||
          categoryMatch ||
          ticketIdMatch
        );
      });
    }

    if (sortBy === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    } else if (sortBy === 'oldest') {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime(),
      );
    } else if (sortBy === 'most_agreed') {
      list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else if (sortBy === 'priority') {
      // Reopened and still-open complaints float to the top.
      list.sort((a, b) => {
        const rank = (c) => {
          const idx = STATUS_ORDER.indexOf(c.status);
          return idx === -1 ? STATUS_ORDER.length : idx;
        };
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return (b.priority || 0) - (a.priority || 0);
      });
    }

    return list;
  }, [complaints, filterRoute, filterStatus, searchQuery, sortBy, user, formatRoute, isAdmin, selectedBus, busList]);

  const handlePostComplaint = async (e) => {
    e.preventDefault();
    if (!newComplaintText.trim()) return;
    setIsUploading(true);
    let uploadedMediaUrl = '';
    if (mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      try {
        const uploadRes = await axios.post(
          `${BACKEND_URL}/api/upload`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (uploadRes.data.url) uploadedMediaUrl = uploadRes.data.url;
      } catch (err) {
        toast.error('We could not upload the attachment. Posting the text only.');
      }
    }
    try {
      const payload = {
        text: newComplaintText,
        type: mediaFile ? mediaType : 'text',
        mediaUrl: uploadedMediaUrl,
        category: selectedCategory,
        // The route is resolved server-side from the account's allocation.
        route: user?.route_id || undefined,
        // isAnonymous: true means the reporter's name is hidden from other passengers
        // but still visible to TI/Admin with an "anonymous" badge.
        isAnonymous: !showMyName,
      };
      const response = await axios.post(`${BACKEND_URL}/api/grievance`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.status === 'success') {
        const created = response.data.data || {};
        setComplaints((prev) => [
          {
            id: created.id,
            loginId: user?.login_id,
            route: created.route,
            busNumber: created.busNumber,
            text: newComplaintText,
            type: mediaFile ? mediaType : 'text',
            mediaUrl: uploadedMediaUrl,
            category: selectedCategory,
            realName: user?.name,
            isAnonymous: !showMyName,
            status: 'pending',
            upvotes: 0,
            createdAt: created.createdAt || new Date().toISOString(),
            isMine: true,
          },
          ...prev,
        ]);
        // Invalidate cache so next fetch gets fresh data
        invalidateComplaints();
        setShowModal(false);
        setNewComplaintText('');
        setSelectedCategory('');
        setMediaFile(null);
        setMediaType('');
        toast.success('Complaint raised! You will be notified when it is fixed.');
      }
    } catch (error) {
      toast.error(
        friendlyError(error, 'We could not submit your complaint. Please try again.'),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = (type) => {
    setMediaType(type);
    if (fileInputRef.current) {
      if (type === 'photo') fileInputRef.current.accept = 'image/*';
      else if (type === 'video') fileInputRef.current.accept = 'video/*';
      else if (type === 'audio') fileInputRef.current.accept = 'audio/*';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) setMediaFile(e.target.files[0]);
  };

  const handleUpvote = async (id) => {
    if (processingUpvotes.has(id)) return;
    if (!token) {
      toast.error('You must be logged in to agree.');
      return;
    }
    setProcessingUpvotes((prev) => new Set([...prev, id]));
    // Optimistic update using the functional form so a concurrent update
    // cannot clobber it.
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const wasUpvoted = !!c.hasUpvotedLocally;
        return {
          ...c,
          hasUpvotedLocally: !wasUpvoted,
          upvotes: Math.max(0, (c.upvotes || 0) + (wasUpvoted ? -1 : 1)),
        };
      }),
    );
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/grievance/${id}/upvote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, upvotes: res.data.upvotes ?? c.upvotes }
            : c,
        ),
      );
    } catch (err) {
      toast.error(friendlyError(err, 'We could not register your vote. Please try again.'));
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const wasUpvoted = !!c.hasUpvotedLocally;
          return {
            ...c,
            hasUpvotedLocally: !wasUpvoted,
            upvotes: Math.max(0, (c.upvotes || 0) + (wasUpvoted ? -1 : 1)),
          };
        }),
      );
    } finally {
      setProcessingUpvotes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /**
   * Staff marks the issue as fixed. The complaint stays open until the
   * complainant confirms — it does NOT disappear from the queue.
   */
  const handleResolve = async (id) => {
    const response = await axios.patch(
      `${BACKEND_URL}/api/grievance/${id}/resolve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: 'resolved', dueAt: response.data?.data?.dueAt }
          : c,
      ),
    );
    // Invalidate cache so next fetch gets fresh data
    invalidateComplaints();
    toast.success(
      'Marked as fixed. It stays open until the complainant confirms it.',
    );
  };

  const handleStart = async (id) => {
    setBusyIds((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'in_progress' } : c)),
      );
      // Invalidate cache so next fetch gets fresh data
      invalidateComplaints();
      toast.success('Marked as in progress.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not update the complaint. Please try again.'));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /** The complainant confirms the fix — this closes the complaint. */
  const handleConfirm = async (id) => {
    setBusyIds((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'closed' } : c)),
      );
      // Invalidate cache so next fetch gets fresh data
      invalidateComplaints();
      toast.success('Thank you! Your complaint is now closed.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not confirm the fix. Please try again.'));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /** The complainant rejects the fix — the complaint is reopened. */
  const handleReject = async (id) => {
    setBusyIds((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/reopen`,
        { reason: rejectReason },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'reopened',
                reopenCount: (c.reopenCount || 0) + 1,
                priority: (c.priority || 0) + 10,
              }
            : c,
        ),
      );
      // Invalidate cache so next fetch gets fresh data
      invalidateComplaints();
      setRejectingId(null);
      setRejectReason('');
      toast.success('Complaint reopened. It is now at the top of the queue.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not reopen the complaint. Please try again.'));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleExtend = async (id) => {
    setBusyIds((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/extend`,
        { hours: 24 },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Invalidate cache so next fetch gets fresh data
      invalidateComplaints();
      toast.success('Confirmation window extended by 24 hours.');
    } catch (err) {
      toast.error(friendlyError(err, 'We could not extend the deadline. Please try again.'));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const renderStatusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const { Icon } = meta;
    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 'bold',
          padding: '0.25rem 0.5rem',
          borderRadius: '8px',
          backgroundColor: meta.bg,
          color: meta.color,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={12} />
        {meta.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Unified Hero Header */}
      <div
        className="sticky top-0"
        style={{
          backgroundColor: 'var(--primary-blue)',
          zIndex: 50,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="p-header"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingBottom: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                if (showMyComplaints) {
                  setShowMyComplaints(false);
                } else {
                  navigate(-1);
                }
              }}
              aria-label={showMyComplaints ? "Return to Community Feed" : "Go back"}
              title={showMyComplaints ? "Back to Community Home" : "Go back"}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  margin: 0,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                {showMyComplaints ? (
                  <>
                    <ClipboardList size={20} /> My Complaints
                  </>
                ) : (
                  t('grievancePortal')
                )}
              </h1>
              {showMyComplaints ? (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.85)',
                    marginTop: '2px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{myComplaints.length} Total Raised</span>
                  <span>•</span>
                  <span style={{ color: '#fcd34d' }}>
                    {myComplaints.filter(c => c.status === 'pending' || c.status === 'in_progress').length} In Progress
                  </span>
                  <span>•</span>
                  <span style={{ color: '#86efac' }}>
                    {myComplaints.filter(c => c.status === 'closed').length} Closed
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.7)',
                    marginTop: '2px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{stats.total} Total</span>
                  <span>•</span>
                  <span style={{ color: '#fcd34d' }}>{stats.pending} Open</span>
                  {stats.awaiting > 0 && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#91d5ff' }}>
                        {stats.awaiting} Awaiting Confirmation
                      </span>
                    </>
                  )}
                  {stats.reopened > 0 && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#ffa39e' }}>
                        {stats.reopened} Reopened
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span style={{ color: '#86efac' }}>{stats.closed} Closed</span>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flex: 1,
              gap: '0.6rem',
              alignItems: 'center',
              minWidth: '260px',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {showMyComplaints ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => setShowMyComplaints(false)}
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px',
                    padding: '0.45rem 0.9rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    transition: 'all 0.15s',
                  }}
                >
                  <ArrowLeft size={14} /> Back to Community Home
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    background: 'var(--secondary-orange)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '0.45rem 0.9rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <Plus size={14} /> New Complaint
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    position: 'relative',
                    flex: '1 1 180px',
                    maxWidth: '320px',
                    minWidth: 0,
                  }}
                >
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '2.2rem',
                      paddingRight: '0.9rem',
                      paddingTop: '0.55rem',
                      paddingBottom: '0.55rem',
                      borderRadius: '24px',
                      border: '1px solid rgba(255,255,255,0.25)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      fontFamily: 'inherit',
                      backgroundColor: 'rgba(255,255,255,0.14)',
                      color: 'white',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  {[
                    { key: 'newest', label: 'New' },
                    { key: 'priority', label: 'Priority' },
                    { key: 'most_agreed', label: 'Top' },
                    { key: 'oldest', label: 'Old' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setSortBy(tab.key)}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.25)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        backgroundColor:
                          sortBy === tab.key ? 'white' : 'rgba(255,255,255,0.12)',
                        color: sortBy === tab.key ? 'var(--primary-blue)' : 'white',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {!isAdmin && (
                  <button
                    onClick={() => setShowMyComplaints(true)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '20px',
                      padding: '0.45rem 0.85rem',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ClipboardList size={13} /> My complaints
                    {myComplaints.length > 0 && (
                      <span
                        style={{
                          background: 'rgba(255,255,255,0.35)',
                          borderRadius: '10px',
                          padding: '0.05rem 0.4rem',
                          fontSize: '0.68rem',
                        }}
                      >
                        {myComplaints.length}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    background: showFilters
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: '20px',
                    padding: '0.45rem 0.85rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}
                >
                  <SlidersHorizontal size={14} /> Filter
                </button>
              </>
            )}
          </div>
        </div>

        {showFilters && (
          <div
            style={{
              paddingLeft: '1rem',
              paddingRight: '1rem',
              paddingBottom: '0.875rem',
              maxWidth: '850px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: '0.75rem',
            }}
          >
            {[
              'all',
              'pending',
              'in_progress',
              'resolved',
              'reopened',
              'closed',
            ].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  backgroundColor:
                    filterStatus === s ? '#28a745' : 'transparent',
                  color: filterStatus === s ? 'white' : 'var(--text-dark)',
                }}
              >
                {s === 'all'
                  ? 'All'
                  : STATUS_META[s]?.label ||
                    s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            {isAdmin && (
            <button
              onClick={() => setFilterRoute(filterRoute === 'mine' ? 'all' : 'mine')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: '600',
                backgroundColor:
                  filterRoute === 'mine'
                    ? 'var(--secondary-orange)'
                    : 'rgba(255,255,255,0.12)',
                color: 'white',
              }}
            >
              <MapPin size={12} /> My Route Only
            </button>
            )}
          </div>
        )}

      </div>

      {/* ── Staff pre-screen: pick a bus ─────────────────────────
          Staff triage bus by bus. The first screen is a card per bus
          with its live complaint counts; choosing a bus opens that
          bus's complaints. */}
      {isAdmin && (
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            width: '100%',
            padding: '1.25rem 1rem 0.5rem',
          }}
        >
          {selectedBus === 'all' ? (
            <>
              <BusPicker
                busList={busList}
                busCounts={busCounts}
                selected={selectedBus}
                onSelect={setSelectedBus}
              />
              <p
                style={{
                  color: 'var(--text-light)',
                  margin: '0.75rem 0 0',
                  fontSize: '0.85rem',
                }}
              >
                Choose a bus to work through its complaints. You can see the
                real names of anonymous posters.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedBus('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  alignSelf: 'flex-start',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-dark)',
                  borderRadius: '20px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} /> All buses
              </button>
              <BusPicker
                busList={busList}
                busCounts={busCounts}
                selected={selectedBus}
                onSelect={setSelectedBus}
              />
            </>
          )}
        </div>
      )}

      {/* ── Page heading & Section Button (when on main community home) ── */}
      {!isAdmin && !showMyComplaints && (
        <div
          style={{
            maxWidth: '850px',
            margin: '0 auto',
            width: '100%',
            padding: '1.25rem 1rem 0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.45rem',
                  fontWeight: '800',
                  color: 'var(--text-dark)',
                  letterSpacing: '-0.4px',
                }}
              >
                Bus complaints
              </h1>
              <p
                style={{
                  margin: '0.35rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--text-light)',
                  maxWidth: '62ch',
                  lineHeight: 1.5,
                }}
              >
                Complaints raised by passengers on your bus route. Open one to see
                its status and the transport team’s response.
              </p>
            </div>

            {/* Prominent Section Button to open My Complaints Window */}
            <button
              onClick={() => setShowMyComplaints(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, var(--primary-blue), #004494)',
                color: 'white',
                fontWeight: '700',
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 86, 179, 0.28)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
              }}
              className="hover-lift"
              title="Open your personal complaints window"
            >
              <ClipboardList size={18} />
              <span>My Complaints</span>
              {myComplaints.length > 0 && (
                <span
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                  }}
                >
                  {myComplaints.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── My Complaints Window (Dedicated Animated View) ────────────────── */}
      {showMyComplaints && !isAdmin && (
        <main
          className="p-main pb-24 animate-slide-up"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxWidth: '850px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Window Navigation Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setShowMyComplaints(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-dark)',
                borderRadius: '24px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
              className="hover-lift"
            >
              <ArrowLeft size={16} /> Back to Community Home
            </button>

            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'var(--secondary-orange)',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 102, 0, 0.3)',
                transition: 'all 0.2s ease',
              }}
              className="hover-lift"
            >
              <Plus size={16} /> Raise New Complaint
            </button>
          </div>

          {/* Window Hero Card with Stats */}
          <div
            className="glass"
            style={{
              borderRadius: '20px',
              padding: '1.35rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
              borderLeft: '5px solid var(--primary-blue)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={22} color="var(--primary-blue)" />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                  My Raised Complaints
                </h2>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.45 }}>
                Track issues you have raised. When the transport team marks a complaint as fixed, you can confirm it or reopen if not satisfied.
              </p>
            </div>

            {/* Quick Stat Chips */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.65rem',
              }}
            >
              <div style={{ background: 'var(--bg-color)', padding: '0.65rem 0.9rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: '600' }}>Total Raised</span>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                  {myComplaints.length}
                </p>
              </div>
              <div style={{ background: '#fff7e6', padding: '0.65rem 0.9rem', borderRadius: '12px', border: '1px solid #ffe7ba' }}>
                <span style={{ fontSize: '0.72rem', color: '#d46b08', fontWeight: '600' }}>In Progress / Open</span>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: '800', color: '#d46b08' }}>
                  {myComplaints.filter(c => c.status === 'pending' || c.status === 'in_progress' || c.status === 'reopened').length}
                </p>
              </div>
              <div style={{ background: '#e6f4ff', padding: '0.65rem 0.9rem', borderRadius: '12px', border: '1px solid #bae0ff' }}>
                <span style={{ fontSize: '0.72rem', color: '#0958d9', fontWeight: '600' }}>Awaiting Confirmation</span>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: '800', color: '#0958d9' }}>
                  {myComplaints.filter(c => c.status === 'resolved').length}
                </p>
              </div>
              <div style={{ background: '#e6fae6', padding: '0.65rem 0.9rem', borderRadius: '12px', border: '1px solid #b7eb8f' }}>
                <span style={{ fontSize: '0.72rem', color: '#28a745', fontWeight: '600' }}>Closed (Resolved)</span>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: '800', color: '#28a745' }}>
                  {myComplaints.filter(c => c.status === 'closed').length}
                </p>
              </div>
            </div>
          </div>

          {/* List of My Complaints */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[1, 2, 3].map((i) => (
                <ComplaintSkeleton key={i} style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : myComplaints.length === 0 ? (
            <div
              className="glass"
              style={{
                borderRadius: '20px',
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'rgba(0, 86, 179, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-blue)',
                }}
              >
                <ClipboardList size={34} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                  No Complaints Raised
                </h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-light)', maxWidth: '44ch', lineHeight: 1.5 }}>
                  You have not submitted any complaints yet. If you notice any issue with the bus service, drivers, or route, let the transport team know.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    background: 'var(--primary-blue)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    padding: '0.65rem 1.4rem',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,86,179,0.25)',
                  }}
                >
                  Raise a Complaint
                </button>
                <button
                  onClick={() => setShowMyComplaints(false)}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    padding: '0.65rem 1.25rem',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Return to Community Feed
                </button>
              </div>
            </div>
          ) : (
            myComplaints.map((comp) => {
              const busy = busyIds.has(comp.id);
              const meta = STATUS_META[comp.status] || STATUS_META.pending;
              const { Icon } = meta;
              return (
                <div
                  key={comp.id}
                  className="glass animate-slide-up p-glass"
                  onClick={() => setDetailId(comp.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailId(comp.id);
                    }
                  }}
                  style={{
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${
                      comp.status === 'closed'
                        ? '#28a745'
                        : comp.status === 'resolved'
                          ? '#0958d9'
                          : comp.status === 'in_progress'
                            ? '#d46b08'
                            : '#cf1322'
                    }`,
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <div
                        style={{
                          backgroundColor: meta.bg,
                          color: meta.color,
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                          {t('yourComplaint')}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <Bus size={12} />
                          {formatRoute(comp.route, comp.busNumber)}
                          <span>•</span>
                          {formatTime(comp.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-light)', backgroundColor: '#f1f3f5', padding: '0.25rem 0.4rem', borderRadius: '6px', fontFamily: 'monospace' }}>
                        #{String(comp.id).substring(0, 6).toUpperCase()}
                      </span>
                      {renderStatusBadge(comp.status)}
                      {comp.category && (
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(24,119,242,0.1)', color: 'var(--primary-blue)' }}>
                          {comp.category}
                        </span>
                      )}
                      {comp.reopenCount > 0 && comp.status !== 'closed' && (
                        <span style={{ fontSize: '0.62rem', fontWeight: '700', padding: '0.15rem 0.4rem', borderRadius: '6px', backgroundColor: '#fff1f0', color: '#cf1322' }}>
                          ×{comp.reopenCount} Reopened
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Complaint Text */}
                  <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {comp.text}
                  </p>

                  {/* Media attachment if any */}
                  {comp.type === 'photo' && comp.mediaUrl && (
                    <div onClick={(e) => { e.stopPropagation(); setMediaOpen({ type: 'photo', url: comp.mediaUrl }); }} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', cursor: 'zoom-in', maxHeight: '300px' }}>
                      <img src={comp.mediaUrl} alt="Complaint attachment" loading="lazy" style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block' }} />
                    </div>
                  )}

                  {/* Admin Response Callout */}
                  {comp.adminResponse && (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(0,86,179,0.06)', borderLeft: '3px solid var(--primary-blue)', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary-blue)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Response from the transport team
                      </p>
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                        {comp.adminResponse}
                      </p>
                    </div>
                  )}

                  {/* Complainant actions when resolved */}
                  {comp.status === 'resolved' && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0958d9', flex: '1 1 100%' }}>
                        ⚡ The transport team marked this as fixed. Please confirm if satisfied:
                      </span>
                      <button
                        onClick={() => handleConfirm(comp.id)}
                        disabled={busy}
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          cursor: busy ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Check size={14} /> Yes, Confirmed Fixed
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(comp.id);
                          setRejectReason('');
                        }}
                        disabled={busy}
                        style={{
                          backgroundColor: '#cf1322',
                          color: 'white',
                          border: 'none',
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '0.82rem',
                          cursor: busy ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <RotateCcw size={14} /> Not Fixed Yet
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Bottom Return Button */}
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => setShowMyComplaints(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-light)',
                borderRadius: '24px',
                padding: '0.5rem 1.25rem',
                fontSize: '0.82rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Return to Community Feed
            </button>
          </div>
        </main>
      )}

      {/* Feed Area — for staff this only appears once a bus is chosen. Only shown when not in My Complaints window. */}
      {!showMyComplaints && (!isAdmin || selectedBus !== 'all') && (
      <main
        className="p-main pb-24"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxWidth: '850px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[1, 2, 3].map((i) => (
              <ComplaintSkeleton key={i} style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-light)',
            }}
          >
            <ShieldAlert size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <p style={{ fontWeight: '600' }}>No complaints found</p>
            <p style={{ fontSize: '0.85rem' }}>Try adjusting your filters</p>
          </div>
        ) : (
filteredComplaints.map((comp) => {
              // Check if this complaint belongs to the current user
              // Use strict equality and handle potential case/formatting differences
              const userLoginId = user?.login_id || user?.loginId;
              const compLoginId = comp.loginId;
              const isMine = comp.isMine === true || (userLoginId && compLoginId && compLoginId === userLoginId);
              const busy = busyIds.has(comp.id);
              return (
              <div
                key={comp.id}
                className="glass animate-slide-up p-glass"
                onClick={() => setDetailId(comp.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailId(comp.id);
                  }
                }}
                style={{
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${
                    comp.status === 'closed'
                      ? '#28a745'
                      : comp.status === 'resolved'
                        ? '#0958d9'
                        : comp.status === 'in_progress'
                          ? '#d46b08'
                          : '#cf1322'
                  }`,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#e9ecef',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    >
                      <UserCircle2 size={24} color="var(--text-light)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '0.95rem',
                          fontWeight: 'bold',
                          color: 'var(--text-dark)',
                        }}
                      >
                        {/* The reporter's identity is not on the card.
                            Staff open the complaint to see the details. */}
                        {isMine ? t('yourComplaint') : t('anonymousPassenger')}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.75rem',
                          color: 'var(--text-light)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Bus size={12} />
                        {formatRoute(comp.route, comp.busNumber)}
                        <span>•</span>
                        {formatTime(comp.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        color: 'var(--text-light)',
                        backgroundColor: '#f1f3f5',
                        padding: '0.25rem 0.4rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      #{String(comp.id).substring(0, 6).toUpperCase()}
                    </span>
                    {renderStatusBadge(comp.status)}
                    {comp.category && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(24,119,242,0.1)',
                          color: 'var(--primary-blue)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {comp.category}
                      </span>
                    )}
                    {comp.reopenCount > 0 && comp.status !== 'closed' && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '6px',
                          backgroundColor: '#fff1f0',
                          color: '#cf1322',
                          whiteSpace: 'nowrap',
                        }}
                        title={`The complainant rejected the fix ${comp.reopenCount} time(s)`}
                      >
                        ×{comp.reopenCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    color: 'var(--text-dark)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {comp.text}
                </p>

                {/* Media Attachment */}
                {comp.type === 'photo' && comp.mediaUrl && (
                  <button
                    onClick={() =>
                      setMediaOpen({ type: 'photo', url: comp.mediaUrl })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      marginTop: '0.5rem',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      cursor: 'zoom-in',
                      padding: 0,
                    }}
                  >
                    <img
                      src={comp.mediaUrl}
                      alt="Complaint attachment"
                      loading="lazy"
                      onError={(e) => {
                        // A broken image URL must not leave a blank frame.
                        e.currentTarget.style.display = 'none';
                      }}
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        maxHeight: '400px',
                        objectFit: 'contain',
                      }}
                    />
                  </button>
                )}
                {comp.type === 'video' && comp.mediaUrl && (
                  <button
                    onClick={() =>
                      setMediaOpen({ type: 'video', url: comp.mediaUrl })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--primary-blue)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Play size={18} fill="white" />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.88rem',
                          fontWeight: '700',
                          color: 'var(--text-dark)',
                        }}
                      >
                        Video attachment
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.76rem',
                          color: 'var(--text-light)',
                        }}
                      >
                        Tap to play
                      </span>
                    </span>
                  </button>
                )}
                {comp.type === 'audio' && comp.mediaUrl && (
                  <button
                    onClick={() =>
                      setMediaOpen({ type: 'audio', url: comp.mediaUrl })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '1rem',
                      borderRadius: '30px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-color)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--secondary-orange)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Mic size={18} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.88rem',
                          fontWeight: '700',
                          color: 'var(--text-dark)',
                        }}
                      >
                        Audio attachment
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.76rem',
                          color: 'var(--text-light)',
                        }}
                      >
                        Tap to listen
                      </span>
                    </span>
                  </button>
                )}

                {/* The transport team's reply — only to the person who
                    raised the complaint. */}
                {comp.adminResponse && isMine && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(0,86,179,0.06)',
                      borderLeft: '3px solid var(--primary-blue)',
                      borderRadius: '8px',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        color: 'var(--primary-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      Response from the transport team
                    </p>
                    <p
                      style={{
                        margin: '0.3rem 0 0',
                        fontSize: '0.88rem',
                        color: 'var(--text-dark)',
                        lineHeight: 1.5,
                      }}
                    >
                      {comp.adminResponse}
                    </p>
                  </div>
                )}

                {/* Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f0f0f0',
                    paddingTop: '1rem',
                    marginTop: '0.5rem',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={() => handleUpvote(comp.id)}
                    disabled={processingUpvotes.has(comp.id) || isMine}
                    title={
                      isMine ? 'You cannot agree with your own complaint' : ''
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: 'none',
                      backgroundColor: comp.hasUpvotedLocally
                        ? 'var(--primary-blue)'
                        : 'transparent',
                      color: comp.hasUpvotedLocally ? 'white' : 'var(--primary-blue)',
                      fontWeight: '600',
                      cursor:
                        processingUpvotes.has(comp.id) || isMine
                          ? 'default'
                          : 'pointer',
                      padding: '0.5rem 1rem',
                      borderRadius: '30px',
                      transition: 'all 0.2s ease',
                      opacity: isMine ? 0.5 : 1,
                    }}
                  >
                    <ThumbsUp
                      size={20}
                      strokeWidth={2.5}
                      fill={comp.hasUpvotedLocally ? 'white' : 'none'}
                    />{' '}
                    {comp.upvotes || 0}{' '}
                    {comp.hasUpvotedLocally ? 'Agreed' : t('agree')}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {/* Staff actions */}
                    {isAdmin && comp.status === 'pending' && (
                      <button
                        onClick={() => handleStart(comp.id)}
                        disabled={busy}
                        style={{
                          backgroundColor: '#d46b08',
                          color: 'white',
                          border: 'none',
                          padding: '0.4rem 1rem',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          cursor: busy ? 'default' : 'pointer',
                        }}
                      >
                        Start Work
                      </button>
                    )}

                    {isAdmin &&
                      (comp.status === 'pending' ||
                        comp.status === 'in_progress' ||
                        comp.status === 'reopened') && (
                        <button
                          onClick={() => handleResolve(comp.id)}
                          disabled={busy}
                          style={{
                            backgroundColor: 'var(--secondary-orange)',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: busy ? 'default' : 'pointer',
                          }}
                        >
                          Mark as Fixed
                        </button>
                      )}

                    {isAdmin && comp.status === 'resolved' && (
                      <button
                        onClick={() => handleExtend(comp.id)}
                        disabled={busy}
                        title="Give the complainant 24 more hours to respond"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--primary-blue)',
                          border: '1px solid var(--primary-blue)',
                          padding: '0.35rem 0.9rem',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          cursor: busy ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Timer size={13} /> Extend 24h
                      </button>
                    )}

                    {/* Complainant actions */}
                    {isMine && comp.status === 'resolved' && (
                      <>
                        <button
                          onClick={() => handleConfirm(comp.id)}
                          disabled={busy}
                          style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: busy ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <Check size={14} /> Yes, Fixed
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(
                              rejectingId === comp.id ? null : comp.id,
                            );
                            setRejectReason('');
                          }}
                          disabled={busy}
                          style={{
                            backgroundColor: '#cf1322',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: busy ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <AlertTriangle size={14} /> Not Fixed Yet
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reject reason */}
                {rejectingId === comp.id && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      padding: '0.9rem',
                      backgroundColor: 'rgba(207,19,34,0.05)',
                      borderRadius: '10px',
                      border: '1px solid rgba(207,19,34,0.2)',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: 'var(--text-dark)',
                      }}
                    >
                      What is still not fixed?
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. The bus was on time today but the AC was still not working."
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-dark)',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.82rem',
                          color: 'var(--text-dark)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(comp.id)}
                        disabled={busy}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#cf1322',
                          color: 'white',
                          cursor: busy ? 'default' : 'pointer',
                          fontWeight: '600',
                          fontSize: '0.82rem',
                        }}
                      >
                        Reopen Complaint
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
      )}


      {/* ── Complaint detail sheet ──────────────────────────────
          The list is the student-facing view. This sheet is what a
          staff member sees when they open a complaint: the bus it was
          raised against, the exact timeline, and who handled it. */}
      {detailId && (() => {
        const comp = complaints.find((c) => c.id === detailId);
        if (!comp) return null;
        const meta = STATUS_META[comp.status] || STATUS_META.pending;
        const { Icon } = meta;
        const bus = comp.busNumber || routeMap[comp.route]?.busNumber;
        const busInfo = busList.find((b) => b.busNumber === bus);
        const isMine = comp.isMine || comp.loginId === user?.login_id;
        const busy = busyIds.has(comp.id);

        return (
          <div
            className="modal-overlay"
            onClick={() => setDetailId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="modal-sheet"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--card-bg)',
                width: '100%',
                maxWidth: '640px',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.35rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: 'var(--text-light)',
                        background: '#f1f3f5',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '6px',
                      }}
                    >
                      #{String(comp.id).substring(0, 6).toUpperCase()}
                    </span>
                    {renderStatusBadge(comp.status)}
                    {comp.category && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: 'rgba(24,119,242,0.1)',
                          color: 'var(--primary-blue)',
                        }}
                      >
                        {comp.category}
                      </span>
                    )}
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: 'var(--text-dark)',
                    }}
                  >
                    {isMine
                      ? 'Your complaint'
                      : comp.realName && comp.realName !== 'Anonymous Passenger'
                        ? 'Complaint from a passenger'
                        : 'Anonymous complaint'}
                  </h2>
                </div>
                <button
                  onClick={() => setDetailId(null)}
                  aria-label="Close"
                  style={{
                    background: '#f1f3f5',
                    border: 'none',
                    borderRadius: '50%',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={20} color="var(--text-dark)" />
                </button>
              </div>

              {/* Body */}
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.1rem',
                }}
              >
                {/* Bus identity */}
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-color)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      color: 'var(--primary-blue)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Bus size={14} /> Bus
                  </div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: '800',
                      color: 'var(--text-dark)',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {bus || 'Unknown bus'}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.4rem 1rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-light)',
                    }}
                  >
                    <span>
                      <strong style={{ color: 'var(--text-dark)' }}>Route:</strong>{' '}
                      {busInfo?.routeName || `Route ${comp.route}`}
                      {busInfo ? ` (${busInfo.routeId})` : ''}
                    </span>
                    {busInfo && (
                      <>
                        <span>
                          <strong style={{ color: 'var(--text-dark)' }}>
                            Registration:
                          </strong>{' '}
                          {busInfo.registrationNumber}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--text-dark)' }}>
                            Model:
                          </strong>{' '}
                          {busInfo.vehicleModel}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--text-dark)' }}>
                            Capacity:
                          </strong>{' '}
                          {busInfo.capacity}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--text-dark)' }}>City:</strong>{' '}
                          {busInfo.city}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--text-dark)' }}>
                            Driver:
                          </strong>{' '}
                          {busInfo.driverId}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Complaint text */}
                <div>
                  <p
                    style={{
                      margin: '0 0 0.4rem',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      color: 'var(--text-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    What was reported
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.95rem',
                      color: 'var(--text-dark)',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {comp.text}
                  </p>
                </div>

                {/* Media */}
                {comp.type === 'photo' && comp.mediaUrl && (
                  <img
                    src={comp.mediaUrl}
                    alt="Complaint attachment"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      maxHeight: '320px',
                      objectFit: 'contain',
                    }}
                  />
                )}
                {comp.type === 'video' && comp.mediaUrl && (
                  <video
                    src={comp.mediaUrl}
                    controls
                    preload="metadata"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      maxHeight: '320px',
                    }}
                  />
                )}
                {comp.type === 'audio' && comp.mediaUrl && (
                  <audio src={comp.mediaUrl} controls style={{ width: '100%' }} />
                )}

                {/* Timeline */}
                <div>
                  <p
                    style={{
                      margin: '0 0 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      color: 'var(--text-light)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Timeline
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      borderLeft: '2px solid var(--border-color)',
                      paddingLeft: '0.9rem',
                    }}
                  >
                    <TimelineRow
                      icon={ShieldAlert}
                      tone="#cf1322"
                      label="Raised"
                      value={new Date(comp.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    />
                    {comp.resolvedAt && (
                      <TimelineRow
                        icon={Wrench}
                        tone="#d46b08"
                        label="Marked as fixed"
                        value={new Date(comp.resolvedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      />
                    )}
                    {comp.reopenCount > 0 && (
                      <TimelineRow
                        icon={RotateCcw}
                        tone="#cf1322"
                        label="Reopened"
                        value={`${comp.reopenCount} time(s)`}
                        note="the complainant said it was not fixed"
                      />
                    )}
                    {comp.confirmedAt && (
                      <TimelineRow
                        icon={Check}
                        tone="#28a745"
                        label="Confirmed and closed"
                        value={new Date(comp.confirmedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        note="the complainant confirmed the fix"
                      />
                    )}
                    {comp.dueAt && comp.status === 'resolved' && (
                      <TimelineRow
                        icon={Timer}
                        tone="#0958d9"
                        label="Awaiting confirmation"
                        value={`due ${new Date(comp.dueAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                        })}`}
                        note="stays open until the complainant confirms"
                      />
                    )}
                  </div>
                </div>

                {/* Staff-only: who raised it and who handled it */}
                {isAdmin && (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-color)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-light)',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 0.2rem',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: 'var(--text-light)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Staff view
                    </p>
                    <span>
                      <strong style={{ color: 'var(--text-dark)' }}>
                        Raised by:
                      </strong>{' '}
                      {comp.realName || 'Anonymous Passenger'}{' '}
                      {comp.isAnonymous && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '6px',
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            whiteSpace: 'nowrap',
                            border: '1px solid #ffeeba',
                          }}
                        >
                          🕵️ Anonymous
                        </span>
                      )}
                      {comp.loginId ? `(${comp.loginId})` : ''}
                    </span>
                    {comp.resolvedBy && (
                      <span>
                        <strong style={{ color: 'var(--text-dark)' }}>
                          Handled by:
                        </strong>{' '}
                        {comp.resolvedBy}
                      </span>
                    )}
                    {comp.resolutionNote && (
                      <span>
                        <strong style={{ color: 'var(--text-dark)' }}>
                          Internal note:
                        </strong>{' '}
                        {comp.resolutionNote}
                      </span>
                    )}
                  </div>
                )}

                {/* The response the complainant was shown */}
                {comp.adminResponse && (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      background: 'rgba(0,86,179,0.06)',
                      borderLeft: '3px solid var(--primary-blue)',
                      borderRadius: '8px',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: 'var(--primary-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Response from the transport team
                    </p>
                    <p
                      style={{
                        margin: '0.35rem 0 0',
                        fontSize: '0.9rem',
                        color: 'var(--text-dark)',
                        lineHeight: 1.5,
                      }}
                    >
                      {comp.adminResponse}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {isAdmin &&
                  (comp.status === 'pending' || comp.status === 'reopened') && (
                    <button
                      onClick={() => handleStart(comp.id)}
                      disabled={busy}
                      style={{
                        background: '#d46b08',
                        color: 'white',
                        border: 'none',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: busy ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Wrench size={15} /> Start Work
                    </button>
                  )}

                {isAdmin &&
                  (comp.status === 'pending' ||
                    comp.status === 'in_progress' ||
                    comp.status === 'reopened') && (
                    <button
                      onClick={() => handleResolve(comp.id)}
                      disabled={busy}
                      style={{
                        background: 'var(--secondary-orange)',
                        color: 'white',
                        border: 'none',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: busy ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <CheckCircle2 size={15} /> Mark as Fixed
                    </button>
                  )}

                {isAdmin && comp.status === 'resolved' && (
                  <button
                    onClick={() => handleExtend(comp.id)}
                    disabled={busy}
                    style={{
                      background: 'transparent',
                      color: 'var(--primary-blue)',
                      border: '1px solid var(--primary-blue)',
                      padding: '0.5rem 1rem',
                      borderRadius: '9px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: busy ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Timer size={15} /> Extend 24h
                  </button>
                )}

                {isMine && comp.status === 'resolved' && (
                  <>
                    <button
                      onClick={() => handleConfirm(comp.id)}
                      disabled={busy}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: busy ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Check size={15} /> Yes, Fixed
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(comp.id);
                        setRejectReason('');
                        setDetailId(null);
                      }}
                      disabled={busy}
                      style={{
                        background: '#cf1322',
                        color: 'white',
                        border: 'none',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: busy ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <AlertTriangle size={15} /> Not Fixed Yet
                    </button>
                  </>
                )}

                <button
                  onClick={() => setDetailId(null)}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-dark)',
                    border: '1px solid var(--border-color)',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '9px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Action Button */}
      {!isAdmin && (
        <button
          onClick={() => setShowModal(true)}
          aria-label="Raise a complaint"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--secondary-orange)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 102, 0, 0.4)',
            border: 'none',
            cursor: 'pointer',
            zIndex: 20,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = 'scale(1.1)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = 'scale(1)')
          }
        >
          <Plus size={32} />
        </button>
      )}

      {/* Raise Complaint Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            className="animate-slide-up p-glass"
            style={{
              backgroundColor: 'var(--card-bg)',
              width: '100%',
              maxWidth: '600px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    color: 'var(--primary-blue)',
                  }}
                >
                  Raise a Grievance
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    color: 'var(--text-light)',
                  }}
                >
                  {showMyName
                    ? 'The transport team will see your name on this complaint.'
                    : 'Your name is hidden from other passengers and the transport team.'}
                </p>
                {user?.route_id && (
                  <p
                    style={{
                      margin: '0.35rem 0 0',
                      fontSize: '0.78rem',
                      color: 'var(--primary-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Bus size={13} />
                    Filed against your route: {formatRoute(user.route_id)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                style={{
                  background: '#f8f9fa',
                  border: 'none',
                  borderRadius: '50%',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <X size={24} color="var(--text-dark)" />
              </button>
            </div>

            <form
              onSubmit={handlePostComplaint}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: 'var(--text-dark)',
                  }}
                >
                  Category (optional)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? '' : cat)
                      }
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        backgroundColor:
                          selectedCategory === cat
                            ? 'var(--primary-blue)'
                            : 'var(--bg-color)',
                        color:
                          selectedCategory === cat
                            ? 'white'
                            : 'var(--text-dark)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Who should the transport team see? Complaints are anonymous
                  by default; the reporter can opt in to being named. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  padding: '0.7rem 0.85rem',
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: 'var(--text-dark)',
                    }}
                  >
                    Post anonymously
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.75rem',
                      color: 'var(--text-light)',
                    }}
                  >
                    {showMyName
                      ? 'The transport team will see your name.'
                      : 'Your name is hidden from other passengers, but the transport team will see it with an "Anonymous" badge.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!showMyName}
                  aria-label="Post anonymously"
                  onClick={() => setShowMyName((v) => !v)}
                  style={{
                    width: '46px',
                    height: '26px',
                    borderRadius: '20px',
                    border: 'none',
                    padding: '3px',
                    display: 'flex',
                    justifyContent: showMyName ? 'flex-end' : 'flex-start',
                    background: showMyName ? '#28a745' : 'var(--primary-blue)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'white',
                      display: 'block',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    }}
                  />
                </button>
              </div>

              <textarea
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                placeholder="What's the issue? (e.g. Bus is overcrowded, Rash driving...)"
                rows={4}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  fontSize: '1rem',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-dark)',
                }}
                required
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => triggerFileInput('photo')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor:
                        mediaType === 'photo' ? '#e6f0fa' : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-dark)',
                    }}
                  >
                    <ImageIcon size={18} color="var(--primary-blue)" />{' '}
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Photo
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput('video')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor:
                        mediaType === 'video' ? '#fdeced' : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-dark)',
                    }}
                  >
                    <Video size={18} color="#cf1322" />{' '}
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Video
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput('audio')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor:
                        mediaType === 'audio' ? '#fff0e6' : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-dark)',
                    }}
                  >
                    <Mic size={18} color="var(--secondary-orange)" />{' '}
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Audio
                    </span>
                  </button>
                </div>
                {mediaFile && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--primary-blue)',
                      fontWeight: 'bold',
                      wordBreak: 'break-all',
                    }}
                  >
                    {mediaFile.name.length > 15
                      ? mediaFile.name.substring(0, 15) + '...'
                      : mediaFile.name}
                  </span>
                )}
              </div>
              <input
                type="file"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              <button
                type="submit"
                disabled={isUploading}
                className="btn btn-primary"
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  fontSize: '1.1rem',
                  marginTop: '0.5rem',
                  opacity: isUploading ? 0.7 : 1,
                }}
              >
                {isUploading ? 'Posting...' : 'Post Complaint'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
