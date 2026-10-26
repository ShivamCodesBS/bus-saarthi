import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  User,
  Bus,
  Shield,
  Camera,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Users,
  IdCard,
  CalendarDays,
  MapPin,
  Droplets,
  UserRound,
  IdCard as IdCardIcon,
  ShieldCheck,
  Fingerprint,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';
import '../index.css';
import { friendlyError } from '../lib/errors';
import UserAvatar from '../components/UserAvatar';
import { useStaleWhileRevalidate } from '../hooks/useStaleWhileRevalidate';
import { ProfileSkeleton, AttendanceGridSkeleton } from '../components/ui/skeleton';
import { setCacheData } from '../hooks/useStaleWhileRevalidate';

/** How each role is presented. The fields shown come from the User model. */
const ROLE_META = {
  passenger: {
    label: 'Student',
    Icon: GraduationCap,
    color: '#0056b3',
    tagline: 'Bus pass, attendance and complaints',
  },
  teacher: {
    label: 'Teacher / Staff',
    Icon: Briefcase,
    color: '#0f766e',
    tagline: 'Faculty transport pass and attendance',
  },
  parent: {
    label: 'Parent',
    Icon: Users,
    color: '#7c3aed',
    tagline: 'Track your child’s bus and complaints',
  },
  driver: {
    label: 'Driver',
    Icon: Bus,
    color: '#ea580c',
    tagline: 'Assigned bus and route',
  },
  transport_incharge: {
    label: 'Transport Incharge',
    Icon: Bus,
    color: '#28a745',
    tagline: 'Fleet, routes and driver management',
  },
  admin: {
    label: 'Administrator',
    Icon: Shield,
    color: '#dc2626',
    tagline: 'Full access to users, routes and complaints',
  },
  tech_admin: {
    label: 'System Administrator',
    Icon: ShieldCheck,
    color: '#dc2626',
    tagline: 'Full access to users, routes and complaints',
  },
};

