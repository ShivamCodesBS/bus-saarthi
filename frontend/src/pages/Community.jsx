import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Plus, Image as ImageIcon, Video, Mic, X, ThumbsUp, ShieldAlert, CheckCircle2, UserCircle2, Search, SlidersHorizontal, TrendingUp, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';

const CATEGORIES = ['AC Problem', 'Late Arrival', 'Rash Driving', 'Overcrowding', 'Cleanliness', 'Driver Behavior', 'Route Issue', 'Other'];

const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [newComplaintText, setNewComplaintText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaFile, setMediaFile] = useState(null);
  const [processingUpvotes, setProcessingUpvotes] = useState(new Set());
  const [mediaType, setMediaType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'most_agreed'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'resolved'
  const [filterRoute, setFilterRoute] = useState('all'); // 'all' | user's route
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Route name lookup — fetched from backend
  const [routeMap, setRouteMap] = useState({});

  const formatTime = (createdAtStr) => {
    if (!createdAtStr) return t('justNow') || 'Just now';
    const date = new Date(createdAtStr);
    if (isNaN(date.getTime())) return createdAtStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return lang === 'hi' ? 'अभी-अभी' : 'Just now';
    if (diffMins < 60) return lang === 'hi' ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
    if (diffHours < 24) return lang === 'hi' ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
    if (diffDays === 1) return lang === 'hi' ? 'कल' : 'Yesterday';
    if (diffDays < 7) return lang === 'hi' ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { month: 'short', day: 'numeric' });
  };

  // Fetch complaints + routes in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
        const headers = { Authorization: `Bearer ${token}` };
        const [grievancesRes, routesRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/grievances`, { headers }),
          axios.get(`${BACKEND_URL}/api/routes`, { headers }).catch(() => ({ data: [] })),
        ]);
        const data = Array.isArray(grievancesRes.data) ? grievancesRes.data : (grievancesRes.data?.data || []);
        setComplaints(data);

        // Build routeId → friendly name map
        const routes = Array.isArray(routesRes.data) ? routesRes.data : [];
        const map = {};
        routes.forEach(r => { map[r.routeId] = r.routeName || `Route ${r.routeId}`; });
        setRouteMap(map);
      } catch (error) {
        console.error("Failed to load grievances", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.token]);

  // Helper: convert raw routeId '4' → 'Bus 4' or actual name
  const formatRoute = (routeId) => {
    if (!routeId || routeId === 'unknown') return 'Unknown Route';
    return routeMap[routeId] || `Bus ${routeId}`;
  };

  // Derived stats
  const stats = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    const totalAgreements = complaints.reduce((sum, c) => sum + (c.upvotes || 0), 0);
    return { total, resolved, pending: total - resolved, totalAgreements };
  }, [complaints]);

  // Filtered + sorted complaints
  const filteredComplaints = useMemo(() => {
    let list = [...complaints];

    // Route filter
    if (filterRoute === 'mine') {
      const myRoute = user?.route_id || user?.routeId;
      if (myRoute) list = list.filter(c => String(c.route || c.routeId) === String(myRoute));
    }

    // Status filter
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qWithoutHash = q.replace(/^#/, '');
      
      list = list.filter(c => {
        const textMatch = (c.text || '').toLowerCase().includes(q);
        const routeIdMatch = String(c.route || '').toLowerCase().includes(q);
        const routeNameMatch = formatRoute(c.route).toLowerCase().includes(q);
        const statusMatch = (c.status || '').toLowerCase().includes(q);
        
        const ticketId = (c.id || c._id || '').substring(0, 6).toLowerCase();
        const ticketIdMatch = ticketId ? (ticketId.includes(qWithoutHash) || q.includes(ticketId)) : false;
        
        return textMatch || routeIdMatch || routeNameMatch || statusMatch || ticketIdMatch;
      });
    }

    // Sort
    if (sortBy === 'newest') list.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
    else if (sortBy === 'oldest') list.sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));
    else if (sortBy === 'most_agreed') list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

    return list;
  }, [complaints, filterRoute, filterStatus, searchQuery, sortBy, user]);

  const handlePostComplaint = async (e) => {
    e.preventDefault();
    if (!newComplaintText.trim()) return;
    setIsUploading(true);
    let uploadedMediaUrl = '';
    if (mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      try {
        const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
        const uploadRes = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (uploadRes.data.url) uploadedMediaUrl = uploadRes.data.url;
      } catch (err) {
        toast.error("Failed to upload media. Posting text only.");
      }
    }
    try {
      const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
      const payload = {
        realName: user?.name || 'Passenger User',
        login_id: user?.login_id || 'Unknown',
        text: newComplaintText,
        type: mediaFile ? mediaType : 'text',
        mediaUrl: uploadedMediaUrl,
        category: selectedCategory,
        route: user?.route_id || 'Route 4',
        time: 'Just now'
      };
      const response = await axios.post(`${BACKEND_URL}/api/grievance`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.status === 'success' || response.status === 201) {
        const newComp = { ...payload, id: response.data.id, upvotes: 0, status: 'pending', createdAt: new Date().toISOString() };
        setComplaints([newComp, ...complaints]);
        setShowModal(false);
        setNewComplaintText('');
        setSelectedCategory('');
        setMediaFile(null);
        setMediaType('');
        toast.success("Complaint raised anonymously!");
      }
    } catch (error) {
      toast.error("Failed to submit. Please try again.");
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
    const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
    if (!token) { toast.error("You must be logged in to agree."); return; }
    setProcessingUpvotes(prev => new Set([...prev, id]));
    setComplaints(complaints.map(c => {
      const compId = c.id || c._id;
      if (compId === id) {
        const isCurrentlyUpvoted = !!c.hasUpvotedLocally;
        return { ...c, hasUpvotedLocally: !isCurrentlyUpvoted, upvotes: isCurrentlyUpvoted ? Math.max(0, (c.upvotes || 0) - 1) : (c.upvotes || 0) + 1 };
      }
      return c;
    }));
    try {
      const res = await axios.post(`${BACKEND_URL}/api/grievance/${id}/upvote`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
      setComplaints(prev => prev.map(c => (c.id || c._id) === id ? { ...c, upvotes: res.data.upvotes ?? c.upvotes } : c));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upvote");
      setComplaints(prev => prev.map(c => {
        const compId = c.id || c._id;
        if (compId === id) {
          const wasUpvoted = !!c.hasUpvotedLocally;
          return { ...c, hasUpvotedLocally: !wasUpvoted, upvotes: wasUpvoted ? Math.max(0, (c.upvotes || 0) - 1) : (c.upvotes || 0) + 1 };
        }
        return c;
      }));
    } finally {
      setProcessingUpvotes(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleResolve = async (id) => {
    if (!isAdmin) return;
    try {
      const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
      await axios.patch(`${BACKEND_URL}/api/grievance/${id}/resolve`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
      setComplaints(complaints.map(c => (c.id === id || c._id === id) ? { ...c, status: 'resolved' } : c));
      toast.success("Complaint resolved!");
    } catch (err) {
      toast.error("Failed to resolve complaint.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Unified Hero Header — contains title + stats + search all in blue zone */}
      <div className="sticky top-0" style={{ backgroundColor: 'var(--primary-blue)', zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        {/* Top Row: Back + Title + Search + Sort + Filter */}
        <div className="p-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', paddingBottom: '0.75rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: 'white' }}>{t('grievancePortal')}</h1>
              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                <span>{stats.total} Total</span>
                <span>•</span>
                <span style={{ color: '#fcd34d' }}>{stats.pending} Pending</span>
                <span>•</span>
                <span style={{ color: '#86efac' }}>{stats.resolved} Resolved</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, gap: '0.6rem', alignItems: 'center', minWidth: '300px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '350px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.6)' }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.2rem', paddingRight: '0.9rem', paddingTop: '0.55rem', paddingBottom: '0.55rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.25)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', backgroundColor: 'rgba(255,255,255,0.14)', color: 'white', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
              {[
                { key: 'newest', icon: <Clock size={12} />, label: 'New' },
                { key: 'most_agreed', icon: <TrendingUp size={12} />, label: 'Top' },
                { key: 'oldest', icon: <Clock size={12} />, label: 'Old' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setSortBy(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.45rem 0.65rem', borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700',
                  backgroundColor: sortBy === tab.key ? 'white' : 'rgba(255,255,255,0.12)',
                  color: sortBy === tab.key ? 'var(--primary-blue)' : 'white',
                  transition: 'all 0.15s'
                }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ background: showFilters ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', padding: '0.45rem 0.85rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: '700' }}
            >
              <SlidersHorizontal size={14} /> Filter
            </button>
          </div>
        </div>

        {/* Collapsible extra filters */}
        {showFilters && (
          <div style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '0.875rem', maxWidth: '850px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '0.75rem' }}>
            {/* Status filter */}
            {['all', 'pending', 'resolved'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid var(--border-color)',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600',
                  backgroundColor: filterStatus === s ? '#28a745' : 'transparent',
                  color: filterStatus === s ? 'white' : 'var(--text-dark)',
                }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
                <button onClick={() => setFilterRoute(filterRoute === 'mine' ? 'all' : 'mine')} style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600',
                backgroundColor: filterRoute === 'mine' ? 'var(--secondary-orange)' : 'rgba(255,255,255,0.12)',
                color: 'white',
              }}>
                <MapPin size={12} /> My Route Only
              </button>
          </div>
        )}
      </div>

      {/* Feed Area */}
      <main className="p-main pb-24" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="glass p-glass" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', opacity: 1 - (i * 0.2) }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e9ecef' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="animate-pulse" style={{ width: '120px', height: '14px', borderRadius: '4px', backgroundColor: '#e9ecef' }}></div>
                    <div className="animate-pulse" style={{ width: '80px', height: '10px', borderRadius: '4px', backgroundColor: '#e9ecef' }}></div>
                  </div>
                </div>
                <div className="animate-pulse" style={{ width: '100%', height: '14px', borderRadius: '4px', backgroundColor: '#e9ecef', marginTop: '0.5rem' }}></div>
                <div className="animate-pulse" style={{ width: '80%', height: '14px', borderRadius: '4px', backgroundColor: '#e9ecef' }}></div>
              </div>
            ))}
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-light)' }}>
            <ShieldAlert size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <p style={{ fontWeight: '600' }}>No complaints found</p>
            <p style={{ fontSize: '0.85rem' }}>Try adjusting your filters</p>
          </div>
        ) : filteredComplaints.map((comp) => (
          <div key={comp.id || comp._id} className="glass animate-slide-up p-glass" style={{
            borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            {/* Header of Post */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '50%' }}>
                  <UserCircle2 size={24} color="var(--text-light)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                    {isAdmin ? <span style={{ color: 'var(--primary-blue)' }}>{comp.realName} ({t('realName')})</span> : t('anonymousPassenger')}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {formatRoute(comp.route)} • {formatTime(comp.created_at || comp.createdAt || comp.time)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-light)', backgroundColor: '#f1f3f5', padding: '0.25rem 0.4rem', borderRadius: '6px', fontFamily: 'monospace' }}>
                    #{ (comp.id || comp._id).substring(0, 6).toUpperCase() }
                  </span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px',
                    backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0',
                    color: comp.status === 'resolved' ? '#28a745' : '#cf1322',
                    display: 'flex', alignItems: 'center', gap: '0.25rem'
                  }}>
                    {comp.status === 'resolved' ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                    {comp.status === 'resolved' ? t('resolved') : t('pending')}
                  </span>
                </div>
                {comp.category && (
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(24,119,242,0.1)', color: 'var(--primary-blue)' }}>
                    {comp.category}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
              {comp.text}
            </p>

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

            {/* Upvote & Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => handleUpvote(comp.id || comp._id)} disabled={processingUpvotes.has(comp.id || comp._id)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none',
                backgroundColor: comp.hasUpvotedLocally ? 'var(--primary-blue)' : 'transparent',
                color: comp.hasUpvotedLocally ? 'white' : 'var(--primary-blue)',
                fontWeight: '600', cursor: processingUpvotes.has(comp.id || comp._id) ? 'default' : 'pointer',
                padding: '0.5rem 1rem', borderRadius: '30px', transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => !processingUpvotes.has(comp.id || comp._id) && !comp.hasUpvotedLocally && (e.currentTarget.style.backgroundColor = '#e6f0fa')}
                onMouseLeave={e => !processingUpvotes.has(comp.id || comp._id) && !comp.hasUpvotedLocally && (e.currentTarget.style.backgroundColor = 'transparent')}>
                <ThumbsUp size={20} strokeWidth={2.5} fill={comp.hasUpvotedLocally ? 'white' : 'none'} /> {comp.upvotes || 0} {comp.hasUpvotedLocally ? 'Agreed' : t('agree')}
              </button>

              {isAdmin && comp.status === 'pending' && (
                <button onClick={() => handleResolve(comp.id || comp._id)} style={{
                  backgroundColor: 'var(--secondary-orange)', color: 'white', border: 'none',
                  padding: '0.4rem 1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer'
                }}>
                  {t('markResolved')}
                </button>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Floating Action Button */}
      {!isAdmin && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: 'fixed', bottom: '2rem', right: '2rem', width: '60px', height: '60px',
            borderRadius: '50%', backgroundColor: 'var(--secondary-orange)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 102, 0, 0.4)', border: 'none', cursor: 'pointer',
            zIndex: 20, transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={32} />
        </button>
      )}

      {/* Raise Complaint Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div className="animate-slide-up p-glass" style={{
            backgroundColor: 'var(--card-bg)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-blue)' }}>Raise a Grievance</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Your name will be hidden from other passengers.</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f8f9fa', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}>
                <X size={24} color="var(--text-dark)" />
              </button>
            </div>

            <form onSubmit={handlePostComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Category Selection */}
              <div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark)' }}>Category (optional)</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)} style={{
                      padding: '0.3rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: selectedCategory === cat ? 'var(--primary-blue)' : 'var(--bg-color)',
                      color: selectedCategory === cat ? 'white' : 'var(--text-dark)',
                      transition: 'all 0.15s'
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                placeholder="What's the issue? (e.g. Bus is overcrowded, Rash driving...)"
                rows={4}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                  fontSize: '1rem', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => triggerFileInput('photo')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: mediaType === 'photo' ? '#e6f0fa' : 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <ImageIcon size={18} color="var(--primary-blue)" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Photo</span>
                  </button>
                  <button type="button" onClick={() => triggerFileInput('video')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: mediaType === 'video' ? '#fdeced' : 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <Video size={18} color="#cf1322" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Video</span>
                  </button>
                  <button type="button" onClick={() => triggerFileInput('audio')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: mediaType === 'audio' ? '#fff0e6' : 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <Mic size={18} color="var(--secondary-orange)" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Audio</span>
                  </button>
                </div>
                {mediaFile && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-blue)', fontWeight: 'bold' }}>
                    {mediaFile.name.length > 15 ? mediaFile.name.substring(0, 15) + '...' : mediaFile.name}
                  </span>
                )}
              </div>
              <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />

              <button type="submit" disabled={isUploading} className="btn btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', marginTop: '0.5rem', opacity: isUploading ? 0.7 : 1 }}>
                {isUploading ? 'Uploading...' : 'Post Complaint Anonymously'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
