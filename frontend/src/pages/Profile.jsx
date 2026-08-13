import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, MapPin, Bus, Shield, Camera, QrCode, CheckCircle2, XCircle, Clock, Activity, ShieldCheck, Mail, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';
import '../index.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { t, translateName } = useLang();
  const [profilePic, setProfilePic] = useState(user?.profile_pic || null);
  const fileInputRef = useRef(null);
  const [showIdCard, setShowIdCard] = useState(false);

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const loadingToast = toast.loading('Uploading profile picture...');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/upload/profile_pic`, formData, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (res.data.status === 'success') {
        setProfilePic(res.data.url);
        // Persist the updated profile_pic in local storage via AuthContext
        if (login && user) {
          login({ ...user, profile_pic: res.data.url });
        }
        toast.success('Profile picture updated!', { id: loadingToast });
      } else {
        toast.error('Upload failed: ' + (res.data.detail || 'Unknown error'), { id: loadingToast });
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Network error';
      toast.error('Failed to upload image: ' + msg, { id: loadingToast });
      console.error('Profile pic upload error:', err.response?.data || err);
    }
  };

  const [attendanceHistory, setAttendanceHistory] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const loginId = user?.loginId || user?.login_id || user?.id;
        if (!loginId) return;
        const res = await axios.get(`${BACKEND_URL}/api/attendance/user/${loginId}`);
        if (res.data.status === 'success') {
          setAttendanceHistory(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load attendance history', err);
      }
    };
    fetchAttendance();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--bg-color)]">
      {/* Header */}
      <header className="p-header sticky top-0" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--primary-blue)', color: 'white', zIndex: 10,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, letterSpacing: '0.5px' }}>{t('myProfile')}</h1>
        </div>

      </header>

      <main style={{ paddingBottom: '6rem' }}>
        {/* Profile Banner */}
        <div style={{
          backgroundColor: 'var(--primary-blue)', height: '120px',
          borderBottomLeftRadius: '35px', borderBottomRightRadius: '35px',
          position: 'relative', marginBottom: '5rem',
          boxShadow: '0 8px 20px rgba(18, 52, 86, 0.15)'
        }}>
          {/* Avatar */}
          <div style={{
            position: 'absolute', bottom: '-50px', left: '50%', transform: 'translateX(-50%)',
            width: '110px', height: '110px', backgroundColor: 'var(--white)', borderRadius: '50%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '5px solid var(--white)', overflow: 'hidden', zIndex: 5
          }}>
            {profilePic ? (
              <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={55} color="var(--primary-blue)" style={{ opacity: 0.8 }} />
            )}
            <button 
              onClick={() => fileInputRef.current.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--secondary-orange)',
                color: 'white', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Camera size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleProfilePicUpload} 
            />
          </div>
        </div>

        <div className="p-main" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-dark)', margin: '0 0 0.4rem 0' }}>
              {translateName(user?.name) || t('passengerProfile')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
                <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} color="var(--primary-blue)" />
                  {user?.role === 'admin' ? `${t('administrator')} | ID: ${user?.loginId || user?.login_id || 'N/A'}` : user?.role === 'driver' ? `${t('driver')} ID: ${user?.loginId || user?.login_id || 'N/A'}` : `ID: ${user?.loginId || user?.login_id || 'N/A'}`}
                </p>
                {user?.role === 'passenger' && (
                  <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #c3e6c3' }}>
                    {t('feePaidStatus')}
                  </span>
                )}
              </div>
              {user?.email && (
                <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} /> {user.email}
                </p>
              )}
            </div>
          </div>

          {/* Digital ID Card (Toggleable) */}
          {showIdCard && (
            <div className="animate-slide-up" style={{
              backgroundColor: 'var(--card-bg)', padding: '1.8rem', borderRadius: '24px',
              boxShadow: '0 12px 30px rgba(18, 52, 86, 0.1)', border: '2px solid var(--primary-blue)',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem',
              position: 'relative', overflow: 'hidden'
            }}>
              <h3 style={{ margin: 0, color: 'var(--primary-blue)', fontSize: '1.2rem', fontWeight: '800' }}>{t('digitalBusPass')}</h3>
              
              <div style={{ width: '160px', height: '160px', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', border: '1px solid #e9ecef', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                <QrCode size={110} color="var(--text-dark)" />
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: 0, fontWeight: '500' }}>{t('scanQrHint')}</p>
            </div>
          )}

          {/* Weekly Attendance (For Passengers) */}
          {user?.role === 'passenger' && (
            <div className="glass animate-slide-up p-glass" style={{ borderRadius: '24px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.15rem', color: 'var(--primary-blue)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} color="var(--primary-blue)" /> {t('weeklyAttendance')}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {attendanceHistory.length > 0 ? (
                  attendanceHistory.map((record, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', minWidth: '3.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase' }}>{t(record.day.toLowerCase())}</span>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: record.status === 'present' ? '#e6fae6' : '#fff1f0',
                        color: record.status === 'present' ? '#28a745' : '#cf1322',
                        boxShadow: record.status === 'present' ? '0 4px 10px rgba(40, 167, 69, 0.2)' : '0 4px 10px rgba(207, 19, 34, 0.2)'
                      }}>
                        {record.status === 'present' ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <XCircle size={22} strokeWidth={2.5} />}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '600' }}>{record.date}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ width: '100%', padding: '1.5rem', textAlign: 'center', color: 'var(--text-light)', fontWeight: '500', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                    No attendance records found for this week.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin / Transport Incharge Details Section */}
          {(user?.role === 'admin' || user?.role === 'transport_incharge') && (
            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Role & Access Level */}
              <div className="glass p-glass" style={{ borderRadius: '24px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.5)' }}>
                <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.15rem', color: 'var(--primary-blue)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Briefcase size={20} color="var(--primary-blue)" /> {t('roleAndAccess', 'Role & Access Level')}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#e9ecef', padding: '0.6rem', borderRadius: '12px', color: 'var(--primary-blue)' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>Designation</p>
                      <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-dark)', textTransform: 'capitalize' }}>
                        {user?.designation || (user?.role === 'admin' ? 'System Administrator' : 'Transport Incharge')}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#e9ecef', padding: '0.6rem', borderRadius: '12px', color: 'var(--primary-blue)' }}>
                      <Shield size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>Access Level</p>
                      <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #c3e6c3', display: 'inline-block', marginTop: '0.2rem' }}>
                        {user?.role === 'admin' ? 'Full Access - Fleet & Users' : 'Route & Driver Management'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* System & Activity Stats - Only shown if dynamic data exists */}
              {(user?.last_login || (user?.recent_actions && user?.recent_actions.length > 0)) && (
                <div className="glass p-glass" style={{ borderRadius: '24px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.5)' }}>
                  <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1.15rem', color: 'var(--primary-blue)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} color="var(--primary-blue)" /> System & Activity Stats
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    {user?.last_login && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#e9ecef', padding: '0.6rem', borderRadius: '12px', color: 'var(--primary-blue)' }}>
                          <Clock size={20} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600' }}>Last Login</p>
                          <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-dark)' }}>{user.last_login}</p>
                        </div>
                      </div>
                    )}

                    {user?.recent_actions && user.recent_actions.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: '600' }}>Recent Actions (Audit Log)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid #e9ecef', paddingLeft: '1.2rem', marginLeft: '0.6rem' }}>
                          {user.recent_actions.map((action, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '-1.55rem', top: '0.25rem', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)', border: '2.5px solid white', boxShadow: '0 0 0 1px var(--primary-blue)' }}></div>
                              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark)' }}>{action.title}</p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>{action.time}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