const FEE_META = {
  paid: { label: 'Fee Paid', bg: '#e6fae6', color: '#28a745' },
  unpaid: { label: 'Fee Unpaid', bg: '#fff1f0', color: '#cf1322' },
  partial: { label: 'Fee Partially Paid', bg: '#fffbe6', color: '#d46b08' },
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const { t } = useLang();
  const fileInputRef = useRef(null);

  const loginId = user?.loginId || user?.login_id || user?.id;
  const role = user?.role || 'passenger';
  const roleMeta = ROLE_META[role] || ROLE_META.passenger;
  const RoleIcon = roleMeta.Icon;

  // Stale-while-revalidate for profile data
  const {
    data: profile,
    isLoading: profileLoading,
    isStale: profileStale,
    refetch: refetchProfile,
    setToken: setProfileToken,
  } = useStaleWhileRevalidate('/api/users/me', {
    cacheKey: 'user:profile',
    staleTime: 60000, // 60 seconds
    skip: !loginId,
    onData: (data) => {
      // Keep localStorage session in sync
      if (user) {
        login({
          ...user,
          profile_pic: data.profilePic ?? user.profile_pic,
          fee_status: data.feeStatus ?? user.fee_status,
          route_id: data.routeId ?? user.route_id,
          name: data.name ?? user.name,
        });
      }
    },
  });

  // Stale-while-revalidate for attendance summary
  const {
    data: attendance,
    isLoading: attendanceLoading,
    isStale: attendanceStale,
    refetch: refetchAttendance,
    setToken: setAttendanceToken,
  } = useStaleWhileRevalidate(`/api/attendance/user/${loginId}/summary?days=7`, {
    cacheKey: `user:attendance:${loginId}`,
    staleTime: 30000, // 30 seconds
    skip: !loginId,
  });

  // Set tokens when user changes
  useEffect(() => {
    if (user?.token) {
      setProfileToken(user.token);
      setAttendanceToken(user.token);
    }
  }, [user?.token, setProfileToken, setAttendanceToken]);

  // Show skeleton while initial load, then show cached data immediately
  const isInitialLoading = profileLoading && !profile;

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    const loadingToast = toast.loading('Uploading profile picture...');
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/upload/profile_pic`,
        formData,
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      if (res.data.status === 'success') {
        // Update cache immediately for instant UI feedback
        setCacheData('user:profile', { ...profile, profilePic: res.data.url });
        login({ ...user, profile_pic: res.data.url });
        toast.success('Profile picture updated!', { id: loadingToast });
      } else {
        toast.error('The upload did not succeed. Please try a smaller file.', {
          id: loadingToast,
        });
      }
    } catch (err) {
      toast.error(
        friendlyError(err, 'We could not upload the image. Please try again.'),
        { id: loadingToast },
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** The initials shown when the account has no picture. */
  const initials = (profile?.name || user?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

  const profilePic = profile?.profilePic || user?.profile_pic;
  const feeStatus = profile?.feeStatus || user?.fee_status;
  const feeMeta = FEE_META[feeStatus] || FEE_META.unpaid;

  /** One labelled value in a detail row. */
  const Detail = ({ icon: Icon, label, value, mono }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.7rem',
          padding: '0.6rem 0',
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'var(--bg-color)',
            color: 'var(--primary-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              color: 'var(--text-light)',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: '0.1rem 0 0',
              fontSize: '0.92rem',
              color: 'var(--text-dark)',
              fontWeight: '600',
              fontFamily: mono ? 'monospace' : 'inherit',
              overflowWrap: 'anywhere',
            }}
          >
            {value}
          </p>
        </div>
      </div>
    );
  };

  /** A titled card. */
  const Section = ({ title, icon: Icon, children, accent }) => (
    <section
      className="glass"
      style={{
        borderRadius: '18px',
        padding: '1.25rem',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 10px rgba(16,24,40,0.05)',
      }}
    >
      {title && (
        <h2
          style={{
            margin: '0 0 0.9rem',
            fontSize: '0.78rem',
            fontWeight: '800',
            color: accent || 'var(--primary-blue)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {Icon && <Icon size={15} />} {title}
        </h2>
      )}
      {children}
    </section>
  );

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="p-header sticky top-0"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          backgroundColor: 'var(--primary-blue)',
          color: 'white',
          zIndex: 40,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              padding: 0,
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <h1
            style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              margin: 0,
              letterSpacing: '-0.2px',
            }}
          >
            My Profile
          </h1>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(255,255,255,0.16)',
            border: '1px solid rgba(255,255,255,0.28)',
            color: 'white',
            borderRadius: '20px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          <LogOut size={14} /> Log out
        </button>
      </header>

      <main
        className="p-main"
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        {isInitialLoading ? (
          <ProfileSkeleton />
        ) : (
          <>
            {/* ── Identity card ─────────────────────────────────────── */}
            <section
          className="glass"
          style={{
            borderRadius: '18px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.9rem',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(16,24,40,0.05)',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              position: 'relative',
              width: '108px',
              height: '108px',
            }}
          >
            <UserAvatar
              src={profilePic}
              name={profile?.name || user?.name}
              size={108}
              className="border-[3px] border-[var(--border-color)]"
              style={{
                background: profilePic
                  ? 'var(--bg-color)'
                  : `linear-gradient(135deg, ${roleMeta.color}, ${roleMeta.color}cc)`,
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label="Change profile picture"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '32px',
                height: '32px',
                background: 'var(--secondary-orange)',
                color: 'white',
                border: '2px solid var(--card-bg)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isUploading ? 'default' : 'pointer',
              }}
            >
              <Camera size={15} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleProfilePicUpload}
            />
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.3rem',
                fontWeight: '800',
                color: 'var(--text-dark)',
                letterSpacing: '-0.3px',
              }}
            >
              {profile?.name || user?.name || '—'}
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                marginTop: '0.45rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: roleMeta.color + '18',
                  color: roleMeta.color,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                }}
              >
                <RoleIcon size={13} /> {roleMeta.label}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: 'var(--text-light)',
                  fontWeight: '700',
                }}
              >
                {loginId}
              </span>
            </div>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.82rem',
                color: 'var(--text-light)',
              }}
            >
              {roleMeta.tagline}
            </p>
          </div>

          {/* Fee status — only for the roles that pay a transport fee */}
          {(role === 'passenger' || role === 'teacher') && (
            <span
              style={{
                background: feeMeta.bg,
                color: feeMeta.color,
                padding: '0.35rem 0.9rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '800',
              }}
            >
              {feeMeta.label}
            </span>
          )}

          {/* Bus pass */}
          {(role === 'passenger' || role === 'teacher') && (
            <button
              onClick={() => setShowIdCard((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.7rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color)',
                color: 'var(--text-dark)',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              <IdCardIcon size={16} />
              {showIdCard ? 'Hide bus pass' : 'View bus pass'}
            </button>
          )}

          {showIdCard && (
            <div
              style={{
                width: '100%',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.9rem',
              }}
            >
              <div
                style={{
                  width: '132px',
                  height: '132px',
                  background: 'var(--card-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <QrCode size={96} color="var(--text-dark)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: 'var(--text-dark)',
                  }}
                >
                  {profile?.name || user?.name}
                </p>
                <p
                  style={{
                    margin: '0.2rem 0 0',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: 'var(--text-light)',
                  }}
                >
                  {loginId}
                </p>
                {profile?.routeId && (
                  <p
                    style={{
                      margin: '0.35rem 0 0',
                      fontSize: '0.8rem',
                      color: 'var(--text-light)',
                    }}
                  >
                    {profile.routeName || `Route ${profile.routeId}`}
                    {profile.busNumber ? ` · Bus ${profile.busNumber}` : ''}
                  </p>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.76rem',
                  color: 'var(--text-light)',
                  textAlign: 'center',
                }}
              >
                {t('scanQrHint')}
              </p>
            </div>
          )}
        </section>

        {/* ── Details ───────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minWidth: 0,
          }}
        >
          {/* Route & bus — everyone who is allocated to a route */}
          {profile?.routeId && (
            <Section title="Route & bus" icon={Bus}>
              <Detail
                icon={IdCard}
                label="Route"
                value={
                  profile.routeName
                    ? `${profile.routeName} (${profile.routeId})`
                    : `Route ${profile.routeId}`
                }
              />
              <Detail
                icon={Bus}
                label="Bus serving this route"
                value={profile.busNumber}
                mono
              />
              {profile.driverName && (
                <Detail icon={UserRound} label="Driver" value={profile.driverName} />
              )}
            </Section>
          )}

          {/* Contact */}
          <Section title="Contact" icon={Phone}>
            <Detail icon={Phone} label="Phone" value={profile?.phone} />
            <Detail icon={Mail} label="Email" value={profile?.email} />
            <Detail
              icon={MapPin}
              label="Address"
              value={profile?.address}
            />
          </Section>

          {/* Student / staff specifics */}
          {(role === 'passenger' || role === 'teacher') && (
            <Section title="Academic details" icon={GraduationCap}>
              <Detail
                icon={GraduationCap}
                label={role === 'teacher' ? 'Class / course' : 'Class'}
                value={profile?.gradeClass}
              />
              {role === 'teacher' && (
                <Detail
                  icon={Briefcase}
                  label="Subject"
                  value={profile?.subject}
                />
              )}
              <Detail
                icon={CalendarDays}
                label="Date of birth"
                value={
                  profile?.dob
                    ? new Date(profile.dob).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : null
                }
              />
              <Detail
                icon={Droplets}
                label="Blood group"
                value={profile?.bloodGroup}
              />
              <Detail
                icon={Users}
                label="Parent / guardian"
                value={profile?.parentName}
              />
              <Detail
                icon={Phone}
                label="Parent phone"
                value={profile?.parentPhone}
              />
            </Section>
          )}

          {/* Driver specifics */}
          {role === 'driver' && (
            <Section title="Licence" icon={IdCardIcon}>
              <Detail
                icon={IdCardIcon}
                label="Licence number"
                value={profile?.licenseNumber}
                mono
              />
              <Detail
                icon={CalendarDays}
                label="Licence expires"
                value={
                  profile?.licenseExpiry
                    ? new Date(profile.licenseExpiry).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : null
                }
              />
              <Detail
                icon={Clock}
                label="Experience"
                value={
                  profile?.experienceYears
                    ? `${profile.experienceYears} years`
                    : null
                }
              />
            </Section>
          )}

          {/* Staff specifics */}
          {(role === 'admin' ||
            role === 'tech_admin' ||
            role === 'transport_incharge') && (
            <Section title="Staff details" icon={Briefcase}>
              <Detail
                icon={Briefcase}
                label="Designation"
                value={profile?.designation}
              />
              <Detail
                icon={Phone}
                label="Phone"
                value={profile?.phone}
              />
              <Detail icon={Mail} label="Email" value={profile?.email} />
              <Detail
                icon={Clock}
                label="Last sign-in"
                value={
                  profile?.lastLogin
                    ? new Date(profile.lastLogin).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null
                }
              />
            </Section>
          )}

          {/* Face enrolment — only a student rides the bus */}
          {role === 'passenger' && (
            <Section title="Face recognition" icon={Fingerprint}>
              {profile?.faceEnrolledAt ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: '#28a745',
                  }}
                >
                  <CheckCircle2 size={17} />
                  Enrolled on{' '}
                  {new Date(profile.faceEnrolledAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: '#d46b08',
                  }}
                >
                  <AlertTriangle size={17} />
                  Not enrolled yet — visit the transport office
                </div>
              )}
            </Section>
          )}

          {/* Live attendance — from the bus app's face recognition */}
          {(role === 'passenger' || role === 'teacher') && (
            <Section title="Attendance" icon={CheckCircle2}>
              {attendance ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.4rem',
                      marginBottom: '0.9rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: '800',
                        color: 'var(--text-dark)',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {attendance.attendancePercent}%
                    </span>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-light)',
                        fontWeight: '600',
                      }}
                    >
                      present · {attendance.presentDays} of{' '}
                      {attendance.totalDays} days
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: '0.4rem',
                    }}
                  >
                    {attendance.days.map((day) => {
                      const date = new Date(day.date + 'T00:00:00');
                      const dow = date
                        .toLocaleDateString('en-IN', { weekday: 'short' })
                        .slice(0, 2);
                      return (
                        <div
                          key={day.date}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.35rem',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-light)',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                            }}
                          >
                            {dow}
                          </span>
                          <div
                            title={
                              day.present
                                ? `Present on ${day.date}`
                                : `Not on the bus on ${day.date}`
                            }
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              maxWidth: '38px',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: day.present
                                ? '#e6fae6'
                                : 'var(--bg-color)',
                              color: day.present ? '#28a745' : '#adb5bd',
                              border: `1px solid ${day.present ? '#c3e6c3' : 'var(--border-color)'}`,
                            }}
                          >
                            {day.present ? (
                              <CheckCircle2 size={17} strokeWidth={2.5} />
                            ) : (
                              <XCircle size={17} strokeWidth={2.5} />
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              color: 'var(--text-light)',
                              fontWeight: '600',
                            }}
                          >
                            {date.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {attendance.totalRecords > 0 && (
                    <p
                      style={{
                        margin: '0.9rem 0 0',
                        fontSize: '0.76rem',
                        color: 'var(--text-light)',
                      }}
                    >
                      {attendance.totalRecords} boarding
                      {attendance.totalRecords === 1 ? '' : 's'} recorded by the
                      bus scanner.
                    </p>
                  )}
                </>
              ) : (
                <AttendanceGridSkeleton />
              )}
            </Section>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Profile;
