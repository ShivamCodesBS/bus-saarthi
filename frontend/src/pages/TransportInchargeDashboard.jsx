import { useState, useEffect, useRef } from 'react';
import { Users, MapPin, Shield, LogOut, Settings, Bell, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus, Navigation, Plus, Car, X, User, Menu, Eye, Download, Upload } from 'lucide-react';
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


// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // User Management
  const [userFilter, setUserFilter] = useState('driver'); // 'driver' or 'passenger'
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', login_id: '', password: '', role: 'driver', phone: '', route_id: '', fee_status: 'paid', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', dob: '', address: '', gradeClass: '' });
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
  const telemetryTimeoutRef = useRef(null);
  const selectedRouteRef = useRef(selectedRoute);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  // Global Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Analytics
  const [selectedRouteAnalytics, setSelectedRouteAnalytics] = useState('All');

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

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      console.log('Transport Incharge connected to socket server');
      socket.emit('join_admin');
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error (Transport):', err.message);
    });

    socket.on('sos_alert', (data) => {
      const newAlert = { id: Date.now(), route: data.route, passenger: data.passenger, login_id: data.login_id, time: new Date().toLocaleTimeString() };
      setSosAlerts(prev => [newAlert, ...prev]);
      try { new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play(); } catch (e) { }
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
        if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
        telemetryTimeoutRef.current = setTimeout(() => setIsBusActive(false), 15000);
      }
    });

    setSocketInstance(socket);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (socketInstance) {
      socketInstance.emit('join_route', { route_id: selectedRoute });
      setIsBusActive(false);
      if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
    }
  }, [selectedRoute, socketInstance]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };
      try {
        const [rRes, gRes, usersRes, attRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/routes`, authHeaders).catch(e => { console.warn('Routes fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/admin/grievances`, authHeaders).catch(e => { console.warn('Grievances fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/users`, authHeaders).catch(e => { console.warn('Users fetch failed'); return { data: { status: 'error' } }; }),
          axios.get(`${BACKEND_URL}/api/attendance`, authHeaders).catch(e => { console.warn('Attendance fetch failed'); return { data: { status: 'error' } }; })
        ]);

        let hasError = false;

        if (rRes.data.status === 'success') {
          setRoutesList(rRes.data.data);
          if (rRes.data.data.length > 0 && selectedRoute === '1') setSelectedRoute(rRes.data.data[0].route_id);
        } else { hasError = true; }

        if (gRes.data.status === 'success') setGrievances(gRes.data.data); else hasError = true;
        if (usersRes.data.status === 'success') setUsersList(usersRes.data.data.filter(u => ['driver', 'passenger'].includes(u.role))); else hasError = true;
        if (attRes.data.status === 'success') setAttendanceLogs(attRes.data.data); else hasError = true;

        if (hasError) toast.error("Some data failed to load. The server might be unreachable.", { id: 'ti_fetch_err' });

      } catch (err) {
        console.error("Error fetching data", err);
        toast.error("Network error: Unable to reach the server.", { id: 'ti_network_err' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleResolveGrievance = async (id) => {
    try {
      await axios.put(`${BACKEND_URL}/api/grievance/${id}/resolve`, {}, { headers: { Authorization: `Bearer ${user?.token}` } });
      setGrievances(grievances.map(g => g._id === id ? { ...g, status: 'resolved' } : g));
      toast.success("Complaint marked as resolved!");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to resolve complaint"));
    }
  };

  const handleDeleteUser = async (login_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/users/${login_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setUsersList(usersList.filter(u => u.loginId !== login_id && u.login_id !== login_id));
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete user"));
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
      if (editingUser) {
        const payload = { ...userFormData };
        if (!payload.password) delete payload.password;
        await axios.put(`${BACKEND_URL}/api/users/${editingUser.loginId || editingUser.login_id}`, payload, authHeaders);
        toast.success("User updated successfully!");
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, userFormData, authHeaders);
        toast.success("User created successfully!");
      }
      setShowUserModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/users`, authHeaders);
      if (res.data.status === 'success') setUsersList(res.data.data.filter(u => ['driver', 'passenger'].includes(u.role)));
    } catch (err) {
      toast.error(parseApiError(err, "Failed to save user"));
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
      
      const fetchRes = await axios.get(`${BACKEND_URL}/api/users`, authHeaders);
      if (fetchRes.data.status === 'success') setUsersList(fetchRes.data.data.filter(u => ['driver', 'passenger'].includes(u.role)));
    } catch (err) {
      toast.error(parseApiError(err, "Failed to process bulk upload"));
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({ name: '', login_id: '', password: '', role: userFilter, phone: '', route_id: '', fee_status: 'paid', licenseNumber: '', licenseExpiry: '', experienceYears: '', bloodGroup: '', parentName: '', parentPhone: '', dob: '', address: '', gradeClass: '' });
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({ name: u.name, login_id: u.loginId || u.login_id, password: '', role: u.role, phone: u.phone || '', route_id: u.routeId || u.route_id || '', fee_status: u.feeStatus || u.fee_status || 'paid', licenseNumber: u.licenseNumber || '', licenseExpiry: u.licenseExpiry ? new Date(u.licenseExpiry).toISOString().split('T')[0] : '', experienceYears: u.experienceYears || '', bloodGroup: u.bloodGroup || '', parentName: u.parentName || '', parentPhone: u.parentPhone || '', dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '', address: u.address || '', gradeClass: u.gradeClass || '' });
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
      const res = await axios.get(`${BACKEND_URL}/api/routes`, authHeaders);
      if (res.data.status === 'success') setRoutesList(res.data.data);
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

  const handleDeleteRoute = async (route_id) => {
    if (!window.confirm("Delete this route?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/routes/${route_id}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setRoutesList(routesList.filter(r => r.routeId !== route_id && r.route_id !== route_id));
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete route"));
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
      toast.error(parseApiError(err, "Failed to send broadcast"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="p-header z-50 sticky top-0" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: '#28a745', padding: '0.5rem', borderRadius: '10px' }}>
            <Car size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', lineHeight: 1.2 }}>Transport <span style={{ color: '#28a745' }}>Incharge</span></h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>Welcome, {user?.name}</p>
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
                  message: `${alert.passenger} (ID: ${alert.login_id}) initiated SOS at ${alert.time}.`,
                  time: alert.time,
                  icon: <AlertOctagon size={20} color="#cf1322" className="shrink-0 mt-0.5" />,
                  bg: '#fff1f0', borderColor: '#cf1322', textTitle: '#cf1322', textDesc: '#a8071a'
                })),
                ...grievances.filter(g => g.status === 'pending').map(g => ({
                  id: `grievance-${g._id}`,
                  type: 'grievance',
                  title: `New Complaint (Route ${g.route} - Bus ${routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(g.route))?.bus_number || 'Unknown'})`,
                  message: g.text.substring(0, 60) + (g.text.length > 60 ? '...' : ''),
                  time: formatTime(g.created_at || g.time),
                  icon: <MessageSquare size={20} color="#d97706" className="shrink-0 mt-0.5" />,
                  bg: '#fffbeb', borderColor: '#f59e0b', textTitle: '#d97706', textDesc: '#b45309'
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
            { id: 'routes', icon: <Navigation size={16} />, label: 'Manage Routes', color: '#28a745', bg: '#e6fae6' },
            { id: 'users', icon: <Users size={16} />, label: 'Directory', color: '#7c3aed', bg: '#f3e8ff' },
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
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#a8071a', fontWeight: '600' }}>Route {sosAlerts[0].route} (Bus {routesList.find(r => String(r.routeId || r.route_id) === String(sosAlerts[0].route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(sosAlerts[0].route))?.bus_number || 'Unknown'})</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#a8071a' }}>Initiated anonymously • {sosAlerts[0].time}</p>
              </div>
            </div>
            <button onClick={() => setSosAlerts([])} style={{ background: '#cf1322', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Dismiss</button>
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
                  {routesList.map(r => (
                    <option key={r.routeId || r.route_id} value={r.routeId || r.route_id}>{r.routeName || r.route_name} ({r.busNumber || r.bus_number})</option>
                  ))}
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
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <MapResizer />
                  <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
                  <Marker position={busLocation} icon={busIcon}><Popup>Bus Location</Popup></Marker>
                </MapContainer>
              </div>
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>User Directory</h2>
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
                        {u.aws_face_id ? (
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
          </div>
        )}

        {/* GRIEVANCES (ANONYMOUS) */}
        {activeTab === 'grievances' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Passenger Grievances</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grievances.map(comp => (
                <div key={comp.id || comp._id} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: comp.status === 'resolved' ? '4px solid #28a745' : '4px solid #cf1322' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      {/* Show real name to Transport Incharge (approved by user) */}
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                        {comp.realName || 'Anonymous Passenger'}
                        {(comp.loginId || comp.login_id) && <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 'normal', marginLeft: '0.4rem' }}>(ID: {comp.loginId || comp.login_id})</span>}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Route {comp.routeId || comp.route} (Bus {routesList.find(r => String(r.routeId || r.route_id) === String(comp.routeId || comp.route))?.busNumber || routesList.find(r => String(r.routeId || r.route_id) === String(comp.routeId || comp.route))?.bus_number || 'Unknown'}) • {formatTime(comp.createdAt || comp.created_at || comp.time)}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px', backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0', color: comp.status === 'resolved' ? '#28a745' : '#cf1322' }}>{comp.status.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: '1rem 0 0 0', fontSize: '1rem' }}>{comp.text}</p>

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

                  {comp.status === 'pending' && (
                    <button onClick={() => handleResolveGrievance(comp.id || comp._id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Mark Resolved</button>
                  )}
                </div>
              ))}
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
                    <option value="passenger">Passenger</option>
                    <option value="driver">Driver (Flutter App)</option>
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
