import { useState, useEffect, useRef } from 'react';
import { Users, MapPin, LogOut, Settings, Bell, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus, Navigation, X, User, Menu, Eye, Download, Upload, GitMerge, Undo2, Sparkles, AlertTriangle, ArrowRight, History, Layers, Wrench, Timer, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import { BACKEND_URL, SOCKET_URL } from '../config';
import '../index.css';
import HamburgerMenu from '../components/HamburgerMenu';
import UserAvatar from '../components/UserAvatar';
import Papa from 'papaparse';
import { sanitizePayload, normalizeFeeStatus, USER_PAYLOAD_KEYS, formatSosTime } from '../lib/utils';
import { friendlyError } from '../lib/errors';
import { ComplaintSkeleton, RouteSkeleton, UserRowSkeleton } from '../components/ui/skeleton';
import UnifiedMap from '../components/UnifiedMap';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate';


// Grievance lifecycle states, mirroring the backend enum.
const GRIEVANCE_STATUS = {
  pending:      { label: 'Pending',                   bg: '#fff1f0', color: '#cf1322', Icon: AlertTriangle },
  in_progress:  { label: 'In Progress',               bg: '#fff7e6', color: '#d46b08', Icon: Wrench },
  resolved:     { label: 'Awaiting Confirmation',     bg: '#e6f4ff', color: '#0958d9', Icon: Timer },
  reopened:     { label: 'Not Resolved (Reopened)',   bg: '#fff1f0', color: '#cf1322', Icon: RotateCcw },
  closed:       { label: 'Closed - Confirmed',        bg: '#e6fae6', color: '#28a745', Icon: CheckCircle2 },
};

const TransportInchargeDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useLang();

  const formatTime = (createdAtStr) => {
    if (!createdAtStr) return 'Just now';
    const date = new Date(createdAtStr);
    if (isNaN(date.getTime())) return createdAtStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const [activeTab, setActiveTab] = useState('overview'); // overview, routes, users, grievances
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  // Grievance triage state
  const [grievanceFilter, setGrievanceFilter] = useState('all');
  const [grievanceBusy, setGrievanceBusy] = useState(new Set());
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  // Data Fetching with Stale-While-Revalidate
  const {
    data: routesData,
    isLoading: routesLoading,
    refetch: refetchRoutes,
  } = useStaleWhileRevalidate('/api/routes', {
    cacheKey: 'admin:routes',
    staleTime: 60000,
    token: user?.token,
    onData: (data) => {
      setRoutesList(data);
      setSelectedRoute((prev) => {
        if (prev === '1' && data.length > 0) {
          return String(data[0].routeId || data[0].route_id);
        }
        return prev;
      });
    },
  });

  const {
    data: grievancesData,
    isLoading: grievancesLoading,
    refetch: refetchGrievances,
  } = useStaleWhileRevalidate('/api/admin/grievances', {
    cacheKey: 'admin:grievances',
    staleTime: 30000,
    token: user?.token,
    onData: (data) => setGrievances(data),
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useStaleWhileRevalidate('/api/users', {
    cacheKey: 'admin:users',
    staleTime: 60000,
    token: user?.token,
    onData: (data) => setUsersList(data),
  });

  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useStaleWhileRevalidate('/api/attendance', {
    cacheKey: 'admin:attendance',
    staleTime: 30000,
    token: user?.token,
    onData: (data) => setAttendanceLogs(data),
  });

  const {
    data: activeMergesData,
    refetch: refetchActiveMerges,
  } = useStaleWhileRevalidate('/api/merge/active', {
    cacheKey: 'admin:merges:active',
    staleTime: 30000,
    token: user?.token,
    onData: (data) => setActiveMerges(data),
  });

  const {
    data: mergeSuggestionsData,
    refetch: refetchMergeSuggestions,
  } = useStaleWhileRevalidate('/api/merge/suggestions', {
    cacheKey: 'admin:merges:suggestions',
    staleTime: 60000,
    token: user?.token,
    onData: (data) => setMergeSuggestions(data),
  });

  const {
    data: mergeHistoryData,
    refetch: refetchMergeHistory,
  } = useStaleWhileRevalidate('/api/merge/history', {
    cacheKey: 'admin:merges:history',
    staleTime: 60000,
    token: user?.token,
    onData: (data) => setMergeHistory(data),
  });

  const {
    data: sosData,
    isLoading: sosLoading,
    refetch: refetchSos,
  } = useStaleWhileRevalidate('/api/sos/active', {
    cacheKey: 'admin:sos:active',
    staleTime: 10000,
    token: user?.token,
    onData: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        const formatted = data.map((alert) => ({
          ...alert,
          time: formatSosTime(alert.timestamp, alert.time),
        }));
        setSosAlerts(formatted);
      }
    },
  });

  const hasCachedData = routesData || grievancesData || usersData || attendanceData || activeMergesData || mergeSuggestionsData || mergeHistoryData || sosData;
  const isLoading = !hasCachedData && (routesLoading || grievancesLoading || usersLoading || attendanceLoading || sosLoading);

  // User Management
  const [userFilter, setUserFilter] = useState('driver'); // 'driver' or 'passenger'
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', login_id: '', password: '', role: 'driver', subject: '', phone: '', route_id: '', fee_status: 'paid', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', dob: '', address: '', gradeClass: '' });
  const [viewingUser, setViewingUser] = useState(null);

  // Route Management
  const [routesList, setRoutesList] = useState([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [viewingRouteDetails, setViewingRouteDetails] = useState(null);
  const [routeFormData, setRouteFormData] = useState({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly', vehicleModel: '', registrationNumber: '', seatingCapacity: '', insuranceExpiry: '' });
  const [routeSearchQuery, setRouteSearchQuery] = useState('');

  // Fleet Tracking
  const [selectedRoute, setSelectedRoute] = useState('1');
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [isBusActive, setIsBusActive] = useState(false);
  const [busTelemetry, setBusTelemetry] = useState(null);
  const selectedRouteRef = useRef(selectedRoute);
  // The socket effect closes over the token; a ref keeps it in sync without
  // tearing down and re-creating the socket on every token change.
  const tokenRef = useRef(user?.token);
  useEffect(() => { tokenRef.current = user?.token; }, [user?.token]);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  // Global Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Analytics
  const [selectedRouteAnalytics, setSelectedRouteAnalytics] = useState('All');

  // Merge & Cancel State
  const [activeMerges, setActiveMerges] = useState([]);
  const [mergeHistory, setMergeHistory] = useState([]);
  const [mergeSuggestions, setMergeSuggestions] = useState([]);
  const [mergeFormData, setMergeFormData] = useState({
    cancelled_route_id: '',
    target_route_id: '',
    reason: 'low_attendance',
    notes: '',
    mode: 'merge', // 'merge' or 'cancel'
  });
  const [isMerging, setIsMerging] = useState(false);
  const [selectedMergeCity, setSelectedMergeCity] = useState('All');

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ti_seen_notif_ids') || '[]'); } 
    catch { return []; }
  });

  // Media Modal State
  const [fullScreenMedia, setFullScreenMedia] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Flag unread notifications in an effect rather than during render.
  useEffect(() => {
    if (showNotifications) return;
    const allNotificationIds = [
      ...sosAlerts.map(alert => `sos-${alert.id}`),
      ...grievances.filter(g => g.status === 'pending').map(g => `grievance-${g.id}`)
    ];
    const hasNew = allNotificationIds.some((id) => !seenIds.includes(id));
    if (hasNew) {
      setHasUnread(true);
    }
  }, [sosAlerts, grievances, seenIds, showNotifications]);

  useEffect(() => {
    if (!user?.token) return;
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: user.token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Transport Incharge connected to socket server');
      socket.emit('join_admin', { token: user.token });
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error (Transport):', err.message);
    });

    socket.on('sos_alert', (data) => {
      const alertTime = formatSosTime(data.timestamp, data.time);
      const newAlert = {
        id: `${data.login_id}-${data.timestamp || data.time}`,
        route: data.route,
        passenger: data.passenger,
        login_id: data.login_id,
        time: alertTime,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setSosAlerts(prev => {
        if (prev.some((a) => a.login_id === newAlert.login_id && (a.timestamp === newAlert.timestamp || a.time === newAlert.time))) {
          return prev;
        }
        return [newAlert, ...prev];
      });
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
        audio.play().catch(() => {});
      } catch (e) { }
    });

    socket.on('sos_cancelled', (data) => {
      setSosAlerts(prev => prev.filter(alert => alert.login_id !== data.login_id));
    });

    socket.on('live_attendance', (data) => {
      let displayName = data.name || data.passenger_name || 'Unknown Passenger';
      const newRecord = { name: displayName, route: data.route_id || 'Unknown', time: new Date().toLocaleTimeString() };
      setLiveAttendance(prev => [newRecord, ...prev].slice(0, 10));
    });

    socket.on('live_telemetry', (data) => {
      if (data.route_id && String(data.route_id) !== String(selectedRouteRef.current)) return;
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
        setIsBusActive(true);
      }
      if (data.speed !== undefined || data.heading !== undefined || data.comfort !== undefined) {
        setBusTelemetry({
          speed: data.speed || 0,
          heading: data.heading || 0,
          comfort: data.comfort || 'Smooth',
          lastUpdated: new Date().toISOString()
        });
      }
    });

    socket.on('merge_executed', (data) => {
      toast.success(`Bus Merge Active: ${data.cancelledRoute?.routeName || 'Route'} merged into ${data.targetRoute?.routeName || 'Route'}`, { id: 'merge_exec' });
      setActiveMerges(prev => [data.mergeEvent, ...prev.filter(m => m.id !== data.mergeEvent?.id)]);
    });

    socket.on('merge_undone', (data) => {
      toast.success(`Bus Merge Restored: ${data.merge?.cancelledRouteName || 'Route'} is active again`, { id: 'merge_undone' });
      setActiveMerges(prev => prev.filter(m => m.id !== data.merge?.id));
    });

    setSocketInstance(socket);
    return () => socket.disconnect();
  }, [user?.token]);

  useEffect(() => {
    if (socketInstance) {
      socketInstance.emit('join_route', { route_id: selectedRoute });
      setIsBusActive(false);
      setBusTelemetry(null);
    }
  }, [selectedRoute, socketInstance]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleExecuteMerge = async (e) => {
    e?.preventDefault();
    if (!mergeFormData.cancelled_route_id) {
      return toast.error('Please select a bus to cancel.');
    }

    if (mergeFormData.mode === 'merge' && !mergeFormData.target_route_id) {
      return toast.error('Please select a target bus to merge students into.');
    }

    const cancelledR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.cancelled_route_id));

    if (mergeFormData.mode === 'merge') {
      const targetR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.target_route_id));
      if (mergeFormData.cancelled_route_id === mergeFormData.target_route_id) {
        return toast.error('Cannot merge a bus into itself.');
      }
      if (!window.confirm(`Are you sure you want to cancel ${cancelledR?.routeName || 'Route'} (Bus ${cancelledR?.busNumber || cancelledR?.bus_number}) and merge students into ${targetR?.routeName || 'Route'} (Bus ${targetR?.busNumber || targetR?.bus_number})?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to CANCEL ${cancelledR?.routeName || 'Route'} (Bus ${cancelledR?.busNumber || cancelledR?.bus_number}) with NO replacement bus? All students on this route will be unable to board today.`)) {
        return;
      }
    }

    setIsMerging(true);
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      if (mergeFormData.mode === 'merge') {
        const res = await axios.post(`${BACKEND_URL}/api/merge`, mergeFormData, authHeaders);
        if (res.data.status === 'success') {
          toast.success(res.data.message || 'Bus merged successfully!');
          if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
        }
      } else {
        const { target_route_id, ...cancelData } = mergeFormData;
        const res = await axios.post(`${BACKEND_URL}/api/merge/cancel`, cancelData, authHeaders);
        if (res.data.status === 'success') {
          toast.success(res.data.message || 'Bus cancelled successfully!');
          if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
        }
      }

      setMergeFormData({ cancelled_route_id: '', target_route_id: '', reason: 'low_attendance', notes: '', mode: 'merge' });
      await Promise.all([
        refetchActiveMerges(),
        refetchMergeSuggestions(),
        refetchMergeHistory(),
      ]);
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to process bus operation'));
    } finally {
      setIsMerging(false);
    }
  };

  const handleUndoMerge = async (mergeId) => {
    if (!window.confirm('Are you sure you want to undo this merge and restore the original bus route?')) return;
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      const res = await axios.post(`${BACKEND_URL}/api/merge/${mergeId}/undo`, {}, authHeaders);
      if (res.data.status === 'success') {
        toast.success(res.data.message || 'Merge undone successfully!');
        await Promise.all([
          refetchActiveMerges(),
          refetchMergeSuggestions(),
          refetchMergeHistory(),
        ]);
      }
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to undo merge'));
    }
  };

  const handleQuickMergeFromSuggestion = (cancelledId, targetId) => {
    setMergeFormData({
      cancelled_route_id: String(cancelledId),
      target_route_id: String(targetId),
      reason: 'low_attendance',
      notes: 'Auto-suggested merge due to low attendance',
    });
    setActiveTab('merge');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResolveGrievance = async (id) => {
    setGrievanceBusy((prev) => new Set([...prev, id]));
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/resolve`,
        { note: 'Marked as fixed by the transport team.' },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      setGrievances((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, status: 'resolved', dueAt: res.data?.data?.dueAt }
            : g,
        ),
      );
      await refetchGrievances();
      toast.success(
        'Marked as fixed. The complaint stays open until the complainant confirms it.',
      );
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to resolve complaint'));
    } finally {
      setGrievanceBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /** Acknowledge the complaint and start work on it. */
  const handleStartGrievance = async (id) => {
    setGrievanceBusy((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/start`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      setGrievances((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: 'in_progress' } : g)),
      );
      await refetchGrievances();
      toast.success('Marked as in progress. The complainant has been notified.');
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to update complaint'));
    } finally {
      setGrievanceBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /** Give the complainant 24 more hours to confirm the fix. */
  const handleExtendGrievance = async (id) => {
    setGrievanceBusy((prev) => new Set([...prev, id]));
    try {
      await axios.patch(
        `${BACKEND_URL}/api/grievance/${id}/extend`,
        { hours: 24 },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      await refetchGrievances();
      toast.success('Confirmation window extended by 24 hours.');
    } catch (err) {
      toast.error(friendlyError(err, 'Failed to extend deadline'));
    } finally {
      setGrievanceBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteUser = async (login_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/users/${login_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setUsersList((prev) => prev.filter((u) => u.loginId !== login_id));
      await refetchUsers();
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error(friendlyError(err, "Failed to delete user"));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    // Client-side validation
    if (!userFormData.name?.trim() || userFormData.name.trim().length < 2)
      return toast.error('Driver name must be at least 2 characters.');
    if (!userFormData.login_id?.trim() || /\s/.test(userFormData.login_id))
      return toast.error('Login ID must not contain spaces.');
    if (!editingUser && (!userFormData.password || userFormData.password.length < 6))
      return toast.error('Password must be at least 6 characters.');
    if (userFormData.phone && !/^[0-9]{10}$/.test(userFormData.phone.replace(/[\s+\-]/g, '')))
      return toast.error('Phone number must be 10 digits.');

    if (userFormData.role === 'passenger' && !userFormData.route_id)
      return toast.error('Route is required for passengers.');

    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      // The API rejects unknown properties and empty date/number fields, so
      // only send the keys the endpoint accepts.
      const payload = sanitizePayload(
        { ...userFormData, fee_status: normalizeFeeStatus(userFormData.fee_status) },
        USER_PAYLOAD_KEYS,
      );
      if (editingUser) {
        if (!payload.password) delete payload.password;
        await axios.put(`${BACKEND_URL}/api/users/${editingUser.loginId || editingUser.login_id}`, payload, authHeaders);
        toast.success("User updated successfully!");
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, payload, authHeaders);
        toast.success("User created successfully!");
      }
      setShowUserModal(false);
      await refetchUsers();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to save user"));
    }
  };

  const [bulkUploadData, setBulkUploadData] = useState([]);
  const [bulkUploadErrors, setBulkUploadErrors] = useState([]);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        const errors = [];
        const validatedData = [];
        
        data.forEach((row, index) => {
          const rowNum = index + 2;
          if (!row.name?.trim()) errors.push(`Row ${rowNum}: Name is required`);
          if (!row.login_id?.trim()) errors.push(`Row ${rowNum}: Login ID is required`);
          if (!row.route_id?.trim()) errors.push(`Row ${rowNum}: Route ID is required`);
          
          if (row.name && row.login_id && row.route_id) {
            validatedData.push({
              name: row.name.trim(),
              login_id: row.login_id.trim(),
              password: row.password?.trim() || 'Invertis@123',
              role: row.role?.trim() || 'passenger',
              route_id: row.route_id.trim(),
              fee_status: normalizeFeeStatus(row.fee_status),
              phone: row.phone?.trim() || '',
              parentName: row.parentName?.trim() || '',
              parentPhone: row.parentPhone?.trim() || '',
              dob: row.dob?.trim() || '',
              bloodGroup: row.bloodGroup?.trim() || '',
              address: row.address?.trim() || '',
              gradeClass: row.gradeClass?.trim() || ''
            });
          }
        });
        
        setBulkUploadData(validatedData);
        setBulkUploadErrors(errors);
        setShowBulkUploadModal(true);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
    e.target.value = null;
  };

  const handleBulkUploadSubmit = async () => {
    if (bulkUploadData.length === 0) return toast.error("No valid data to upload");
    
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      const res = await axios.post(`${BACKEND_URL}/api/users/bulk`, { users: bulkUploadData }, authHeaders);
      
      const { successful, failed, errors } = res.data.results;
      if (failed > 0) {
        toast.error(`Imported ${successful}. ${failed} failed.`);
      } else {
        toast.success(`Successfully imported ${successful} users!`);
      }
      
      setShowBulkUploadModal(false);
      setBulkUploadData([]);
      setBulkUploadErrors([]);
      await refetchUsers();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to process bulk upload"));
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({ name: '', login_id: '', password: '', role: userFilter, subject: '', phone: '', route_id: '', fee_status: 'paid', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', dob: '', address: '', gradeClass: '' });
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({ name: u.name, login_id: u.loginId || u.login_id, password: '', role: u.role, subject: u.subject || '', phone: u.phone || '', route_id: u.routeId || u.route_id || '', fee_status: u.feeStatus || u.fee_status || 'paid', licenseNumber: u.licenseNumber || '', licenseExpiry: u.licenseExpiry ? new Date(u.licenseExpiry).toISOString().split('T')[0] : '', experienceYears: u.experienceYears || '', bloodGroup: u.bloodGroup || '', parentName: u.parentName || '', parentPhone: u.parentPhone || '', dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '', address: u.address || '', gradeClass: u.gradeClass || '' });
    setShowUserModal(true);
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    // Client-side validation
    if (!routeFormData.route_id?.trim()) return toast.error('Route ID is required.');
    if (!routeFormData.route_name?.trim()) return toast.error('Route name is required.');
    if (!routeFormData.bus_number?.trim()) return toast.error('Bus number is required.');
    if (!routeFormData.stops?.trim()) return toast.error('At least one stop is required.');

    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      if (editingRoute) {
        await axios.put(`${BACKEND_URL}/api/routes/${editingRoute.routeId || editingRoute.route_id}`, routeFormData, authHeaders);
      } else {
        await axios.post(`${BACKEND_URL}/api/routes`, routeFormData, authHeaders);
      }
      setShowRouteModal(false);
      await refetchRoutes();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to save route"));
    }
  };

  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteFormData({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly', vehicleModel: '', registrationNumber: '', seatingCapacity: '', insuranceExpiry: '' });
    setShowRouteModal(true);
  };

  const openEditRoute = (r) => {
    setEditingRoute(r);
    setRouteFormData({
      route_id: r.routeId || r.route_id || '',
      route_name: r.routeName || r.route_name || '',
      bus_number: r.busNumber || r.bus_number || '',
      driver_id: r.driverId || r.driver_id || '',
      stops: r.stops || '',
      city: r.city || 'Bareilly',
      vehicleModel: r.vehicleModel || '',
      registrationNumber: r.registrationNumber || '',
      seatingCapacity: r.seatingCapacity || '',
      insuranceExpiry: r.insuranceExpiry ? new Date(r.insuranceExpiry).toISOString().split('T')[0] : ''
    });
    setShowRouteModal(true);
  };

  const handleDeleteRoute = async (route_id) => {
    if (!window.confirm("Delete this route?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/routes/${route_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      await refetchRoutes();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to delete route"));
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/broadcast`, {
        title: 'Transport Notice',
        message: broadcastMessage,
        sender: user?.name || 'Transport Incharge'
      }, { headers: { Authorization: `Bearer ${user?.token}` } });
      toast.success('Broadcast sent!');
      setBroadcastMessage('');
    } catch (err) {
      toast.error(friendlyError(err, "Failed to send broadcast"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="z-50 sticky top-0" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)', padding: '0.6rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ height: '36px', padding: '3px 8px', borderRadius: '10px', backgroundColor: 'white', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <img src="/logo.png" alt="Invertis University" style={{ height: '100%', width: 'auto', maxHeight: '28px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-dark)', lineHeight: 1.2, margin: 0 }}>Transport <span style={{ color: '#28a745' }}>Incharge</span></h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: '500', margin: 0 }}>Welcome, {user?.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="relative">
            {(() => {
              const allNotifications = [
                ...sosAlerts.map(alert => ({
                  id: `sos-${alert.id}`,
                  type: 'sos',
                  title: `SOS Alert - Route ${alert.route} (Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(alert.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(alert.route))?.bus_number || 'Unknown'})`,
                  message: `${alert.passenger} (ID: ${alert.login_id}) initiated SOS at ${formatSosTime(alert.timestamp, alert.time)}.`,
                  time: formatSosTime(alert.timestamp, alert.time),
                  icon: <AlertOctagon size={20} color="#cf1322" className="shrink-0 mt-0.5" />,
                  bg: '#fff1f0', borderColor: '#cf1322', textTitle: '#cf1322', textDesc: '#a8071a'
                })),
                ...grievances.filter(g => g.status === 'pending').map(g => ({
                  id: `grievance-${g.id}`,
                  type: 'grievance',
                  title: `New Complaint (Route ${g.route} - Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.bus_number || 'Unknown'})`,
                  message: (g.isAnonymous ? '🕵️ Anonymous complaint: ' : '') + g.text.substring(0, 60) + (g.text.length > 60 ? '...' : ''),
                  time: formatTime(g.createdAt),
                  icon: <MessageSquare size={20} color="#d97706" className="shrink-0 mt-0.5" />,
                  bg: '#fffbeb', borderColor: '#f59e0b', textTitle: '#d97706', textDesc: '#b45309'
                }))
              ];

              return (
                <>
                  <button 
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications) {
                        setHasUnread(false);
                        const newIds = allNotifications.map(n => n.id);
                        setSeenIds(newIds);
                        localStorage.setItem('ti_seen_notif_ids', JSON.stringify(newIds));
                      }
                    }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: hasUnread ? 'red' : 'var(--text-light)', position: 'relative' }} 
                    className={`hover:text-slate-800 transition-colors ${hasUnread ? 'animate-bell-ring' : ''}`}
                  >
                    <Bell size={24} />
                    {hasUnread && (
                      <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', backgroundColor: 'red', borderRadius: '50%', border: '2px solid white', animation: 'pulse 1.5s infinite' }}></span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute top-12 right-0 w-80 sm:w-96 shadow-2xl rounded-2xl p-4 z-50 animate-fade-in" style={{ backgroundColor: 'var(--white)', border: '1px solid var(--border-color)' }}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold m-0" style={{ color: 'var(--text-dark)' }}>
                          Notifications {allNotifications.length > 0 && `(${allNotifications.length})`}
                        </h3>
                        <button onClick={() => setShowNotifications(false)} className="bg-transparent border-none cursor-pointer p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <X size={20} style={{ color: 'var(--text-light)' }} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto hide-scrollbar">
                        {allNotifications.length > 0 ? (
                          allNotifications.map(notification => (
                            <div key={notification.id} className="p-3 rounded-xl flex gap-3 items-start" style={{ backgroundColor: notification.bg, border: `1px solid ${notification.borderColor}` }}>
                              {notification.icon}
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start gap-2">
                                  <p className="m-0 text-sm font-bold truncate" style={{ color: notification.textTitle }}>{notification.title}</p>
                                  <span className="text-[10px] whitespace-nowrap mt-0.5" style={{ color: notification.textDesc }}>{notification.time}</span>
                                </div>
                                <p className="m-0 text-xs mt-1 leading-relaxed" style={{ color: notification.textDesc }}>{notification.message}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6" style={{ color: 'var(--text-light)' }}>
                            <Bell size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="m-0 text-sm font-medium">No new notifications</p>
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
              <UserAvatar
                src={user?.profile_pic}
                name={user?.name}
                size={36}
                className="border-2 border-transparent"
              />
            </button>
            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-1">
                
                {/* User Info Header */}
                <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <UserAvatar
                    src={user?.profile_pic}
                    name={user?.name}
                    size={48}
                    className="ring-2 ring-white dark:ring-slate-800 shadow-sm"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{user?.name || 'Transport Incharge'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email || user?.login_id || 'incharge@bussarthi.com'}</span>
                  </div>
                </div>

                <button onClick={() => { setShowProfileMenu(false); navigate('/profile'); }} className="w-full text-left px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 border-none bg-transparent cursor-pointer flex items-center gap-3 transition-colors">
                  <User size={18} className="text-blue-500" />
                  My Profile
                </button>
                <button onClick={() => { setShowProfileMenu(false); navigate('/settings'); }} className="w-full text-left px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 border-none bg-transparent cursor-pointer flex items-center gap-3 transition-colors">
                  <Settings size={18} className="text-slate-500" />
                  Settings & Preferences
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-4 py-2.5 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 border-none bg-transparent cursor-pointer flex items-center gap-3 transition-colors">
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MOBILE MENU TRIGGER */}
          <button 
            className="bg-transparent border border-slate-200 dark:border-slate-700 cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center lg:hidden"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={22} className="text-slate-700 dark:text-slate-300" />
          </button>
        </div>
      </header>

      {/* Hamburger Menu (Mobile Sidebar) */}
      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Tabs */}
      <div className="px-main" style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          {[
            { id: 'overview', icon: <MapPin size={16} />, label: 'Fleet & Tracking', color: '#0066cc', bg: '#e6f0fa' },
            { id: 'merge', icon: <GitMerge size={16} />, label: 'Merge & Cancel', color: '#e67e22', bg: '#fef3e2' },
            { id: 'routes', icon: <Navigation size={16} />, label: 'Manage Routes', color: '#28a745', bg: '#e6fae6' },
            { id: 'users', icon: <Users size={16} />, label: 'Users', color: '#7c3aed', bg: '#f3e8ff' },
            { id: 'grievances', icon: <MessageSquare size={16} />, label: 'Complaints', color: '#cf1322', bg: '#fff1f0' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', padding: activeTab === tab.id ? '0.55rem 1.1rem' : '0.55rem 1rem', borderRadius: '50px', border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid var(--border-color)', backgroundColor: activeTab === tab.id ? tab.bg : 'var(--white)', color: activeTab === tab.id ? tab.color : 'var(--text-light)', fontWeight: activeTab === tab.id ? '700' : '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === tab.id ? `0 2px 10px ${tab.color}33` : 'var(--shadow)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: activeTab === tab.id ? tab.color : 'var(--bg-color)', color: activeTab === tab.id ? 'white' : 'var(--text-light)' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="p-main pb-24" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {sosAlerts.length > 0 && (
          <div className="animate-slide-up" style={{ backgroundColor: '#fff1f0', border: '2px solid #cf1322', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><AlertOctagon size={28} color="#cf1322" className="animate-pulse" />
              <div>
                <h3 style={{ color: '#cf1322', fontWeight: 'bold', margin: 0 }}>ACTIVE SOS ALERT</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#a8071a', fontWeight: '600' }}>Route {sosAlerts[0].route} (Bus {routesList.find(r => String(r.routeId || r.route_id) === String(sosAlerts[0].route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(sosAlerts[0].route))?.bus_number || 'Unknown'}) • Driver: {usersList.find(u => (u.loginId || u.login_id) === routesList.find(r => String(r.routeId || r.route_id) === String(sosAlerts[0].route))?.driverId)?.name || 'Unknown'}</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#a8071a' }}>
                  Initiated by {sosAlerts[0].passenger} (ID: {sosAlerts[0].login_id}) • {formatSosTime(sosAlerts[0].timestamp, sosAlerts[0].time)}{sosAlerts[0].timestamp ? ` (${formatTime(sosAlerts[0].timestamp)})` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                const studentLoginId = sosAlerts[0].login_id;
                try {
                  await axios.post(`${BACKEND_URL}/api/sos/cancel`, { login_id: studentLoginId }, {
                    headers: { Authorization: `Bearer ${user?.token}` }
                  });
                  setSosAlerts([]);
                  toast.success('SOS alert cancelled for the student');
                } catch (err) {
                  toast.error('Failed to cancel SOS. Please try again.');
                }
              }}
              style={{ background: '#cf1322', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Cancel SOS for Student
            </button>
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass animate-slide-up flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-5 sm:p-6 rounded-3xl mb-2 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl shrink-0">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">Live Fleet Tracking</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 m-0 mt-1">Select a route to monitor its real-time location</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full lg:w-auto mt-2 lg:mt-0">
                <span className="font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">Select Bus: </span>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="w-full sm:w-auto min-w-[200px] p-2.5 rounded-xl border-2 border-blue-500/30 dark:border-blue-500/50 hover:border-blue-500 dark:hover:border-blue-400 font-bold outline-none cursor-pointer text-ellipsis overflow-hidden bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all shadow-sm focus:ring-4 focus:ring-blue-500/20"
                >
                  {routesList.map(r => {
                    const rId = String(r.routeId || r.route_id);
                    const isCancelled = activeMerges.find(m => String(m.cancelledRouteId) === rId);
                    const isTarget = activeMerges.find(m => String(m.targetRouteId) === rId);
                    let label = `${r.routeName || r.route_name} (${r.busNumber || r.bus_number})`;
                    if (isCancelled) label += ` [CANCELLED ➔ Bus ${isCancelled.targetBusNumber || 'Merged'}]`;
                    else if (isTarget) label += ` [MERGED +${isTarget.studentsMoved || 0} students]`;
                    return (
                      <option key={rId} value={rId} disabled={!!isCancelled}>
                        {label}
                      </option>
                    );
                  })}
                  {routesList.length === 0 && <option value="1">No Routes Found</option>}
                </select>
              </div>
            </div>
            
            <div className="glass animate-slide-up" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: '#e6fae6', border: '2px solid #28a745' }}>
              <div style={{ backgroundColor: '#28a745', padding: '1rem', borderRadius: '50%', color: 'white' }}><Bell size={32} /></div>
              <div style={{ flex: '1 1 200px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#155724', fontWeight: 'bold' }}>Broadcast Notice</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>Send message to all passengers.</p>
              </div>
              <form onSubmit={handleBroadcast} style={{ flex: '2 1 300px', display: 'flex', gap: '1rem' }}>
                <input type="text" required placeholder="Type message..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #28a745' }} />
                <button type="submit" disabled={isBroadcasting} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Broadcast</button>
              </form>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div className="glass" style={{ flex: '1 1 280px', borderRadius: '20px', overflow: 'hidden', minHeight: '400px', border: '2px solid var(--primary-blue)' }}>
                <UnifiedMap
                  busLocation={busLocation}
                  routeInfo={routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))}
                  telemetry={busTelemetry}
                  isLive={isBusActive}
                  initialZoom={14}
                  height="100%"
                  minHeight="400px"
                  busLabel={`Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || selectedRoute}`}
                  showFullscreenButton={true}
                  showAutoFollowToggle={true}
                  showRecenterButton={true}
                  showTelemetryPanel={true}
                  showRoutePolyline={true}
                  showDestinationMarker={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* MERGE & CANCEL */}
        {activeTab === 'merge' && (
          <div className="animate-fade-in flex flex-col gap-6">
            {/* Header Banner */}
            <div className="glass p-6 rounded-3xl border border-orange-200 dark:border-orange-900/40 bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-white/70 dark:from-orange-950/20 dark:via-slate-900/60 dark:to-slate-900/70 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-500/20">
                    <GitMerge size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">Bus Merge & Cancel Control</h2>
                      <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                        {activeMerges.length} Active Today
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0 mt-1">
                      Instantly cancel low-attendance buses at collection points (e.g. Bareilly Mod) and transfer students & attendance eligibility to another bus.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Filter City:</span>
                  <select 
                    value={selectedMergeCity} 
                    onChange={(e) => setSelectedMergeCity(e.target.value)}
                    className="bg-transparent border-none font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="All">All Cities</option>
                    {[...new Set(routesList.map(r => r.city || 'Bareilly'))].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Smart Merge Suggestions (If Any) */}
            {mergeSuggestions.length > 0 && (
              <div className="glass p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={20} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 m-0">
                    Smart Suggestions — Low Attendance Detected ({mergeSuggestions.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mergeSuggestions.map((sugg, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 flex justify-between items-center gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                          <span className="text-red-500">{sugg.cancelledRoute?.routeName} (Bus {sugg.cancelledRoute?.busNumber})</span>
                          <ArrowRight size={14} className="text-slate-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">{sugg.targetRoute?.routeName} (Bus {sugg.targetRoute?.busNumber})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0 mt-1">
                          Only {sugg.studentCount || 0} students marked • Target has {sugg.availableSeats || 0} available seats
                        </p>
                      </div>
                      <button
                        onClick={() => handleQuickMergeFromSuggestion(sugg.cancelledRoute?.routeId || sugg.cancelledRoute?.route_id, sugg.targetRoute?.routeId || sugg.targetRoute?.route_id)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                      >
                        <GitMerge size={14} /> Quick Merge
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Merge Builder & Active Merges Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form: Execute Bus Merge */}
              <div className="lg:col-span-7 glass p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <Layers size={20} className="text-orange-500" />
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Initiate Bus Merge</h3>
                </div>

                <form onSubmit={handleExecuteMerge} className="flex flex-col gap-4">
                  {/* Mode Toggle: Merge vs Cancel */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="tiMergeMode"
                        value="merge"
                        checked={mergeFormData.mode === 'merge'}
                        onChange={() => setMergeFormData(prev => ({ ...prev, mode: 'merge', target_route_id: '' }))}
                        className="w-4 h-4 accent-orange-500 border-slate-300"
                      />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <GitMerge size={16} className="text-orange-500" />
                        Merge Students to Another Bus
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="tiMergeMode"
                        value="cancel"
                        checked={mergeFormData.mode === 'cancel'}
                        onChange={() => setMergeFormData(prev => ({ ...prev, mode: 'cancel', target_route_id: '' }))}
                        className="w-4 h-4 accent-red-500 border-slate-300"
                      />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Trash2 size={16} className="text-red-500" />
                        Cancel Bus (No Replacement)
                      </span>
                    </label>
                  </div>

                  {/* Step 1 & 2 Route Selectors */}
                  <div className={`grid grid-cols-1 ${mergeFormData.mode === 'merge' ? 'sm:grid-cols-2' : ''} gap-4`}>
                    {/* Source: Bus to Cancel */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center justify-center text-[10px]">1</span>
                        Bus to Cancel:
                      </label>
                      <select
                        required
                        value={mergeFormData.cancelled_route_id}
                        onChange={(e) => setMergeFormData(prev => ({ ...prev, cancelled_route_id: e.target.value }))}
                        className="p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-red-400"
                      >
                        <option value="">Select bus to cancel...</option>
                        {routesList
                          .filter(r => selectedMergeCity === 'All' || (r.city || 'Bareilly') === selectedMergeCity)
                          .filter(r => !activeMerges.some(m => String(m.cancelledRouteId) === String(r.routeId || r.route_id)))
                          .map(r => (
                            <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>
                              {r.routeName || r.route_name} (Bus {r.busNumber || r.bus_number}) • {r.city || 'Bareilly'}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Target: Bus to Merge Into (only in merge mode) */}
                    {mergeFormData.mode === 'merge' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                          Merge Students Into (Target Bus):
                        </label>
                        <select
                          required
                          value={mergeFormData.target_route_id}
                          onChange={(e) => setMergeFormData(prev => ({ ...prev, target_route_id: e.target.value }))}
                          className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-400"
                        >
                          <option value="">Select target bus...</option>
                          {routesList
                            .filter(r => {
                              if (mergeFormData.cancelled_route_id) {
                                const cancelledR = routesList.find(cr => String(cr.routeId || cr.route_id) === String(mergeFormData.cancelled_route_id));
                                if (cancelledR && cancelledR.city) {
                                  return r.city === cancelledR.city && String(r.routeId || r.route_id) !== String(mergeFormData.cancelled_route_id);
                                }
                              }
                              return String(r.routeId || r.route_id) !== String(mergeFormData.cancelled_route_id);
                            })
                            .filter(r => !activeMerges.some(m => String(m.cancelledRouteId) === String(r.routeId || r.route_id)))
                            .map(r => (
                              <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>
                                {r.routeName || r.route_name} (Bus {r.busNumber || r.bus_number}) • Cap: {r.seatingCapacity || 50}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Reason & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason:</label>
                      <select
                        value={mergeFormData.reason}
                        onChange={(e) => setMergeFormData(prev => ({ ...prev, reason: e.target.value }))}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none cursor-pointer"
                      >
                        <option value="low_attendance">Low Passenger Attendance</option>
                        <option value="vehicle_breakdown">Vehicle Breakdown / Puncture</option>
                        <option value="driver_unavailable">Driver Unavailable / Emergency</option>
                        <option value="weather">Inclement Weather</option>
                        <option value="other">Other Operational Reason</option>
                        <option value="bus_cancelled">Bus Cancelled (No Replacement)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Operational Notes (Optional):</label>
                      <input
                        type="text"
                        placeholder="e.g. Bareilly Mod collection point"
                        value={mergeFormData.notes}
                        onChange={(e) => setMergeFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Capacity Calculator Box (Merge mode) */}
                  {mergeFormData.mode === 'merge' && mergeFormData.cancelled_route_id && mergeFormData.target_route_id && (() => {
                    const cancelledR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.cancelled_route_id));
                    const targetR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.target_route_id));
                    const studentCountMoved = usersList.filter(u => u.role === 'passenger' && String(u.routeId || u.route_id) === String(mergeFormData.cancelled_route_id)).length;
                    const targetCurrentCount = attendanceLogs.filter(a => String(a.routeId || a.route_id) === String(mergeFormData.target_route_id)).length;
                    const targetCapacity = targetR?.seatingCapacity || 50;
                    const projectedTotal = targetCurrentCount + studentCountMoved;
                    const isOver = projectedTotal > targetCapacity;

                    return (
                      <div className={`p-4 rounded-2xl border ${isOver ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/20 dark:border-orange-800' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800'} transition-all`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Capacity Simulation:</span>
                          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${isOver ? 'bg-orange-200 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200' : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'}`}>
                            {isOver ? '⚠️ High Load' : '✅ Fits Comfortably'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Moving From Bus</span>
                            <span className="font-extrabold text-red-600">+{studentCountMoved} Students</span>
                          </div>
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Target Present</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{targetCurrentCount} Checked In</span>
                          </div>
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Projected Load</span>
                            <span className={`font-extrabold ${isOver ? 'text-orange-600' : 'text-emerald-600'}`}>
                              {projectedTotal} / {targetCapacity} Seats
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cancellation Warning Box (Cancel mode) */}
                  {mergeFormData.mode === 'cancel' && mergeFormData.cancelled_route_id && (() => {
                    const studentCountMoved = usersList.filter(u => u.role === 'passenger' && String(u.routeId || u.route_id) === String(mergeFormData.cancelled_route_id)).length;
                    return (
                      <div className="p-4 rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Trash2 size={16} className="text-red-500" />
                          <span className="text-xs font-bold text-red-700 dark:text-red-300">Bus Cancellation Warning</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Affected Students</span>
                            <span className="font-extrabold text-red-600">{studentCountMoved} Students</span>
                          </div>
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Replacement Bus</span>
                            <span className="font-extrabold text-red-600">None</span>
                          </div>
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">Action Required</span>
                            <span className="font-extrabold text-red-600">Students stranded</span>
                          </div>
                        </div>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-2 text-center m-0">
                          ⚠️ No replacement bus. Students on this route cannot board any bus today.
                        </p>
                      </div>
                    );
                  })()}

                  <button
                    type="submit"
                    disabled={isMerging || !mergeFormData.cancelled_route_id || (mergeFormData.mode === 'merge' && !mergeFormData.target_route_id)}
                    className={`mt-2 w-full py-3 px-4 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer border-none ${
                      mergeFormData.mode === 'merge'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                    }`}
                  >
                    {mergeFormData.mode === 'merge' ? <GitMerge size={18} /> : <Trash2 size={18} />}
                    {isMerging ? 'Executing...' : (mergeFormData.mode === 'merge' ? 'Execute Bus Merge & Notify Passengers' : 'Cancel Bus & Notify Passengers')}
                  </button>
                </form>
              </div>

              {/* Active Merges Today List */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm flex flex-col gap-4 flex-1">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Active Merges Today</h3>
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      {activeMerges.length} Active
                    </span>
                  </div>

                  {activeMerges.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <GitMerge size={36} className="mx-auto mb-2 opacity-40" />
                      <p className="m-0 text-sm font-semibold">No active merges today</p>
                      <p className="m-0 text-xs mt-1">All bus routes are operating on normal individual schedules.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
                      {activeMerges.map(merge => (
                        <div
                          key={merge.id}
                          className="p-4 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/60 to-white/90 dark:from-slate-800/80 dark:to-slate-800/40 flex flex-col gap-2.5 shadow-sm"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">CANCELLED</span>
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{merge.cancelledRouteName}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {formatTime(merge.mergedAt || merge.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-red-500 font-bold">Bus {merge.cancelledBusNumber || merge.cancelledRouteId}</span>
                            <ArrowRight size={14} className="text-orange-500 shrink-0" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Bus {merge.targetBusNumber || merge.targetRouteId} ({merge.targetRouteName})</span>
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                            <span>Moved: <strong className="text-slate-700 dark:text-slate-200">{merge.studentsMoved || 0} students</strong></span>
                            <span className="capitalize bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-full font-medium">
                              {(merge.reason || 'low_attendance').replace(/_/g, ' ')}
                            </span>
                          </div>

                          <button
                            onClick={() => handleUndoMerge(merge.id)}
                            className="mt-1 w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-200 dark:border-red-800/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Undo2 size={13} /> Undo Merge & Restore Route
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Merge History Table */}
            <div className="glass p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <History size={20} className="text-slate-600 dark:text-slate-300" />
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Merge & Cancellation History</h3>
              </div>

              {mergeHistory.length === 0 ? (
                <p className="text-xs text-slate-400 m-0 py-4 text-center">No historical merge events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date / Time</th>
                        <th className="py-2.5 px-3">Cancelled Bus</th>
                        <th className="py-2.5 px-3">Target Bus</th>
                        <th className="py-2.5 px-3 text-center">Students</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Initiated By</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {mergeHistory.slice(0, 15).map(hist => (
                        <tr key={hist.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatTime(hist.mergedAt || hist.createdAt)}</td>
                          <td className="py-2.5 px-3 font-bold text-red-500">{hist.cancelledRouteName} ({hist.cancelledBusNumber})</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">{hist.targetRouteName} ({hist.targetBusNumber})</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{hist.studentsMoved || 0}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-500">{(hist.reason || 'low_attendance').replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 text-slate-500">{hist.initiatedBy || 'Incharge'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              hist.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                              hist.status === 'undone' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {hist.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTES */}
        {activeTab === 'routes' && (
          <div className="animate-fade-in glass p-glass" style={{ borderRadius: '20px' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Manage Routes</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Search route name, bus, driver..." 
                  value={routeSearchQuery}
                  onChange={(e) => setRouteSearchQuery(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none w-full sm:w-64"
                />
                <button onClick={openAddRoute} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors w-full sm:w-auto whitespace-nowrap">
                  <Plus size={18} /> Add Route
                </button>
              </div>
            </div>
            {isLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <RouteSkeleton key={i} />
                ))}
              </div>
            ) : routesList.length === 0 ? <p>No routes configured yet. Add your first bus route!</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {routesList.filter(r => {
                  if (!routeSearchQuery) return true;
                  const query = routeSearchQuery.toLowerCase();
                  const driverName = usersList.find(u => (u.loginId || u.login_id) === (r.driverId || r.driver_id))?.name || 'Unassigned';
                  return (
                    (r.routeId || r.route_id || '').toLowerCase().includes(query) ||
                    (r.routeName || r.route_name || '').toLowerCase().includes(query) ||
                    (r.busNumber || r.bus_number || '').toLowerCase().includes(query) ||
                    driverName.toLowerCase().includes(query)
                  );
                }).map((r, i) => {
                  const driverName = usersList.find(u => (u.loginId || u.login_id) === (r.driverId || r.driver_id))?.name || 'Unassigned';
                  return (
                    <div key={i} style={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', backgroundColor: 'var(--secondary-orange)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>Route {r.routeId || r.route_id} (Bus {r.busNumber || r.bus_number})</span>
                          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', color: 'var(--text-dark)' }}>{r.routeName || r.route_name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setViewingRouteDetails(r)} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}><Eye size={18} /></button>
                          <button onClick={() => openEditRoute(r)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Edit</button>
                          <button onClick={() => handleDeleteRoute(r.routeId || r.route_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Delete</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-light)' }}>Bus Number:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>{r.busNumber || r.bus_number}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-light)' }}>Assigned Driver:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary-blue)' }}>{driverName}</span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '600' }}>Waypoints:</span>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                          {r.stops || 'No stops defined'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* USERS (DIRECTORY) */}
        {activeTab === 'users' && (
          <div className="animate-fade-in glass p-glass" style={{ borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>User Management</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {userFilter === 'passenger' && (
                  <button onClick={() => setShowBulkUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    <Upload size={18} /> Bulk Upload
                  </button>
                )}
                <button onClick={openAddUser} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#7c3aed', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  <UserPlus size={18} /> Add {userFilter === 'passenger' ? 'Passenger' : 'Driver'}
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={() => setUserFilter('passenger')} style={{ padding: '0.5rem 1.5rem', backgroundColor: userFilter === 'passenger' ? 'var(--primary-blue)' : '#f0f0f0', color: userFilter === 'passenger' ? 'white' : 'var(--text-dark)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Passengers</button>
              <button onClick={() => setUserFilter('driver')} style={{ padding: '0.5rem 1.5rem', backgroundColor: userFilter === 'driver' ? '#28a745' : '#f0f0f0', color: userFilter === 'driver' ? 'white' : 'var(--text-dark)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Drivers</button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3, 4].map((i) => (
                  <UserRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-color)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem' }}>Name</th>
                    <th style={{ padding: '1rem' }}>Login ID</th>
                    <th style={{ padding: '1rem' }}>Route</th>
                    {userFilter === 'driver' && (
                      <th style={{ padding: '1rem' }}>Phone</th>
                    )}
                    {userFilter === 'passenger' && (
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Face Seeded</th>
                    )}
                    <th style={{ padding: '1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.filter(u => u.role === userFilter).map(u => (
                    <tr key={u.id || u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{u.name}</td>
                      <td style={{ padding: '1rem' }}>{u.loginId || u.login_id}</td>
                      <td style={{ padding: '1rem' }}>
                        {(() => {
                          const routeVal = u.routeId || u.route_id || routesList.find(r => (r.driverId || r.driver_id) === (u.loginId || u.login_id))?.routeId || routesList.find(r => (r.driverId || r.driver_id) === (u.loginId || u.login_id))?.route_id;
                          if (!routeVal) return 'Unassigned';
                          const matchedRoute = routesList.find(r => String(r.routeId || r.route_id) === String(routeVal));
                          return matchedRoute ? `Route ${routeVal} (Bus ${matchedRoute.busNumber || matchedRoute.bus_number})` : `Route ${routeVal}`;
                        })()}
                      </td>
                      {userFilter === 'driver' && (
                        <td style={{ padding: '1rem' }}>{u.phone || '-'}</td>
                      )}
                      {userFilter === 'passenger' && (
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {Boolean(u.faceEnrolledAt || u.face_enrolled_at || u.aws_face_id || u.awsFaceId) ? (
                            <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Yes</span>
                          ) : (
                            <span style={{ backgroundColor: '#fff1f0', color: '#cf1322', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>No</span>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setViewingUser(u)} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 'bold' }} title="View Details"><Eye size={18} /></button>
                        <button onClick={() => openEditUser(u)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                        <button onClick={() => handleDeleteUser(u.loginId || u.login_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* GRIEVANCES (ANONYMOUS) */}
        {activeTab === 'grievances' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>Grievance Triage</h2>
            <p style={{ color: 'var(--text-light)', marginTop: 0, marginBottom: '1rem' }}>
              You can see real names of anonymous posters. A complaint only closes when the
              complainant confirms the fix.
            </p>

            {/* Triage filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { key: 'all', label: 'All', count: grievances.length },
                { key: 'reopened', label: 'Not Resolved', count: grievances.filter(g => g.status === 'reopened').length },
                { key: 'pending', label: 'Pending', count: grievances.filter(g => g.status === 'pending').length },
                { key: 'in_progress', label: 'In Progress', count: grievances.filter(g => g.status === 'in_progress').length },
                { key: 'resolved', label: 'Awaiting Confirmation', count: grievances.filter(g => g.status === 'resolved').length },
                { key: 'closed', label: 'Closed', count: grievances.filter(g => g.status === 'closed').length },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setGrievanceFilter(f.key)}
                  style={{
                    padding: '0.35rem 0.8rem', borderRadius: '20px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: '700',
                    border: '1px solid var(--border-color)',
                    backgroundColor: grievanceFilter === f.key ? 'var(--primary-blue)' : 'transparent',
                    color: grievanceFilter === f.key ? 'white' : 'var(--text-dark)',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}
                >
                  {f.label}
                  <span style={{ opacity: 0.75 }}>({f.count})</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <ComplaintSkeleton key={i} style={{ opacity: 1 - i * 0.2 }} />
                ))
              ) : (grievanceFilter === 'all'
                ? grievances
                : grievances.filter(g => g.status === grievanceFilter)
              ).map(comp => {
                const meta = GRIEVANCE_STATUS[comp.status] || GRIEVANCE_STATUS.pending;
                const { Icon } = meta;
                return (
                <div key={comp.id} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: `4px solid ${meta.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      {/* Show real name to Transport Incharge (approved by user) */}
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {comp.realName || 'Anonymous Passenger'}
                        {comp.isAnonymous && (
                          <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '0.15rem 0.4rem', borderRadius: '6px', backgroundColor: '#fff3cd', color: '#856404', whiteSpace: 'nowrap', border: '1px solid #ffeeba' }}>
                            🕵️ Anonymous
                          </span>
                        )}
                        {comp.loginId && <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 'normal' }}>(ID: {comp.loginId})</span>}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        {(() => {
                          const r = routesList.find(x => String(x.routeId || x.route_id) === String(comp.route));
                          const bus = r?.bus?.busNumber || r?.busNumber || comp.busNumber;
                          return `${r?.routeName || `Route ${comp.route}`}${bus ? ` · Bus ${bus}` : ''} • ${formatTime(comp.createdAt)}`;
                        })()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px', backgroundColor: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                        <Icon size={12} /> {meta.label}
                      </span>
                      {comp.reopenCount > 0 && (
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: '#fff1f0', color: '#cf1322' }}>
                          Reopened {comp.reopenCount}x
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '1rem 0 0 0', fontSize: '1rem', overflowWrap: 'anywhere' }}>{comp.text}</p>

                  {comp.adminResponse && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(0,86,179,0.06)', borderLeft: '3px solid var(--primary-blue)', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary-blue)', textTransform: 'uppercase' }}>Response sent to complainant</p>
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem' }}>{comp.adminResponse}</p>
                    </div>
                  )}

                  {/* Media Attachment */}
                  {comp.type === 'photo' && comp.mediaUrl && (
                    <div
                      onClick={() => setFullScreenMedia({ type: 'photo', url: comp.mediaUrl })}
                      style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center', cursor: 'zoom-in' }}
                    >
                      <img src={comp.mediaUrl} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain', transition: 'transform 0.2s' }} />
                    </div>
                  )}
                  {comp.type === 'video' && comp.mediaUrl && (
                    <div
                      onClick={() => setFullScreenMedia({ type: 'video', url: comp.mediaUrl })}
                      style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '24px' }}>
                          ▶
                        </div>
                      </div>
                      <video src={comp.mediaUrl} style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', opacity: 0.8 }} />
                    </div>
                  )}
                  {comp.type === 'audio' && comp.mediaUrl && (
                    <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                      <audio src={comp.mediaUrl} controls style={{ width: '100%' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    {(comp.status === 'pending' || comp.status === 'reopened') && (
                      <button onClick={() => handleStartGrievance(comp.id)} disabled={grievanceBusy.has(comp.id)} style={{ backgroundColor: '#d46b08', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: grievanceBusy.has(comp.id) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Wrench size={16} /> Start Work
                      </button>
                    )}

                    {(comp.status === 'pending' || comp.status === 'in_progress' || comp.status === 'reopened') && (
                      <button onClick={() => handleResolveGrievance(comp.id)} disabled={grievanceBusy.has(comp.id)} style={{ backgroundColor: 'var(--secondary-orange)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: grievanceBusy.has(comp.id) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={16} /> Mark as Fixed
                      </button>
                    )}

                    {comp.status === 'resolved' && (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                          <Timer size={14} /> Waiting for the complainant to confirm
                        </span>
                        <button onClick={() => handleExtendGrievance(comp.id)} disabled={grievanceBusy.has(comp.id)} style={{ backgroundColor: 'transparent', color: 'var(--primary-blue)', border: '1px solid var(--primary-blue)', padding: '0.45rem 0.9rem', borderRadius: '8px', fontWeight: 'bold', cursor: grievanceBusy.has(comp.id) ? 'default' : 'pointer' }}>
                          Extend 24h
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      
      {/* View Route Details Modal */}
      {viewingRouteDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ width: '100%', maxWidth: '600px', borderRadius: '20px', backgroundColor: 'var(--card-bg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">Vehicle & Route Details</h2>
              <button onClick={() => setViewingRouteDetails(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer"><X size={24} /></button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-lg">
                  <Navigation size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">{viewingRouteDetails.routeName || viewingRouteDetails.route_name}</h3>
                  <div className="mt-2 inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Route ID: {viewingRouteDetails.routeId || viewingRouteDetails.route_id}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Bus Number</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingRouteDetails.busNumber || viewingRouteDetails.bus_number || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Assigned Driver</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">
                    {usersList.find(u => (u.loginId || u.login_id) === (viewingRouteDetails.driverId || viewingRouteDetails.driver_id))?.name || 'Unassigned'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Vehicle Model</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingRouteDetails.vehicleModel || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Registration Number</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingRouteDetails.registrationNumber || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Seating Capacity</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingRouteDetails.seatingCapacity ? `${viewingRouteDetails.seatingCapacity} Seats` : 'N/A'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Insurance Expiry</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">
                    {viewingRouteDetails.insuranceExpiry ? new Date(viewingRouteDetails.insuranceExpiry).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Waypoints</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 m-0 leading-relaxed">
                  {viewingRouteDetails.stops || 'No stops defined'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {viewingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass p-glass" style={{ width: '100%', maxWidth: '600px', borderRadius: '20px', backgroundColor: 'var(--card-bg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">User Profile</h2>
              <button onClick={() => setViewingUser(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer"><X size={24} /></button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {viewingUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">{viewingUser.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 m-0 text-sm font-semibold capitalize">{viewingUser.role}</p>
                  <div className="mt-2 inline-block bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-semibold text-slate-600 dark:text-slate-300">
                    ID: {viewingUser.loginId || viewingUser.login_id}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Assigned Route</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">
                    {viewingUser.routeId || viewingUser.route_id || 'Not Assigned'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Phone Number</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.phone || 'N/A'}</p>
                </div>

                {viewingUser.role === 'passenger' && (
                  <>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Fee Status</p>
                      <p className={`font-bold m-0 ${viewingUser.feeStatus === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                        {(viewingUser.feeStatus || viewingUser.fee_status || 'Unpaid').toUpperCase()}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Course</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.gradeClass || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Parent Name</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.parentName || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Parent Phone</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.parentPhone || 'N/A'}</p>
                    </div>
                  </>
                )}

                {viewingUser.role === 'driver' && (
                  <>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">License Number</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.licenseNumber || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Experience</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.experienceYears ? `${viewingUser.experienceYears} Years` : 'N/A'}</p>
                    </div>
                  </>
                )}

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Blood Group</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.bloodGroup || 'N/A'}</p>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Face Seeded (RFID/AI)</p>
                  <p className={`font-bold m-0 ${viewingUser.faceEnrolledAt || viewingUser.face_enrolled_at || viewingUser.aws_face_id || viewingUser.awsFaceId ? 'text-green-600' : 'text-red-500'}`}>
                    {viewingUser.faceEnrolledAt || viewingUser.face_enrolled_at || viewingUser.aws_face_id || viewingUser.awsFaceId ? 'Verified' : 'Not Seeded'}
                  </p>
                </div>
              </div>

              {viewingUser.address && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-1 font-bold uppercase tracking-wider">Address</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 m-0">{viewingUser.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ width: '100%', maxWidth: '800px', borderRadius: '20px', backgroundColor: 'var(--card-bg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
                <Upload className="text-green-600" /> Bulk Upload Passengers
              </h2>
              <button onClick={() => { setShowBulkUploadModal(false); setBulkUploadData([]); setBulkUploadErrors([]); }} className="text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-blue-800 dark:text-blue-300 font-bold m-0 mb-1">Upload CSV File</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-400 m-0">Required columns: name, login_id, route_id</p>
                </div>
                <div className="flex gap-2">
                  <a href={`data:text/csv;charset=utf-8,name,login_id,password,route_id,fee_status,phone,parentName,parentPhone,dob,bloodGroup,address,gradeClass\nJohn Doe,STD001,Pass@123,1,paid,9876543210,Jane Doe,9876543211,2005-05-15,O+,123 Street,B.Tech CS`} download="passenger_template.csv" className="bg-white text-blue-600 border border-blue-600 py-2 px-4 rounded-lg font-bold text-sm cursor-pointer flex items-center gap-2 no-underline hover:bg-blue-50 transition-colors">
                    <Download size={16} /> Template
                  </a>
                  <label className="bg-blue-600 text-white border-none py-2 px-4 rounded-lg font-bold text-sm cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition-colors">
                    <Upload size={16} /> Select CSV
                    <input type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {bulkUploadErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                  <h4 className="text-red-800 dark:text-red-300 font-bold m-0 mb-2">Validation Errors ({bulkUploadErrors.length})</h4>
                  <ul className="text-sm text-red-600 dark:text-red-400 pl-5 m-0 space-y-1 max-h-32 overflow-y-auto">
                    {bulkUploadErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {bulkUploadData.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-slate-800 dark:text-slate-200 font-bold m-0">Ready to Import ({bulkUploadData.length} records)</h4>
                    <button onClick={handleBulkUploadSubmit} className="bg-green-600 hover:bg-green-700 text-white border-none py-2 px-6 rounded-lg font-bold cursor-pointer transition-colors">
                      Import Now
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-60">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400 sticky top-0">
                        <tr>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Login ID</th>
                          <th className="px-4 py-2">Route</th>
                          <th className="px-4 py-2">Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkUploadData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="border-b dark:border-slate-700">
                            <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{row.name}</td>
                            <td className="px-4 py-2">{row.login_id}</td>
                            <td className="px-4 py-2">{row.route_id}</td>
                            <td className="px-4 py-2">{row.gradeClass || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bulkUploadData.length > 50 && (
                      <p className="text-center text-xs text-slate-500 py-2 m-0 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">Showing first 50 records...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{editingUser ? 'Edit User' : 'Add User'}</h3>
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full Name</label>
                <input required type="text" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Login ID</label>
                <input required disabled={!!editingUser} type="text" value={userFormData.login_id} onChange={e => setUserFormData({ ...userFormData, login_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: editingUser ? '#f0f0f0' : 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password {editingUser && '(Leave blank to keep current)'}</label>
                <input required={!editingUser} type="text" value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Role</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <option value="passenger">Student / Passenger</option>
                    <option value="teacher">Teacher / Staff</option>
                    <option value="driver">Driver (Bus Sensor App)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route</label>
                  <select value={userFormData.route_id} onChange={e => setUserFormData({ ...userFormData, route_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                    {routesList.map(r => (
                      <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>Route {r.routeId || r.route_id} - {r.routeName || r.route_name}</option>
                    ))}
                    {routesList.length === 0 && <option value="">No Routes Found</option>}
                  </select>
                </div>
              </div>
              {userFormData.role === 'teacher' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Subject / Department</label>
                  <input type="text" placeholder="e.g. Computer Science" value={userFormData.subject || ''} onChange={e => setUserFormData({ ...userFormData, subject: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              )}
              {userFormData.role === 'passenger' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Fee Status</label>
                      <select value={userFormData.fee_status} onChange={e => setUserFormData({ ...userFormData, fee_status: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partially Paid</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Course</label>
                      <input type="text" placeholder="e.g. B.Tech CS" value={userFormData.gradeClass} onChange={e => setUserFormData({ ...userFormData, gradeClass: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Parent Name</label>
                      <input type="text" value={userFormData.parentName} onChange={e => setUserFormData({ ...userFormData, parentName: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Parent Phone</label>
                      <input type="tel" value={userFormData.parentPhone} onChange={e => setUserFormData({ ...userFormData, parentPhone: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Date of Birth</label>
                      <input type="date" value={userFormData.dob} onChange={e => setUserFormData({ ...userFormData, dob: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Blood Group</label>
                      <input type="text" placeholder="e.g. O+" value={userFormData.bloodGroup} onChange={e => setUserFormData({ ...userFormData, bloodGroup: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Address</label>
                    <textarea rows="2" value={userFormData.address} onChange={e => setUserFormData({ ...userFormData, address: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                  </div>
                </>
              )}
              {userFormData.role === 'driver' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone Number</label>
                      <input type="tel" placeholder="+91 9876543210" value={userFormData.phone} onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Blood Group</label>
                      <input type="text" placeholder="e.g. O+" value={userFormData.bloodGroup} onChange={e => setUserFormData({ ...userFormData, bloodGroup: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>License Number</label>
                      <input type="text" value={userFormData.licenseNumber} onChange={e => setUserFormData({ ...userFormData, licenseNumber: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>License Expiry</label>
                      <input type="date" value={userFormData.licenseExpiry} onChange={e => setUserFormData({ ...userFormData, licenseExpiry: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Experience (Years)</label>
                    <input type="number" min="0" value={userFormData.experienceYears} onChange={e => setUserFormData({ ...userFormData, experienceYears: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                  </div>
                </>
              )}
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>{editingUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Route Modal */}
      {showRouteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{editingRoute ? 'Edit Route' : 'Add Route'}</h3>
            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route ID</label>
                  <input required disabled={!!editingRoute} placeholder="e.g. 1" type="text" value={routeFormData.route_id} onChange={e => setRouteFormData({ ...routeFormData, route_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: editingRoute ? '#f0f0f0' : 'white' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route Name</label>
                  <input required placeholder="e.g. City Station to Campus" type="text" value={routeFormData.route_name} onChange={e => setRouteFormData({ ...routeFormData, route_name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Bus Number</label>
                  <input required placeholder="e.g. UP 14 AB 1234" type="text" value={routeFormData.bus_number} onChange={e => setRouteFormData({ ...routeFormData, bus_number: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Assign Driver</label>
                  <select value={routeFormData.driver_id} onChange={e => setRouteFormData({ ...routeFormData, driver_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <option value="">Select a Driver</option>
                    {usersList.filter(u => u.role === 'driver').map(d => (
                      <option key={d.loginId || d.login_id} value={d.loginId || d.login_id}>{d.name} ({d.loginId || d.login_id})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Vehicle Model</label>
                  <input placeholder="e.g. Tata Marcopolo" type="text" value={routeFormData.vehicleModel} onChange={e => setRouteFormData({ ...routeFormData, vehicleModel: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Registration Number</label>
                  <input placeholder="e.g. UP14AB1234" type="text" value={routeFormData.registrationNumber} onChange={e => setRouteFormData({ ...routeFormData, registrationNumber: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Seating Capacity</label>
                  <input placeholder="e.g. 40" type="number" min="0" value={routeFormData.seatingCapacity} onChange={e => setRouteFormData({ ...routeFormData, seatingCapacity: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Insurance Expiry</label>
                  <input type="date" value={routeFormData.insuranceExpiry} onChange={e => setRouteFormData({ ...routeFormData, insuranceExpiry: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Stops / Waypoints (Comma separated)</label>
                <textarea required placeholder="Civil Lines, DD Puram, University" value={routeFormData.stops} onChange={e => setRouteFormData({ ...routeFormData, stops: e.target.value })} rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', resize: 'none' }} />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button type="button" onClick={() => setShowRouteModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>{editingRoute ? 'Update Route' : 'Save Route'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Screen Media Modal */}
      {fullScreenMedia && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <button onClick={() => { setFullScreenMedia(null); setZoomLevel(1); }} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
          
          {fullScreenMedia.type === 'photo' && (
            <>
              <div style={{ display: 'flex', gap: '1rem', position: 'absolute', top: '20px', left: '20px', zIndex: 10000 }}>
                <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Zoom In +</button>
                <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Zoom Out -</button>
              </div>
              <div style={{ overflow: 'auto', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                  src={fullScreenMedia.url} 
                  alt="Full Screen" 
                  style={{ 
                    maxHeight: '90vh', 
                    maxWidth: '90vw', 
                    objectFit: 'contain', 
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.2s ease-in-out',
                    transformOrigin: 'center'
                  }} 
                />
              </div>
            </>
          )}

          {fullScreenMedia.type === 'video' && (
            <div style={{ width: '90vw', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video 
                src={fullScreenMedia.url} 
                controls 
                autoPlay
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransportInchargeDashboard;
