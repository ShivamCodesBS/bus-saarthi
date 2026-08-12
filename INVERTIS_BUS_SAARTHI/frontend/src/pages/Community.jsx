import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Image as ImageIcon, Video, Mic, X, ThumbsUp, ShieldAlert, CheckCircle2, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';

const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [newComplaintText, setNewComplaintText] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaFile, setMediaFile] = useState(null);
  const [processingUpvotes, setProcessingUpvotes] = useState(new Set());
  const [mediaType, setMediaType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  const formatTime = (createdAtStr) => {
    if (!createdAtStr) return t('justNow') || 'Just now';
    const date = new Date(createdAtStr);
    if (isNaN(date.getTime())) {
      return createdAtStr; // fallback for badly formatted dates
    }
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return lang === 'hi' ? 'अभी-अभी' : 'Just now';
    }
    if (diffMins < 60) {
      return lang === 'hi' ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return lang === 'hi' ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return lang === 'hi' ? 'कल' : 'Yesterday';
    }
    if (diffDays < 7) {
      return lang === 'hi' ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
    }
    
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Fetch complaints from backend
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
        const response = await axios.get(`${BACKEND_URL}/api/grievances`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // Backend returns array directly (NestJS) or { status, data } (old)
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setComplaints(data);
      } catch (error) {
        console.error("Failed to load grievances", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
  }, []);

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
        if (uploadRes.data.url) {
          uploadedMediaUrl = uploadRes.data.url;
        }
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
        media_url: uploadedMediaUrl,
        route: user?.route_id || 'Route 4',
        time: 'Just now'
      };

      const response = await axios.post(`${BACKEND_URL}/api/grievance`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.status === 'success' || response.status === 201) {
        // Add locally to feed immediately
        const newComp = { ...payload, id: response.data.id, upvotes: 0, status: 'pending', createdAt: new Date().toISOString() };
        setComplaints([newComp, ...complaints]);
        setShowModal(false);
        setNewComplaintText('');
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
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0]);
    }
  };

  const handleUpvote = async (id) => {
    if (processingUpvotes.has(id)) return;
    setProcessingUpvotes(prev => new Set([...prev, id]));
    
    try {
      const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
      if (!token) {
        toast.error("You must be logged in to agree.");
        return;
      }
      // Use POST (NestJS backend), falls back to PUT for legacy
      const res = await axios.post(`${BACKEND_URL}/api/grievance/${id}/upvote`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setComplaints(complaints.map(c => {
        // Support both id and _id field names
        const compId = c.id || c._id;
        if (compId === id) {
          const newUpvotes = res.data.upvotes ?? ((c.upvotes || 0) + 1);
          return { ...c, upvotes: newUpvotes };
        }
        return c;
      }));
    } catch (err) {
      console.error("Failed to upvote", err);
      toast.error(err.response?.data?.message || "Failed to upvote");
    } finally {
      setProcessingUpvotes(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleResolve = async (id) => {
    if (!isAdmin) return;
    try {
      const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
      // Use PATCH (NestJS correct method)
      await axios.patch(`${BACKEND_URL}/api/grievance/${id}/resolve`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setComplaints(complaints.map(c =>
        (c.id === id || c._id === id) ? { ...c, status: 'resolved' } : c
      ));
    } catch (err) {
      toast.error("Failed to resolve complaint.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="p-header sticky top-0" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'var(--primary-blue)', color: 'white',
        boxShadow: 'var(--shadow)', zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>{t('grievancePortal')}</h1>
            <p style={{ fontSize: '0.75rem', margin: 0, opacity: 0.8 }}>{t('anonymousPassengerFeed')}</p>
          </div>
        </div>
      </header>

      {/* Feed Area */}
      <main className="p-main pb-24" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-light)' }}>{t('loadingGrievances')}</div>
        ) : complaints.map((comp) => (
          <div key={comp._id} className="glass animate-slide-up p-glass" style={{
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
                    {comp.route} • {formatTime(comp.created_at || comp.time)}
                  </p>
                </div>
              </div>

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

            {/* Content */}
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
              {comp.text}
            </p>

            {/* Media Attachment */}
            {comp.type === 'photo' && comp.media_url && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center' }}>
                <img src={comp.media_url} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain' }} />
              </div>
            )}

            {comp.type === 'video' && comp.media_url && (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video src={comp.media_url} controls style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }} />
              </div>
            )}

            {comp.type === 'audio' && comp.media_url && (
              <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                <audio src={comp.media_url} controls style={{ width: '100%' }} />
              </div>
            )}

            {/* Upvote & Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => handleUpvote(comp._id)} disabled={processingUpvotes.has(comp._id)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none',
                color: processingUpvotes.has(comp._id) ? 'var(--text-light)' : 'var(--primary-blue)', 
                fontWeight: '600', cursor: processingUpvotes.has(comp._id) ? 'wait' : 'pointer', 
                padding: '0.5rem', borderRadius: '8px', transition: 'background-color 0.2s',
                opacity: processingUpvotes.has(comp._id) ? 0.6 : 1
              }} onMouseEnter={e => !processingUpvotes.has(comp._id) && (e.currentTarget.style.backgroundColor = '#e6f0fa')} 
                 onMouseLeave={e => !processingUpvotes.has(comp._id) && (e.currentTarget.style.backgroundColor = 'transparent')}>
                <ThumbsUp size={18} /> {comp.upvotes || 0} {t('agree')}
              </button>

              {isAdmin && comp.status === 'pending' && (
                <button onClick={() => handleResolve(comp._id)} style={{
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
            position: 'absolute', bottom: '2rem', right: '2rem', width: '60px', height: '60px',
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
            boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
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
              <textarea
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                placeholder="What's the issue? (e.g. Bus is overcrowded, Rash driving...)"
                rows={4}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                  fontSize: '1rem', outline: 'none', resize: 'none', fontFamily: 'inherit'
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
