import { useState, useEffect, useRef } from 'react';
import { Users, MapPin, Shield, LogOut, Settings, Bell, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus, Navigation, Plus, X, User, Menu, Eye, Download, Upload, Activity, GitMerge, Undo2, Sparkles, AlertTriangle, ArrowRight, History, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';
import HamburgerMenu from '../components/HamburgerMenu';
import Papa from 'papaparse';
import { parseApiError } from '../lib/utils';
import WebRTCPlayer from '../components/WebRTCPlayer';

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

// Component to handle map container resizing
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    const ro = new ResizeObserver(() => map.invalidateSize());
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useLang();

  const formatTime = (createdAtStr) => {
    if (!createdAtStr) return 'Just now';
    const date = new Date(createdAtStr);
    if (isNaN(date.getTime())) {
      return createdAtStr; // fallback for badly formatted dates
    }
    
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // State for Navigation
  const [activeTab, setActiveTab] = useState('overview');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // overview, users, grievances

  // State for Data
  const [sosAlerts, setSosAlerts] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Attendance Filters
  const [attFilterCity, setAttFilterCity] = useState('All');
  const [attFilterRoute, setAttFilterRoute] = useState('All');
  const [attFilterDate, setAttFilterDate] = useState(''); // empty = show all

  // User Management Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', login_id: '', password: '', role: 'passenger', route_id: '1', fee_status: 'paid', phone: '', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', parentPassword: '', createParentAccount: false, dob: '', address: '', gradeClass: '' });
  const [userFilter, setUserFilter] = useState('passenger');
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  
  // Bulk Upload State
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadData, setBulkUploadData] = useState([]);
  const [bulkUploadErrors, setBulkUploadErrors] = useState([]);

  // Specific Route Complaints Modal
  const [showRouteComplaintsModal, setShowRouteComplaintsModal] = useState(false);

  // Route Management State
  const [routesList, setRoutesList] = useState([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [viewingRouteDetails, setViewingRouteDetails] = useState(null);
  const [routeFormData, setRouteFormData] = useState({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly', vehicleModel: '', registrationNumber: '', seatingCapacity: '', insuranceExpiry: '' });

  // Fleet Tracking State
  const [selectedRoute, setSelectedRoute] = useState('1');
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [isBusActive, setIsBusActive] = useState(false);
  const telemetryTimeoutRef = useRef(null);
  const selectedRouteRef = useRef(selectedRoute);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  // Global Broadcast State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Analytics State
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
  });
  const [isMerging, setIsMerging] = useState(false);
  const [selectedMergeCity, setSelectedMergeCity] = useState('All');

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_seen_notif_ids') || '[]'); } 
    catch { return []; }
  });

  // Media Modal State
  const [fullScreenMedia, setFullScreenMedia] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    // Connect WebSockets
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Admin connected to socket server');
      socket.emit('join_admin', { token: user?.token });
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error (Admin):', err.message);
    });

    socket.on('sos_alert', (data) => {
      const newAlert = {
        id: Date.now(),
        route: data.route,
        passenger: data.passenger,
        login_id: data.login_id,
        time: new Date().toLocaleTimeString()
      };
      setSosAlerts(prev => [newAlert, ...prev]);
      try { new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play(); } catch (e) { }
    });

    socket.on('sos_cancelled', (data) => {
      setSosAlerts(prev => prev.filter(alert => alert.login_id !== data.login_id));
    });

    socket.on('live_attendance', (data) => {
      let displayName = data.name || data.passenger_name;
      if (data.person_type === 'Unknown' || displayName === 'Unknown Face') {
        displayName = '⚠️ Unknown Face';
      } else if (data.person_type === 'Unpaid' || data.fee_status === 'unpaid') {
        displayName = `${displayName || data.passenger_id || data.login_id || 'Passenger'} (Unpaid)`;
      } else if (displayName && (data.passenger_id || data.login_id)) {
        displayName = `${displayName} (${data.passenger_id || data.login_id})`;
      }
      const newRecord = {
        name: displayName || 'Unknown Passenger',
        route: data.route_id || 'Unknown',
        status: 'Boarded',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        passenger_id: data.passenger_id || data.login_id || null,
      };
      setLiveAttendance(prev => {
        // De-duplicate by passenger_id
        if (newRecord.passenger_id && prev.some(r => r.passenger_id === newRecord.passenger_id)) return prev;
        return [newRecord, ...prev];
      });
    });

    socket.on('global_attendance', (data) => {
      setAttendanceLogs(prev => [data, ...prev]);
    });

    socket.on('live_telemetry', (data) => {
      // Only process telemetry for the currently selected route
      if (data.route_id && String(data.route_id) !== String(selectedRouteRef.current)) return;
      
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
        setIsBusActive(true);
        if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
        telemetryTimeoutRef.current = setTimeout(() => {
          setIsBusActive(false);
        }, 15000);
      }
    });

    socket.on('merge_executed', (data) => {
      toast.success(`Bus Merge Active: ${data.cancelledRoute?.routeName || 'Route'} merged into ${data.targetRoute?.routeName || 'Route'}`, { id: 'admin_merge_exec' });
      setActiveMerges(prev => [data.mergeEvent, ...prev.filter(m => m.id !== data.mergeEvent?.id)]);
    });

    socket.on('merge_undone', (data) => {
      toast.success(`Bus Merge Restored: ${data.merge?.cancelledRouteName || 'Route'} is active again`, { id: 'admin_merge_undone' });
      setActiveMerges(prev => prev.filter(m => m.id !== data.merge?.id));
    });

    setSocketInstance(socket);

    return () => {
      setTimeout(() => socket.disconnect(), 500); // Delayed disconnect to avoid StrictMode console warnings
    };
  }, []);

  useEffect(() => {
    if (socketInstance) {
      socketInstance.emit('join_route', { route_id: selectedRoute });
      setIsBusActive(false);
      if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
    }
  }, [selectedRoute, socketInstance]);  // Fetch ALL data in parallel — faster load
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      try {
        const [rRes, gRes, usersRes, attRes, mRes, sRes, hRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/routes`, authHeaders).catch(e => { console.warn('Routes fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/admin/grievances`, authHeaders).catch(e => { console.warn('Grievances fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/users`, authHeaders).catch(e => { console.warn('Users fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/attendance`, authHeaders).catch(e => { console.warn('Attendance fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/merge/active`, authHeaders).catch(e => ({ data: { data: [] } })),
          axios.get(`${BACKEND_URL}/api/merge/suggestions`, authHeaders).catch(e => ({ data: { data: [] } })),
          axios.get(`${BACKEND_URL}/api/merge/history`, authHeaders).catch(e => ({ data: { data: [] } })),
        ]);

        const routes = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.data || []);
        const grievancesData = Array.isArray(gRes.data) ? gRes.data : (gRes.data?.data || []);
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data || []);
        const attendanceData = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.data || []);

        setRoutesList(routes);
        if (routes.length > 0 && selectedRoute === '1') setSelectedRoute(routes[0].routeId || routes[0].route_id);

        setGrievances(grievancesData);
        setUsersList(usersData.filter(u => ['driver', 'passenger'].includes(u.role)));
        setAttendanceLogs(attendanceData);
        setActiveMerges(mRes.data?.data || []);
        setMergeSuggestions(sRes.data?.data || []);
        setMergeHistory(hRes.data?.data || []);

      } catch (err) {
        console.error("Error fetching admin data", err);
        toast.error("Network error: Unable to reach the server.", { id: 'admin_network_err' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab, user?.token, selectedRoute]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleExecuteMerge = async (e) => {
    e?.preventDefault();
    if (!mergeFormData.cancelled_route_id || !mergeFormData.target_route_id) {
      return toast.error('Please select both the cancelled bus and the target bus.');
    }
    if (mergeFormData.cancelled_route_id === mergeFormData.target_route_id) {
      return toast.error('Cannot merge a bus into itself.');
    }

    const cancelledR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.cancelled_route_id));
    const targetR = routesList.find(r => String(r.routeId || r.route_id) === String(mergeFormData.target_route_id));

    if (!window.confirm(`Are you sure you want to cancel ${cancelledR?.routeName || 'Route'} (Bus ${cancelledR?.busNumber || cancelledR?.bus_number}) and merge students into ${targetR?.routeName || 'Route'} (Bus ${targetR?.busNumber || targetR?.bus_number})?`)) {
      return;
    }

    setIsMerging(true);
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      const res = await axios.post(`${BACKEND_URL}/api/merge`, mergeFormData, authHeaders);
      if (res.data.status === 'success') {
        toast.success(res.data.message || 'Bus merged successfully!');
        if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
        setMergeFormData({ cancelled_route_id: '', target_route_id: '', reason: 'low_attendance', notes: '' });
        
        const [mRes, sRes, hRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/merge/active`, authHeaders),
          axios.get(`${BACKEND_URL}/api/merge/suggestions`, authHeaders),
          axios.get(`${BACKEND_URL}/api/merge/history`, authHeaders),
        ]);
        setActiveMerges(mRes.data?.data || []);
        setMergeSuggestions(sRes.data?.data || []);
        setMergeHistory(hRes.data?.data || []);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to merge buses'));
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
        const [mRes, sRes, hRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/merge/active`, authHeaders),
          axios.get(`${BACKEND_URL}/api/merge/suggestions`, authHeaders),
          axios.get(`${BACKEND_URL}/api/merge/history`, authHeaders),
        ]);
        setActiveMerges(mRes.data?.data || []);
        setMergeSuggestions(sRes.data?.data || []);
        setMergeHistory(hRes.data?.data || []);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to undo merge'));
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
    try {
      // Use PATCH (correct NestJS method)
      await axios.patch(`${BACKEND_URL}/api/grievance/${id}/resolve`, {}, { headers: { Authorization: `Bearer ${user?.token}` } });
      setGrievances(grievances.map(g => (g.id === id || g._id === id) ? { ...g, status: 'resolved' } : g));
      toast.success("Complaint marked as resolved!");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to resolve complaint"));
    }
  };

  const handleDeleteGrievance = async (id) => {
    if (!window.confirm("Are you sure you want to delete this grievance?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/grievance/${id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setGrievances(grievances.filter(g => (g.id !== id && g._id !== id)));
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete complaint"));
    }
  };

  const handleDeleteUser = async (login_id) => {
    if (!login_id) return toast.error("User ID is missing!");
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/users/${login_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setUsersList(usersList.filter(u => u.login_id !== login_id && u.loginId !== login_id));
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete user"));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    // Client-side validation
    if (!userFormData.name?.trim() || userFormData.name.trim().length < 2)
      return toast.error('Name must be at least 2 characters.');
    if (!userFormData.login_id?.trim() || /\s/.test(userFormData.login_id))
      return toast.error('Login ID must not contain spaces.');
    if (!editingUser && (!userFormData.password || userFormData.password.length < 6))
      return toast.error('Password must be at least 6 characters.');
    if (userFormData.role === 'passenger' && !userFormData.route_id)
      return toast.error('Please select a route for the passenger.');

    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      if (editingUser) {
        const payload = { ...userFormData };
        if (!payload.password) delete payload.password;
        await axios.put(`${BACKEND_URL}/api/users/${editingUser.login_id || editingUser.loginId}`, payload, authHeaders);
        toast.success("User updated successfully!");
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, userFormData, authHeaders);
        toast.success("User created successfully!");
        // Auto-create parent account if requested
        if (userFormData.role === 'passenger' && userFormData.createParentAccount && userFormData.parentName) {
          try {
            const parentRes = await axios.post(`${BACKEND_URL}/api/parents/create-and-link`, {
              child_login_id: userFormData.login_id,
              parent_name: userFormData.parentName,
              parent_phone: userFormData.parentPhone,
              parent_password: userFormData.parentPassword || 'Invertis@123',
              nickname: userFormData.name,
            }, authHeaders);
            toast.success(`✅ Parent account created: ${parentRes.data.parent_login_id}`);
          } catch (parentErr) {
            toast.error(`User created but parent account failed: ${parentErr.response?.data?.message || parentErr.message}`);
          }
        }
      }
      setShowUserModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/users`, authHeaders);
      // NestJS returns array directly
      const users = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setUsersList(users);
    } catch (err) {
      toast.error(parseApiError(err, "Failed to save user"));
    }
  };

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
          const rowNum = index + 2; // +1 for header, +1 for 0-index
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
              fee_status: row.fee_status?.trim() || 'paid',
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
    e.target.value = null; // reset input
  };

  const handleBulkUploadSubmit = async () => {
    if (bulkUploadData.length === 0) return toast.error("No valid data to upload");
    
    try {
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      const res = await axios.post(`${BACKEND_URL}/api/users/bulk`, { users: bulkUploadData }, authHeaders);
      
      const { successful, failed, errors } = res.data.results;
      if (failed > 0) {
        toast.error(`Imported ${successful} users. ${failed} failed. Check console for details.`);
        console.error("Bulk upload errors:", errors);
      } else {
        toast.success(`Successfully imported ${successful} users!`);
      }
      
      setShowBulkUploadModal(false);
      setBulkUploadData([]);
      setBulkUploadErrors([]);
      
      // Refresh list
      const fetchRes = await axios.get(`${BACKEND_URL}/api/users`, authHeaders);
      const users = Array.isArray(fetchRes.data) ? fetchRes.data : (fetchRes.data?.data || []);
      setUsersList(users);
    } catch (err) {
      toast.error(parseApiError(err, "Failed to process bulk upload"));
    }
  };

  const handleRemoveFace = async (login_id) => {
    if (!window.confirm("Are you sure you want to remove this user's face data?")) return;
    try {
      // Fixed URL: /api/users/:id/face → /api/faces/:passengerId
      await axios.delete(`${BACKEND_URL}/api/faces/${login_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setUsersList(usersList.map(u => {
        if ((u.login_id || u.loginId) === login_id) {
          const newU = { ...u };
          delete newU.face_descriptor;
          delete newU.awsFaceId;
          return newU;
        }
        return u;
      }));
      if (editingUser && (editingUser.login_id || editingUser.loginId) === login_id) {
        const newEditingUser = { ...editingUser };
        delete newEditingUser.face_descriptor;
        setEditingUser(newEditingUser);
      }
      toast.success("Face data removed successfully!");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete face data"));
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({ name: '', login_id: '', password: '', role: 'passenger', route_id: routesList[0]?.route_id || '1', fee_status: 'paid', phone: '', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', parentPassword: '', createParentAccount: false, dob: '', address: '', gradeClass: '' });
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({ name: u.name, login_id: u.loginId || u.login_id, password: '', role: u.role, route_id: u.routeId || u.route_id || '', fee_status: u.feeStatus || u.fee_status || 'paid', phone: u.phone || '', licenseNumber: u.licenseNumber || '', licenseExpiry: u.licenseExpiry ? new Date(u.licenseExpiry).toISOString().split('T')[0] : '', experienceYears: u.experienceYears || '', bloodGroup: u.bloodGroup || '', parentName: u.parentName || '', parentPhone: u.parentPhone || '', parentPassword: '', createParentAccount: false, dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '', address: u.address || '', gradeClass: u.gradeClass || '' });
    setShowUserModal(true);
  };

  const handleDeleteRoute = async (route_id) => {
    if (!route_id) return toast.error("Route ID is missing!");
    if (!window.confirm("Delete this route permanently?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/routes/${route_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setRoutesList(routesList.filter(r => r.route_id !== route_id && r.routeId !== route_id));
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete route"));
    }
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
        await axios.put(`${BACKEND_URL}/api/routes/${editingRoute.route_id || editingRoute.routeId}`, routeFormData, authHeaders);
      } else {
        await axios.post(`${BACKEND_URL}/api/routes`, routeFormData, authHeaders);
      }
      setShowRouteModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/routes`, authHeaders);
      // NestJS returns array directly
      const routes = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setRoutesList(routes);
    } catch (err) {
      toast.error(parseApiError(err, "Failed to save route"));
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

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/broadcast`, {
        title: 'Admin Notice',
        message: broadcastMessage,
        sender: user?.name || 'Admin'
      });
      toast.success('Global Broadcast sent to all passengers!');
      setBroadcastMessage('');
    } catch (err) {
      toast.error(parseApiError(err, "Failed to send broadcast"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="p-header flex justify-between items-center gap-2 z-50 sticky top-0" style={{
        backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)'
      }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="bg-orange-500 p-2 rounded-xl shrink-0">
            <Shield size={24} color="white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight m-0 truncate">
              Admin <span className="text-orange-500">Dashboard</span>
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 m-0 truncate">Welcome, {user?.name || 'Admin'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="relative">
            {(() => {
              const allNotifications = [
                ...sosAlerts.map(alert => ({
                  id: `sos-${alert.id}`,
                  type: 'sos',
                  title: `SOS Alert - Route ${alert.route} (Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(alert.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(alert.route))?.bus_number || 'Unknown'})`,
                  message: `${alert.passenger} (ID: ${alert.login_id}) initiated SOS at ${alert.time}.`,
                  time: alert.time,
                  icon: <AlertOctagon size={20} className="text-red-500 shrink-0 mt-0.5" />,
                  bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50',
                  textTitle: 'text-red-600 dark:text-red-400',
                  textDesc: 'text-red-500 dark:text-red-300'
                })),
                ...grievances.filter(g => g.status === 'pending').map(g => ({
                  id: `grievance-${g._id}`,
                  type: 'grievance',
                  title: `New Complaint (Route ${g.route} - Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.bus_number || 'Unknown'})`,
                  message: g.text.substring(0, 60) + (g.text.length > 60 ? '...' : ''),
                  time: formatTime(g.created_at || g.time),
                  icon: <MessageSquare size={20} className="text-orange-500 shrink-0 mt-0.5" />,
                  bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/50',
                  textTitle: 'text-orange-600 dark:text-orange-400',
                  textDesc: 'text-orange-500 dark:text-orange-300'
                }))
              ];

              const currentIds = allNotifications.map(n => n.id);
              const hasNew = currentIds.some(id => !seenIds.includes(id));
              if (hasNew && !showNotifications && !hasUnread) {
                setTimeout(() => setHasUnread(true), 0);
              }

              return (
                <>
                  <button 
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications) {
                        setHasUnread(false);
                        const newIds = allNotifications.map(n => n.id);
                        setSeenIds(newIds);
                        localStorage.setItem('admin_seen_notif_ids', JSON.stringify(newIds));
                      }
                    }} 
                    className={`relative bg-transparent border-none cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1 ${hasUnread ? 'animate-bell-ring text-red-500 dark:text-red-400' : ''}`}
                  >
                    <Bell size={24} />
                    {hasUnread && (
                      <span style={{
                        position: 'absolute', top: '0', right: '0', width: '10px', height: '10px',
                        backgroundColor: 'red', borderRadius: '50%', border: '2px solid white', animation: 'pulse 1.5s infinite'
                      }}></span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute top-12 right-0 w-80 sm:w-96 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-fade-in">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 m-0">
                          Notifications {allNotifications.length > 0 && `(${allNotifications.length})`}
                        </h3>
                        <button onClick={() => setShowNotifications(false)} className="bg-transparent border-none cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                          <X size={20} className="text-slate-500 dark:text-slate-400" />
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
              <div className="absolute top-full right-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-1">
                
                {/* User Info Header */}
                <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/40 dark:to-violet-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl flex-shrink-0 overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-sm">
                    {user?.profile_pic ? (
                      <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.name ? user.name.charAt(0).toUpperCase() : <User size={24} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{user?.name || 'Admin User'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email || user?.login_id || 'admin@bussarthi.com'}</span>
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
            { id: 'overview',    icon: <MapPin size={16} />,       label: 'Fleet & Tracking',       color: '#0066cc', bg: '#e6f0fa' },
            { id: 'merge',       icon: <GitMerge size={16} />,     label: 'Merge & Cancel',         color: '#e67e22', bg: '#fef3e2' },
            { id: 'routes',      icon: <Navigation size={16} />,   label: 'Routes',      color: '#28a745', bg: '#e6fae6' },
            { id: 'users',       icon: <Users size={16} />,        label: 'Directory',       color: '#7c3aed', bg: '#f3e8ff' },
            { id: 'grievances',  icon: <MessageSquare size={16} />, label: 'Complaints', color: '#cf1322', bg: '#fff1f0' },
            { id: 'attendance',  icon: <CheckCircle2 size={16} />, label: 'Attendance',  color: '#d97706', bg: '#fffbeb' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  padding: isActive ? '0.55rem 1.1rem' : '0.55rem 1rem',
                  borderRadius: '50px',
                  border: isActive ? `2px solid ${tab.color}` : '2px solid var(--border-color)',
                  backgroundColor: isActive ? tab.bg : 'var(--white)',
                  color: isActive ? tab.color : 'var(--text-light)',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? `0 2px 10px ${tab.color}33` : 'var(--shadow)',
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: isActive ? tab.color : 'var(--bg-color)',
                  color: isActive ? 'white' : 'var(--text-light)',
                  flexShrink: 0, transition: 'all 0.2s'
                }}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="p-main pb-24" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {/* SOS Alerts View (Global) */}
        {sosAlerts.length > 0 && (
          <div className="animate-slide-up" style={{
            backgroundColor: '#fff1f0', border: '2px solid #cf1322', padding: '1rem 1.5rem',
            borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '2rem', boxShadow: '0 4px 12px rgba(207, 19, 34, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <AlertOctagon size={28} color="#cf1322" className="animate-pulse" />
              <div>
                <h3 style={{ color: '#cf1322', fontWeight: 'bold', margin: 0 }}>ACTIVE SOS ALERT</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#a8071a', fontWeight: '600' }}>
                  Bus {routesList.find(r => String(r.route_id) === String(sosAlerts[0].route))?.bus_number || 'Unknown'} (Route {sosAlerts[0].route}) • Driver: {usersList.find(u => u.login_id === routesList.find(r => String(r.route_id) === String(sosAlerts[0].route))?.driver_id)?.name || 'Unknown'}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#a8071a' }}>
                  Initiated by {sosAlerts[0].passenger} (ID: {sosAlerts[0].login_id}) • {sosAlerts[0].time}
                </p>
              </div>
            </div>
            <button onClick={() => setSosAlerts([])} style={{ background: '#cf1322', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* ----------------- TAB: OVERVIEW ----------------- */}
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
                  {routesList.map((r, idx) => {
                    const rId = String(r.routeId || r.route_id || idx);
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

            {/* Global Broadcast Panel */}
            <div className="glass animate-slide-up flex flex-col md:flex-row gap-6 items-start md:items-center p-6 rounded-3xl bg-green-50 dark:bg-green-900/20 border-2 border-green-500 w-full overflow-hidden">
              <div className="flex gap-4 items-center w-full md:w-auto">
                <div className="bg-green-500 p-4 rounded-full text-white shrink-0"><Bell size={32} /></div>
                <div className="min-w-0">
                  <h3 className="m-0 text-lg md:text-xl text-green-800 dark:text-green-400 font-bold truncate">Global Broadcast (Notice Board)</h3>
                  <p className="m-0 text-sm text-green-700 dark:text-green-500">Send an instant push notification to all passenger apps.</p>
                </div>
              </div>
              <form onSubmit={handleSendBroadcast} className="flex flex-col sm:flex-row gap-4 w-full md:flex-1">
                <input
                  type="text"
                  required
                  placeholder="E.g. Bus Route 4 will be delayed by 15 mins today..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="flex-1 min-w-0 p-3 rounded-xl border border-green-500 text-base bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-green-500/50"
                />
                <button type="submit" disabled={isBroadcasting} className="bg-green-500 hover:bg-green-600 text-white border-none py-3 px-6 rounded-xl font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
                  {isBroadcasting ? 'Sending...' : 'Broadcast Now'}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch w-full">
              {/* Left side: Map */}
              <div className="glass p-glass rounded-3xl overflow-hidden min-h-[400px] border-2 border-blue-600 relative z-[1] w-full">
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}>
                  <MapResizer />
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    attribution='&copy; Google Maps'
                  />
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup><b>Route {selectedRoute} (Bus {routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || 'Unknown'})</b><br />Live Location</Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Right side: Stats for selected bus */}
              <div className="flex flex-col gap-6 w-full min-w-0">
                <div className="glass p-6 rounded-2xl flex items-center gap-4 flex-1">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl text-blue-600 dark:text-blue-400 shrink-0"><Users size={28} /></div>
                  <div className="min-w-0">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold m-0 truncate">Passengers Boarded (Route {selectedRoute} - Bus {routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || 'Unknown'})</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 m-0">
                      {liveAttendance.filter(a => String(a.route) === String(selectedRoute)).length}
                    </h3>
                  </div>
                </div>

                <div
                  className="glass p-6 rounded-2xl flex items-center gap-4 flex-1 cursor-pointer transition-transform hover:-translate-y-1"
                  onClick={() => setShowRouteComplaintsModal(true)}
                >
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-xl text-orange-500 shrink-0"><AlertOctagon size={28} /></div>
                  <div className="min-w-0">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold m-0 truncate">Pending Complaints (Route {selectedRoute} - Bus {routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || 'Unknown'})</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 m-0">
                      {grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').length}
                    </h3>
                  </div>
                </div>

                <div className="glass p-6 rounded-2xl flex items-center gap-4 flex-1">
                  <div className={`${isBusActive ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'} p-4 rounded-xl shrink-0`}>
                    {isBusActive ? <CheckCircle2 size={28} /> : <AlertOctagon size={28} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold m-0 truncate">Route Status</p>
                    <h3 className={`text-xl md:text-2xl font-bold m-0 truncate ${isBusActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isBusActive ? 'Active & Running' : 'Inactive'}
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch w-full">
              {/* Left Side: Live Camera */}
              <div className="glass p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse inline-block"></span>
                    Live Camera Feed
                  </h2>
                </div>
                <div className="flex-1 w-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center min-h-[300px]">
                  {routesList.length > 0 ? (
                    <WebRTCPlayer 
                      busId={`bus-${routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number}`} 
                    />
                  ) : (
                    <div className="text-white animate-pulse flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Connecting to Camera...</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                  Live feed for bus: {routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || 'Unknown'}
                </p>
              </div>

              {/* Right Side: Live Boarding Feed */}
              <div className="glass p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
                    Live Boarding Feed
                  </h2>
                </div>

              {(() => {
                // Build a combined & deduplicated list of today's boardings
                const todayStr = new Date().toISOString().split('T')[0];
                const seenPassengers = new Map(); // passenger_id → record

                // From backend attendance logs (already fetched)
                attendanceLogs.forEach(log => {
                  const logDate = new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toISOString().split('T')[0];
                  if (logDate === todayStr) {
                    const sid = log.passenger_id || log.login_id;
                    if (sid && !seenPassengers.has(sid)) {
                      seenPassengers.set(sid, {
                        name: log.name || log.passenger_name || sid,
                        route: log.route_id || '?',
                        time: new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                        passenger_id: sid,
                      });
                    }
                  }
                });

                // From live socket feed (these are recent, may not be in attendanceLogs yet)
                liveAttendance.forEach(la => {
                  const sid = la.passenger_id;
                  if (sid && !seenPassengers.has(sid)) {
                    seenPassengers.set(sid, {
                      name: la.name || sid,
                      route: la.route || '?',
                      time: la.time || 'Just now',
                      passenger_id: sid,
                    });
                  }
                });

                const todayBoardings = Array.from(seenPassengers.values()).filter(passenger => String(passenger.route) === String(selectedRoute));

                if (todayBoardings.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Users size={28} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium m-0">Waiting for passengers to board...</p>
                      <p className="text-slate-400 dark:text-slate-500 text-sm m-0 mt-1">Attendance will appear here in real-time</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto hide-scrollbar pr-1">
                    {todayBoardings.map((passenger, i) => {
                      const busInfo = routesList.find(r => String(r.route_id) === String(passenger.route));
                      return (
                        <div key={passenger.passenger_id || i} className="flex justify-between items-center p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:shadow-sm transition-shadow animate-fade-in">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                              {passenger.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base m-0 truncate">{passenger.name}</p>
                              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0 mt-0.5 truncate">
                                {busInfo ? `${busInfo.bus_number} (Route ${passenger.route})` : `Route ${passenger.route}`} • {passenger.time}
                              </p>
                            </div>
                          </div>
                          <CheckCircle2 className="text-green-500 w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB: ROUTES ----------------- */}
        {activeTab === 'routes' && (
          <div className="animate-fade-in glass p-glass rounded-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">Fleet & Route Management</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Search route name, bus, driver..." 
                  value={routeSearchQuery}
                  onChange={(e) => setRouteSearchQuery(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none w-full sm:w-64"
                />
                <button onClick={openAddRoute} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors w-full sm:w-auto whitespace-nowrap">
                  <Plus size={18} /> Add New Route
                </button>
              </div>
            </div>

            {isLoading ? <p>Loading routes...</p> : routesList.length === 0 ? <p>No routes configured yet. Add your first bus route!</p> : (
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
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', backgroundColor: 'var(--secondary-orange)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>Route {r.routeId || r.route_id}</span>
                          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', color: 'var(--text-dark)' }}>{r.routeName || r.route_name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setViewingRouteDetails(r)} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}><Eye size={18} /></button>
                          <button onClick={() => openEditRoute(r)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Edit</button>
                          <button onClick={() => handleDeleteRoute(r.routeId || r.route_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Delete</button>
                          <button onClick={() => navigate(`/admin/routes/${r.routeId || r.route_id}/analytics`)} style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '2px' }} title="Speed & Violations Analytics"><Activity size={18} /> Analytics</button>
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

        {/* ----------------- TAB: USERS ----------------- */}
        {activeTab === 'users' && (
          <div className="animate-fade-in glass p-glass rounded-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">User Directory</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                {userFilter === 'passenger' && (
                  <button onClick={() => setShowBulkUploadModal(true)} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors flex-1 sm:flex-none">
                    <Upload size={18} /> Bulk Upload
                  </button>
                )}
                <button onClick={openAddUser} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none py-2 px-4 rounded-xl font-bold cursor-pointer transition-colors flex-1 sm:flex-none">
                  <UserPlus size={18} /> Add User
                </button>
              </div>
            </div>

            {/* Sub-Tabs for filtering Passengers, Drivers, Admins, Transport Incharges */}
            <div className="flex flex-wrap gap-3 mb-6">
              {[
                { role: 'passenger', label: 'Passengers', color: 'var(--primary-blue)' },
                { role: 'driver', label: 'Drivers', color: '#28a745' },
                { role: 'admin', label: 'Admins', color: 'var(--secondary-orange)' },
                { role: 'transport_incharge', label: 'Transport Incharge', color: '#7c3aed' },
                { role: 'parent', label: '👨‍👧 Parents', color: '#9b59b6' },
              ].map(({ role: r, label, color }) => (
                <button
                  key={r}
                  onClick={() => setUserFilter(r)}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: userFilter === r ? color : '#f0f0f0',
                    color: userFilter === r ? 'white' : 'var(--text-dark)',
                    borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontWeight: 'bold', transition: 'all 0.3s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {isLoading ? <p>Loading users...</p> : (
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-color)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Name</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Login ID</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Role</th>
                      {(userFilter === 'passenger' || userFilter === 'driver') && (
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Route</th>
                      )}
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>{userFilter === 'passenger' ? 'Fee Status' : 'Phone'}</th>
                      {userFilter === 'passenger' && (
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Face Seeded</th>
                      )}
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.filter(u => u.role === userFilter).map((u, i) => (
                      <tr key={u.id || u.loginId || u.login_id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{u.name}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{u.loginId || u.login_id}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            backgroundColor: u.role === 'admin' ? '#fff0e6' : u.role === 'driver' ? '#e6fae6' : '#e6f0fa',
                            color: u.role === 'admin' ? 'var(--secondary-orange)' : u.role === 'driver' ? '#28a745' : 'var(--primary-blue)',
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'capitalize'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        {(userFilter === 'passenger' || userFilter === 'driver') && (
                          <td style={{ padding: '1rem' }}>
                            {(() => {
                              const routeVal = u.routeId || u.route_id || routesList.find(r => (r.driverId || r.driver_id) === (u.loginId || u.login_id))?.routeId || routesList.find(r => (r.driverId || r.driver_id) === (u.loginId || u.login_id))?.route_id;
                              if (!routeVal) return 'Unassigned';
                              const matchedRoute = routesList.find(r => String(r.routeId || r.route_id) === String(routeVal));
                              return matchedRoute ? `Route ${routeVal} (Bus ${matchedRoute.busNumber || matchedRoute.bus_number})` : `Route ${routeVal}`;
                            })()}
                          </td>
                        )}
                        <td style={{ padding: '1rem' }}>
                          {u.role === 'passenger' ? (
                            <span style={{ color: (u.feeStatus || u.fee_status) === 'paid' ? '#28a745' : '#cf1322', fontWeight: 'bold', textTransform: 'capitalize' }}>
                              {u.feeStatus || u.fee_status || 'Pending'}
                            </span>
                          ) : (
                            <span style={{ whiteSpace: 'nowrap' }}>{u.phone || '-'}</span>
                          )}
                        </td>
                        {userFilter === 'passenger' && (
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            {u.aws_face_id ? (
                              <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Yes</span>
                            ) : (
                              <span style={{ backgroundColor: '#fff1f0', color: '#cf1322', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>No</span>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => setViewingUser(u)} style={{ border: 'none', background: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 'bold' }} title="View Details"><Eye size={18} /></button>
                          <button onClick={() => openEditUser(u)} style={{ border: 'none', background: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                          <button onClick={() => handleDeleteUser(u.loginId || u.login_id)} style={{ border: 'none', background: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB: GRIEVANCES ----------------- */}
        {activeTab === 'grievances' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Grievance God Mode</h2>
            <p style={{ color: 'var(--text-light)', marginTop: '-1rem', marginBottom: '1rem' }}>You can see real names of anonymous posters.</p>

            {isLoading ? <p>Loading complaints...</p> : grievances.length === 0 ? <p>No complaints yet!</p> : grievances.map((comp) => (
              <div key={comp.id || comp._id} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: comp.status === 'resolved' ? '4px solid #28a745' : '4px solid var(--secondary-orange)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                      <span style={{ color: 'var(--primary-blue)' }}>{comp.realName}</span> <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 'normal' }}>(ID: {comp.loginId || comp.login_id})</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{comp.route} • {formatTime(comp.createdAt || comp.created_at || comp.time)}</p>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px',
                    backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0',
                    color: comp.status === 'resolved' ? '#28a745' : '#cf1322'
                  }}>
                    {comp.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-dark)' }}>{comp.text}</p>

                {/* Media Attachment */}
                {comp.type === 'photo' && (comp.media_url || comp.mediaUrl) && (
                  <div 
                    onClick={() => setFullScreenMedia({ type: 'photo', url: comp.media_url || comp.mediaUrl })}
                    style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center', cursor: 'zoom-in' }}
                  >
                    <img src={comp.media_url || comp.mediaUrl} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain', transition: 'transform 0.2s' }} />
                  </div>
                )}
                {comp.type === 'video' && (comp.media_url || comp.mediaUrl) && (
                  <div 
                    onClick={() => setFullScreenMedia({ type: 'video', url: comp.media_url || comp.mediaUrl })}
                    style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '24px' }}>
                        ▶
                      </div>
                    </div>
                    <video src={comp.media_url || comp.mediaUrl} style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', opacity: 0.8 }} />
                  </div>
                )}
                {comp.type === 'audio' && (comp.media_url || comp.mediaUrl) && (
                  <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                    <audio src={comp.media_url || comp.mediaUrl} controls style={{ width: '100%' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  {comp.status === 'pending' && (
                    <button onClick={() => handleResolveGrievance(comp.id || comp._id)} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={16} /> Mark Resolved
                    </button>
                  )}
                  <button onClick={() => handleDeleteGrievance(comp.id || comp._id)} style={{ backgroundColor: '#fff1f0', color: '#cf1322', border: '1px solid #cf1322', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} /> Delete Post
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------- TAB: ATTENDANCE ----------------- */}
        {activeTab === 'attendance' && (() => {
          const uniqueCities = [...new Set(routesList.map(r => r.city || 'Bareilly'))];
          const filteredAttendanceLogs = attendanceLogs.filter(log => {
            // Check Date
            const logDate = new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toISOString().split('T')[0];
            if (attFilterDate && logDate !== attFilterDate) return false;

            // Check Route
            if (attFilterRoute !== 'All' && String(log.route_id) !== String(attFilterRoute)) return false;

            // Check City
            if (attFilterCity !== 'All') {
              const routeInfo = routesList.find(r => String(r.route_id) === String(log.route_id));
              const logCity = routeInfo?.city || 'Bareilly';
              if (logCity !== attFilterCity) return false;
            }

            return true;
          });

          return (
            <div className="animate-fade-in glass p-glass" style={{ borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)' }}>Daily Attendance Logs</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>City</label>
                    <select value={attFilterCity} onChange={e => { setAttFilterCity(e.target.value); setAttFilterRoute('All'); }} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }}>
                      <option value="All">All Cities</option>
                      {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Route</label>
                    <select value={attFilterRoute} onChange={e => setAttFilterRoute(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }}>
                      <option value="All">All Routes</option>
                      {routesList.filter(r => attFilterCity === 'All' || (r.city || 'Bareilly') === attFilterCity).map(r => (
                        <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>Route {r.routeId || r.route_id} - {r.routeName || r.route_name} (Bus: {r.busNumber || r.bus_number})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Date</label>
                    <input type="date" value={attFilterDate} onChange={e => setAttFilterDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {isLoading ? <p>Loading attendance logs...</p> : (
                <div style={{ overflowX: 'auto', backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-color)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Passenger ID / Name</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Route ID</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Time</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceLogs.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>No attendance logs found.</td></tr>
                      ) : filteredAttendanceLogs.map((log, i) => (
                        <tr key={log._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '1rem' }}>
                            {(() => {
                              const displayName = log.name || log.passenger_name;
                              const displayId = log.passenger_id || log.login_id;
                              const origRoute = log.originalRouteId || log.original_route_id;
                              
                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>
                                    {log.person_type === 'Unknown' || displayName === 'Unknown Face' ? (
                                      <span style={{ color: 'var(--secondary-orange)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                        ⚠️ Unknown Face
                                      </span>
                                    ) : log.person_type === 'Unpaid' || log.fee_status === 'unpaid' ? (
                                      <span style={{ color: '#cf1322' }}>
                                        {displayName || displayId} (Unpaid)
                                      </span>
                                    ) : displayName && displayId ? (
                                      `${displayName} (${displayId})`
                                    ) : (
                                      displayName || displayId || 'Unknown Face'
                                    )}
                                  </span>
                                  {origRoute && (
                                    <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                                      Merged (Route {origRoute})
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {log.route_id ? `Route ${log.route_id} (Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(log.route_id))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(log.route_id))?.bus_number || 'Unknown'})` : 'N/A'}
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-light)' }}>{new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toLocaleString()}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              backgroundColor: '#e6fae6', color: '#28a745',
                              padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                              Hardware (Face/RFID)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* ----------------- TAB: MERGE & CANCEL ----------------- */}
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
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">Bus Merge & Cancellation Center</h2>
                      <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                        {activeMerges.length} Active Today
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 m-0 mt-1">
                      Instantly cancel low-attendance buses and transfer students, attendance eligibility, and GPS streaming to another active bus.
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

            {/* Smart Merge Suggestions */}
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

            {/* Merge Form & Active Merges Today */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form */}
              <div className="lg:col-span-7 glass p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <Layers size={20} className="text-orange-500" />
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Initiate Bus Merge</h3>
                </div>

                <form onSubmit={handleExecuteMerge} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center justify-center text-[10px]">1</span>
                        Bus to Cancel (Low Attendance):
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Merge:</label>
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

                  {mergeFormData.cancelled_route_id && mergeFormData.target_route_id && (() => {
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

                  <button
                    type="submit"
                    disabled={isMerging || !mergeFormData.cancelled_route_id || !mergeFormData.target_route_id}
                    className="mt-2 w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer border-none"
                  >
                    <GitMerge size={18} />
                    {isMerging ? 'Executing Merge & Syncing...' : 'Execute Bus Merge & Notify Passengers'}
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
                          <td className="py-2.5 px-3 text-slate-500">{hist.initiatedBy || 'Admin'}</td>
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

      </main>

      {/* Route Specific Pending Complaints Modal */}
      {showRouteComplaintsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="animate-slide-up glass" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', backgroundColor: 'var(--card-bg)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff0e6' }}>
              <h2 style={{ margin: 0, color: 'var(--secondary-orange)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <AlertOctagon /> Route {selectedRoute} (Bus {routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(selectedRoute))?.bus_number || 'Unknown'}) Complaints
              </h2>
              <button onClick={() => setShowRouteComplaintsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-dark)" /></button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: '2rem' }}>No pending complaints for this route! ðŸŽ‰</p>
              ) : (
                grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').map((comp) => (
                  <div key={comp._id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--primary-blue)' }}>{comp.realName} (ID: {comp.login_id})</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{formatTime(comp.created_at || comp.time)}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-dark)' }}>{comp.text}</p>
                    {/* Media Attachment */}
                    {comp.type === 'photo' && (comp.media_url || comp.mediaUrl) && (
                      <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center' }}>
                        <img src={comp.media_url || comp.mediaUrl} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain' }} />
                      </div>
                    )}
                    {comp.type === 'video' && (comp.media_url || comp.mediaUrl) && (
                      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video src={comp.media_url || comp.mediaUrl} controls style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }} />
                      </div>
                    )}
                    {comp.type === 'audio' && (comp.media_url || comp.mediaUrl) && (
                      <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                        <audio src={comp.media_url || comp.mediaUrl} controls style={{ width: '100%' }} />
                      </div>
                    )}
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => {
                        handleResolveGrievance(comp._id);
                      }} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <CheckCircle2 size={16} /> Mark Resolved
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Route Details Modal (Eye Button) */}
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

      {/* View User Details Modal (Eye Button) */}
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
                  <p className={`font-bold m-0 ${viewingUser.aws_face_id || viewingUser.awsFaceId ? 'text-green-600' : 'text-red-500'}`}>
                    {viewingUser.aws_face_id || viewingUser.awsFaceId ? 'Verified' : 'Not Seeded'}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-dark)' }}>{editingUser ? 'Edit User' : 'Add New User'}</h2>
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
                    <option value="passenger">Passenger</option>
                    <option value="driver">Driver (Flutter App)</option>
                    <option value="transport_incharge">Transport Incharge</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route</label>
                  <select value={userFormData.route_id} onChange={e => setUserFormData({ ...userFormData, route_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'var(--card-bg)' }}>
                    {routesList.map(r => (
                      <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>Route {r.routeId || r.route_id} - {r.routeName || r.route_name} (Bus: {r.busNumber || r.bus_number})</option>
                    ))}
                    {routesList.length === 0 && <option value="">No Routes Found</option>}
                  </select>
                </div>
              </div>
              {userFormData.role === 'passenger' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Fee Status</label>
                      <select value={userFormData.fee_status} onChange={e => setUserFormData({ ...userFormData, fee_status: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending / Unpaid</option>
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
                  {/* ---- Parent Account Auto-Creation ---- */}
                  {!editingUser && (
                    <div style={{ background: '#f5f0ff', borderRadius: '12px', padding: '1rem', border: '2px solid #9b59b620' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="checkbox"
                          id="createParentToggle"
                          checked={userFormData.createParentAccount}
                          onChange={e => setUserFormData({ ...userFormData, createParentAccount: e.target.checked })}
                          style={{ width: 18, height: 18, accentColor: '#9b59b6', cursor: 'pointer' }}
                        />
                        <label htmlFor="createParentToggle" style={{ fontWeight: 700, color: '#7c3aed', cursor: 'pointer', fontSize: '0.95rem' }}>
                          👨‍👧 Create Parent Account for this Student
                        </label>
                      </div>
                      {userFormData.createParentAccount && (
                        <>
                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#7c3aed' }}>
                            Parent login ID will be auto-generated (e.g. P{userFormData.login_id.replace(/^[A-Za-z]/, '') || 'XXX'})
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '0.85rem' }}>Parent Name *</label>
                              <input type="text" required={userFormData.createParentAccount} placeholder="e.g. Mr. Ramesh Kumar" value={userFormData.parentName} onChange={e => setUserFormData({ ...userFormData, parentName: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #9b59b6' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '0.85rem' }}>Parent Phone</label>
                              <input type="tel" placeholder="+91 9876543210" value={userFormData.parentPhone} onChange={e => setUserFormData({ ...userFormData, parentPhone: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #9b59b6' }} />
                            </div>
                          </div>
                          <div style={{ marginTop: '0.6rem' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '0.85rem' }}>Parent Password</label>
                            <input type="text" placeholder="Default: Invertis@123" value={userFormData.parentPassword} onChange={e => setUserFormData({ ...userFormData, parentPassword: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #9b59b6' }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                {editingUser && editingUser.aws_face_id && (
                  <button type="button" onClick={() => handleRemoveFace(editingUser.login_id)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cf1322', background: '#fff1f0', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold' }}>Remove Face</button>
                )}
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>{editingUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Route Modal */}
      {showRouteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass p-glass" data-lenis-prevent="true" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', backgroundColor: 'var(--card-bg)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-dark)' }}>{editingRoute ? 'Edit Route' : 'Add New Route'}</h2>
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
                  <select value={routeFormData.driver_id} onChange={e => setRouteFormData({ ...routeFormData, driver_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'var(--card-bg)' }}>
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

export default AdminDashboard;
