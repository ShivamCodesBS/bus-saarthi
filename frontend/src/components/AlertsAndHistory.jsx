import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  AlertTriangle, 
  Megaphone, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  RotateCw, 
  Trash2, 
  Send, 
  User, 
  MapPin, 
  Bus, 
  Check, 
  X,
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
  MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BACKEND_URL, SOCKET_URL } from '../config';

export default function AlertsAndHistory({ user, routesList = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('sos'); // 'sos' | 'broadcast'

  // SOS State
  const [sosAlerts, setSosAlerts] = useState([]);
  const [sosStats, setSosStats] = useState({ active: 0, resolved: 0, cancelled: 0, totalAll: 0 });
  const [sosLoading, setSosLoading] = useState(false);
  const [sosStatusFilter, setSosStatusFilter] = useState('all');
  const [sosRouteFilter, setSosRouteFilter] = useState('all');
  const [sosSearch, setSosSearch] = useState('');
  const [sosPage, setSosPage] = useState(1);
  const [sosTotalPages, setSosTotalPages] = useState(1);

  // Resolve Modal State
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Broadcasts State
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastPage, setBroadcastPage] = useState(1);
  const [broadcastTotalPages, setBroadcastTotalPages] = useState(1);
  const [broadcastTotal, setBroadcastTotal] = useState(0);

  // Compose Broadcast State
  const [newBroadcastTitle, setNewBroadcastTitle] = useState('');
  const [newBroadcastMessage, setNewBroadcastMessage] = useState('');
  const [newBroadcastSender, setNewBroadcastSender] = useState(user?.name || 'Administration');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const authHeaders = useMemo(() => ({
    headers: { Authorization: `Bearer ${user?.token}` }
  }), [user?.token]);

  // Fetch SOS History
  const fetchSosHistory = useCallback(async () => {
    if (!user?.token) return;
    setSosLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/sos/history`, {
        ...authHeaders,
        params: {
          status: sosStatusFilter !== 'all' ? sosStatusFilter : undefined,
          route: sosRouteFilter !== 'all' ? sosRouteFilter : undefined,
          search: sosSearch.trim() || undefined,
          page: sosPage,
          limit: 15,
        }
      });
      if (res.data?.status === 'success') {
        setSosAlerts(res.data.data || []);
        if (res.data.stats) setSosStats(res.data.stats);
        if (res.data.pagination) setSosTotalPages(res.data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch SOS history:', err);
      toast.error('Failed to load SOS history');
    } finally {
      setSosLoading(false);
    }
  }, [user?.token, authHeaders, sosStatusFilter, sosRouteFilter, sosSearch, sosPage]);

  // Fetch Broadcast History
  const fetchBroadcastHistory = useCallback(async () => {
    if (!user?.token) return;
    setBroadcastLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/broadcast/history`, {
        ...authHeaders,
        params: {
          search: broadcastSearch.trim() || undefined,
          page: broadcastPage,
          limit: 15,
        }
      });
      if (res.data?.status === 'success') {
        setBroadcasts(res.data.data || []);
        if (res.data.pagination) {
          setBroadcastTotalPages(res.data.pagination.totalPages || 1);
          setBroadcastTotal(res.data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch broadcast history:', err);
      toast.error('Failed to load broadcast history');
    } finally {
      setBroadcastLoading(false);
    }
  }, [user?.token, authHeaders, broadcastSearch, broadcastPage]);

  // Initial Fetch & Tab Changes
  useEffect(() => {
    if (activeSubTab === 'sos') {
      fetchSosHistory();
    } else {
      fetchBroadcastHistory();
    }
  }, [activeSubTab, fetchSosHistory, fetchBroadcastHistory]);

  // Socket Listener for Live Updates
  useEffect(() => {
    if (!user?.token) return;

    const socket = io(SOCKET_URL, {
      auth: { token: user.token },
      transports: ['websocket', 'polling'],
    });

    socket.on('sos.triggered', () => {
      toast.error('🚨 New Emergency SOS Triggered!', { duration: 6000 });
      fetchSosHistory();
    });

    socket.on('sos.cancelled', () => {
      fetchSosHistory();
    });

    socket.on('broadcast.created', () => {
      fetchBroadcastHistory();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.token, fetchSosHistory, fetchBroadcastHistory]);

  // Handle Resolve SOS
  const handleResolveSubmit = async (e) => {
    e?.preventDefault();
    if (!resolvingAlert) return;
    setIsSubmittingResolve(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/sos/${resolvingAlert.id}/resolve`,
        { notes: resolveNotes.trim() },
        authHeaders
      );
      toast.success('SOS Alert marked as Resolved');
      setResolvingAlert(null);
      setResolveNotes('');
      fetchSosHistory();
    } catch (err) {
      console.error('Failed to resolve SOS:', err);
      toast.error(err?.response?.data?.message || 'Failed to resolve SOS alert');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Handle Send Broadcast
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!newBroadcastMessage.trim()) {
      toast.error('Please enter a broadcast message');
      return;
    }
    setIsSendingBroadcast(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/broadcast`,
        {
          title: newBroadcastTitle.trim() || undefined,
          message: newBroadcastMessage.trim(),
          sender: newBroadcastSender.trim() || 'Administration',
        },
        authHeaders
      );
      toast.success('Broadcast notice sent to all users!');
      setNewBroadcastTitle('');
      setNewBroadcastMessage('');
      fetchBroadcastHistory();
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      toast.error(err?.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Handle Delete Broadcast
  const handleDeleteBroadcast = async (id) => {
    if (!window.confirm('Are you sure you want to delete this broadcast notice?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/broadcast/${id}`, authHeaders);
      toast.success('Broadcast notice deleted');
      fetchBroadcastHistory();
    } catch (err) {
      console.error('Failed to delete broadcast:', err);
      toast.error('Failed to delete broadcast notice');
    }
  };

  // Helper to format date & time
  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper to get bus number for route
  const getBusNumberForRoute = (routeId) => {
    const route = routesList.find(r => String(r.routeId || r.route_id) === String(routeId));
    return route?.busNumber || route?.bus_number || route?.bus?.busNumber || '—';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 m-0">
                  Alerts & Communications History
                </h2>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 m-0">
                  Complete audit log of Emergency SOS alerts and broadcast notices
                </p>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Switcher */}
          <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl self-start md:self-auto">
            <button
              onClick={() => setActiveSubTab('sos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
                activeSubTab === 'sos'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <AlertTriangle size={17} />
              <span>Emergency SOS</span>
              {sosStats.active > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white text-red-600 animate-pulse">
                  {sosStats.active}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('broadcast')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
                activeSubTab === 'broadcast'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Megaphone size={17} />
              <span>Broadcast Notices</span>
              {broadcastTotal > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {broadcastTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* SOS Summary Metric Badges (when on SOS tab) */}
        {activeSubTab === 'sos' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Active Alerts</span>
                {sosStats.active > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>}
              </div>
              <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1 mb-0">{sosStats.active}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Resolved</span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 mb-0">{sosStats.resolved}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student Cancelled</span>
              <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1 mb-0">{sosStats.cancelled}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Received</span>
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1 mb-0">{sosStats.totalAll}</p>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 🚨 SUB-TAB 1: EMERGENCY SOS LOGS                         */}
      {/* ======================================================== */}
      {activeSubTab === 'sos' && (
        <div className="space-y-4">
          {/* Active Alert Warning Banner if any active */}
          {sosStats.active > 0 && (
            <div className="p-4 rounded-2xl bg-red-500 text-white flex items-center justify-between gap-3 shadow-lg animate-pulse">
              <div className="flex items-center gap-3">
                <AlertOctagon size={28} className="shrink-0" />
                <div>
                  <h4 className="font-bold text-base m-0">ATTENTION: {sosStats.active} Active Emergency Alert{sosStats.active > 1 ? 's' : ''}!</h4>
                  <p className="text-xs text-red-100 m-0">Immediate response required. Review below and coordinate with driver/student.</p>
                </div>
              </div>
              <button
                onClick={() => setSosStatusFilter('active')}
                className="px-3.5 py-1.5 rounded-xl bg-white text-red-600 font-bold text-xs hover:bg-red-50 transition-colors border-none cursor-pointer shrink-0 shadow-sm"
              >
                View Active
              </button>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or ID..."
                value={sosSearch}
                onChange={(e) => { setSosSearch(e.target.value); setSosPage(1); }}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <Filter size={15} className="text-slate-400" />
                <select
                  value={sosStatusFilter}
                  onChange={(e) => { setSosStatusFilter(e.target.value); setSosPage(1); }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="resolved">Resolved</option>
                  <option value="cancelled">Student Cancelled</option>
                </select>
              </div>

              <select
                value={sosRouteFilter}
                onChange={(e) => { setSosRouteFilter(e.target.value); setSosPage(1); }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Routes</option>
                {routesList.map(r => (
                  <option key={r.routeId || r.route_id} value={String(r.routeId || r.route_id)}>
                    Route {r.routeId || r.route_id}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchSosHistory}
                title="Refresh SOS logs"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RotateCw size={17} className={sosLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* SOS Table Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Route & Bus</th>
                    <th className="py-3 px-4">Triggered Time</th>
                    <th className="py-3 px-4">Resolution Details</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {sosAlerts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <AlertTriangle size={36} className="mx-auto mb-2 opacity-30" />
                        <p className="font-semibold m-0">No SOS emergency alerts match your criteria</p>
                      </td>
                    </tr>
                  ) : (
                    sosAlerts.map((alert) => {
                      const isActive = alert.status === 'active';
                      const isResolved = alert.status === 'resolved';
                      const isCancelled = alert.status === 'cancelled';
                      const busNo = getBusNumberForRoute(alert.route);

                      return (
                        <tr 
                          key={alert.id} 
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            isActive ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                          }`}
                        >
                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-500 text-white shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                                ACTIVE SOS
                              </span>
                            )}
                            {isResolved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 size={13} />
                                Resolved
                              </span>
                            )}
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <XCircle size={13} />
                                Cancelled
                              </span>
                            )}
                          </td>

                          {/* Student Info */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {alert.passenger || 'Unknown'}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              ID: {alert.login_id}
                            </div>
                          </td>

                          {/* Route & Bus */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                              <MapPin size={14} className="text-blue-500" />
                              <span>Route {alert.route}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Bus size={12} />
                              <span>Bus: {busNo}</span>
                            </div>
                          </td>

                          {/* Trigger Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-slate-700 dark:text-slate-300 font-medium">
                              {formatDateTime(alert.timestamp)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {alert.time}
                            </div>
                          </td>

                          {/* Resolution Details */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {isActive ? (
                              <span className="text-xs text-red-500 font-bold italic">Unresolved — Pending Action</span>
                            ) : (
                              <div className="text-xs space-y-0.5">
                                <div className="text-slate-700 dark:text-slate-300 font-semibold">
                                  {isResolved ? 'Resolved by: ' : 'Cancelled by: '} 
                                  <span className="text-blue-600 dark:text-blue-400">{alert.resolved_by || 'User'}</span>
                                </div>
                                {alert.resolved_at && (
                                  <div className="text-slate-400">
                                    at {formatDateTime(alert.resolved_at)}
                                  </div>
                                )}
                                {alert.notes && (
                                  <div className="text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800 p-1 rounded">
                                    "{alert.notes}"
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {isActive ? (
                              <button
                                onClick={() => { setResolvingAlert(alert); setResolveNotes(''); }}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ml-auto border-none cursor-pointer"
                              >
                                <Check size={14} />
                                <span>Mark Resolved</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Closed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sosTotalPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Page {sosPage} of {sosTotalPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={sosPage <= 1}
                    onClick={() => setSosPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={sosPage >= sosTotalPages}
                    onClick={() => setSosPage(p => Math.min(sosTotalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 📢 SUB-TAB 2: BROADCAST NOTICES & HISTORY                 */}
      {/* ======================================================== */}
      {activeSubTab === 'broadcast' && (
        <div className="space-y-6">
          {/* Compose New Broadcast Notice Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/40 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-emerald-600 text-white">
                <Megaphone size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Send Live Broadcast Notice</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 m-0">Pushes instantly to all passengers via FCM notification and live socket</p>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notice Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weather Alert, Route 3 Delay..."
                    value={newBroadcastTitle}
                    onChange={(e) => setNewBroadcastTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Attribution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Transport Office"
                    value={newBroadcastSender}
                    onChange={(e) => setNewBroadcastSender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Type official announcement here..."
                  value={newBroadcastMessage}
                  onChange={(e) => setNewBroadcastMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 border-none cursor-pointer"
                >
                  <Send size={16} />
                  <span>{isSendingBroadcast ? 'Sending Push...' : 'Broadcast to All Passengers'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Broadcasts History Header & Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search announcement history..."
                value={broadcastSearch}
                onChange={(e) => { setBroadcastSearch(e.target.value); setBroadcastPage(1); }}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Total Broadcasts: <strong className="text-slate-800 dark:text-slate-200">{broadcastTotal}</strong>
              </span>
              <button
                onClick={fetchBroadcastHistory}
                title="Refresh broadcast history"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RotateCw size={17} className={broadcastLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Broadcasts List / Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {broadcasts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="font-semibold m-0">No broadcast notices found</p>
                </div>
              ) : (
                broadcasts.map((item) => (
                  <div key={item.id} className="p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          {item.title || 'Announcement'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          {formatDateTime(item.timestamp)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          • By <strong className="text-slate-700 dark:text-slate-300">{item.sender}</strong>
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal m-0 whitespace-pre-wrap">
                        {item.message}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteBroadcast(item.id)}
                      className="self-end md:self-start p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border-none bg-transparent cursor-pointer shrink-0"
                      title="Delete this notice"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {broadcastTotalPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Page {broadcastPage} of {broadcastTotalPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={broadcastPage <= 1}
                    onClick={() => setBroadcastPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={broadcastPage >= broadcastTotalPages}
                    onClick={() => setBroadcastPage(p => Math.min(broadcastTotalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RESOLVE SOS MODAL                                        */}
      {/* ======================================================== */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-up space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                <CheckCircle2 size={24} />
                <span>Resolve SOS Emergency</span>
              </div>
              <button
                onClick={() => setResolvingAlert(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
              <div>Student: <strong className="text-slate-800 dark:text-slate-100">{resolvingAlert.passenger} ({resolvingAlert.login_id})</strong></div>
              <div>Route: <strong className="text-slate-800 dark:text-slate-100">Route {resolvingAlert.route} (Bus {getBusNumberForRoute(resolvingAlert.route)})</strong></div>
              <div>Triggered at: <strong className="text-slate-800 dark:text-slate-100">{formatDateTime(resolvingAlert.timestamp)}</strong></div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Resolution Notes / Action Taken (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Driver assisted student, bus safely reached destination, student safe."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50 border-none cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>{isSubmittingResolve ? 'Saving...' : 'Confirm Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
