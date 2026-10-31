import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLang } from '../context/LanguageContext';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  MapPin,
  Navigation,
  AlarmClock,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Compass,
  Plus,
  Minus,
  Crosshair,
  Check,
} from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import toast from 'react-hot-toast';

// Fix default leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const stopMarkerIcon = L.divIcon({
  className: 'custom-stop-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 4px 14px rgba(37,99,235,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const INVERTIS_CENTER = [28.3180, 79.4670]; // Invertis University
const VAPID_PUBLIC_KEY = 'BGhJZ_87jdyNrfmo6cZDJ7-ububtXfroy89VdBNNTn9o9837VbC3AVrUqJlzkd6PdI676sIQI-APdKayBup44EY';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Controller to handle single-click location marking, dragging, and invalidate size smoothly
function MapClickHandler({ onLocationSelect, setMapInstance }) {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, setMapInstance]);

  useMapEvents({
    click(e) {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}

const KM_OPTIONS = [1, 2, 3, 5];

const WakeAlarmModal = ({ onClose, onAlarmSet, user }) => {
  const { lang } = useLang();
  const [step, setStep] = useState('choose'); // 'choose' | 'gps' | 'map' | 'confirm'
  const [position, setPosition] = useState(INVERTIS_CENTER);
  const [thresholdKm, setThresholdKm] = useState(2);
  const [isCustomThreshold, setIsCustomThreshold] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [isMoving, setIsMoving] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

  useModalA11y(true, onClose);

  // Keyboard navigation for PC arrow keys (↑ ↓ ← → and WASD)
  useEffect(() => {
    if (step !== 'map' || !mapInstance) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const panDistance = 100;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        mapInstance.panBy([0, -panDistance]);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        mapInstance.panBy([0, panDistance]);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        mapInstance.panBy([-panDistance, 0]);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        mapInstance.panBy([panDistance, 0]);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        mapInstance.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        mapInstance.zoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, mapInstance]);

  const handleUseGPS = useCallback(() => {
    setStep('gps');
    setGpsStatus('loading');
    if (!navigator.geolocation) {
      setGpsStatus('error');
      toast.error(lang === 'hi' ? 'इस डिवाइस पर GPS समर्थित नहीं है' : 'GPS not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        setGpsStatus('success');
        setStep('confirm');
      },
      () => {
        setGpsStatus('error');
        toast.error(lang === 'hi' ? 'स्थान का पता नहीं चल सका। मानचित्र पर चुनें।' : 'Could not detect location. Try setting it on map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [lang]);

  const handleSetOnMap = () => {
    setStep('map');
  };

  const handleFlyTo = (coords, zoom = 16) => {
    setPosition(coords);
    if (mapInstance) {
      mapInstance.flyTo(coords, zoom, { duration: 0.8 });
    }
  };

  const handleLocateMeOnMap = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported');
      return;
    }
    toast.loading(lang === 'hi' ? 'GPS लोकेशन खोजी जा रही है...' : 'Finding your location...', { id: 'gps-locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss('gps-locating');
        const coords = [pos.coords.latitude, pos.coords.longitude];
        handleFlyTo(coords, 16);
        toast.success(lang === 'hi' ? 'आपकी लोकेशन पर केंद्रित किया गया' : 'Centered on your location');
      },
      () => {
        toast.dismiss('gps-locating');
        toast.error(lang === 'hi' ? 'GPS लोकेशन नहीं मिल सकी' : 'Could not get GPS location');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirm = async () => {
    if (!position) return;
    setLoading(true);

    try {
      let subscription = null;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const reg = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
          } else {
            toast(
              lang === 'hi'
                ? 'सूचनाएं बंद हैं। ऐप खुला होने पर ही अलार्म बजेगा।'
                : 'Notifications blocked. Alarm will only work when app is open.',
              { icon: '⚠️' }
            );
          }
        } catch (pushErr) {
          console.warn('Push setup failed:', pushErr);
        }
      }

      const token = user?.token || JSON.parse(localStorage.getItem('bus_saarthi_user') || '{}').token;
      await axios.put(
        `${BACKEND_URL}/api/users/me/wake-alarm`,
        {
          lat: position[0],
          lng: position[1],
          thresholdKm,
          subscription: subscription ? subscription.toJSON() : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem('wake_alarm_enabled', 'true');
      localStorage.setItem('wake_alarm_data', JSON.stringify({ lat: position[0], lng: position[1], thresholdKm }));

      toast.success(
        lang === 'hi'
          ? `⏰ अलार्म सेट! जब बस ${thresholdKm} किमी के दायरे में आएगी, तब सूचना मिलेगी।`
          : `⏰ Alarm set! We'll notify you when bus is within ${thresholdKm}km.`
      );
      onAlarmSet(true);
      onClose();
    } catch (err) {
      toast.error(lang === 'hi' ? 'अलार्म सेट नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Failed to set alarm. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isMapStep = step === 'map';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px',
          width: '100%',
          maxWidth: isMapStep ? '560px' : '440px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          maxHeight: '92vh',
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Header - Unified with WakeAlarmOptionsModal */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {step !== 'choose' ? (
              <button
                type="button"
                onClick={() => setStep('choose')}
                style={{
                  background: '#eff6ff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                title={lang === 'hi' ? 'वापस' : 'Back'}
              >
                <ArrowLeft size={20} color="#2563eb" />
              </button>
            ) : (
              <div
                style={{
                  background: '#eff6ff',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlarmClock size={22} color="#2563eb" />
              </div>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {lang === 'hi' ? 'जगाने का अलार्म सेट करें' : 'Set Wake-Up Alarm'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {step === 'choose'
                  ? (lang === 'hi' ? 'बस नजदीक आने पर सूचना पाएं' : 'Get notified when bus is near')
                  : step === 'map'
                  ? (lang === 'hi' ? 'मैप पर क्लिक करके स्टॉप मार्क करें' : 'Click on map to mark your stop')
                  : (lang === 'hi' ? 'अलार्म दायरा और पुष्टि' : 'Set trigger radius & confirm')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: '#f8fafc',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color="#64748b" />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: isMapStep ? '1rem 1.25rem 1.25rem 1.25rem' : '1.25rem 1.5rem', overflowY: 'auto' }}>
          {/* STEP 1: Choose Location Method */}
          {step === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <p style={{ margin: '0 0 0.35rem 0', color: '#64748b', fontSize: '0.84rem', lineHeight: 1.5 }}>
                {lang === 'hi'
                  ? 'अपना स्टॉप एक बार सेट करें। बाद में GPS बंद होने पर भी बस तय दायरे में आते ही अलार्म बज जाएगा।'
                  : 'Set your stop location once. Even if your GPS is off later, the alarm will alert you automatically.'}
              </p>

              {/* Option 1: Current GPS */}
              <button
                type="button"
                onClick={handleUseGPS}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.15rem',
                  borderRadius: '16px',
                  border: '1.5px solid #bfdbfe',
                  background: '#f0f7ff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.background = '#e0f2fe';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#bfdbfe';
                  e.currentTarget.style.background = '#f0f7ff';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Navigation size={22} color="#1d4ed8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e3a8a' }}>
                    {lang === 'hi' ? 'वर्तमान GPS का उपयोग करें' : 'Use Current GPS'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                    {lang === 'hi' ? 'अपनी वर्तमान लोकेशन अपने आप ढूंढें' : 'Auto-detect your current boarding location'}
                  </div>
                </div>
                <ChevronRight size={18} color="#60a5fa" />
              </button>

              {/* Option 2: Live Map */}
              <button
                type="button"
                onClick={handleSetOnMap}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.15rem',
                  borderRadius: '16px',
                  border: '1.5px solid #bbf7d0',
                  background: '#f0fdf4',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(34, 197, 94, 0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.background = '#dcfce7';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#bbf7d0';
                  e.currentTarget.style.background = '#f0fdf4';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={22} color="#15803d" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#14532d' }}>
                    {lang === 'hi' ? 'मानचित्र पर स्टॉप चुनें' : 'Select on Live Map'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '2px' }}>
                    {lang === 'hi' ? 'मानचित्र पर अपना सही पिक-अप पॉइंट चुनें' : 'Drag or search for your exact pickup point'}
                  </div>
                </div>
                <ChevronRight size={18} color="#4ade80" />
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          )}

          {/* STEP: GPS Loading */}
          {step === 'gps' && (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              {gpsStatus === 'loading' ? (
                <>
                  <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: '#eff6ff', marginBottom: '1rem' }}>
                    <Loader2 size={32} color="#2563eb" className="animate-spin" />
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    {lang === 'hi' ? 'लोकेशन का पता लगाया जा रहा है...' : 'Detecting your location...'}
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
                    {lang === 'hi' ? 'प्रॉम्प्ट आने पर स्थान अनुमति (Location Access) दें' : 'Please allow location permission when prompted'}
                  </p>
                </>
              ) : (
                <>
                  <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: '#fef2f2', marginBottom: '1rem' }}>
                    <MapPin size={32} color="#ef4444" />
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>
                    {lang === 'hi' ? 'लोकेशन नहीं मिल सकी' : "Couldn't detect location"}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        background: 'white',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'hi' ? 'वापस' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSetOnMap}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#2563eb',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'hi' ? 'मानचित्र पर चुनें' : 'Choose on Map'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: Ultra-Convenient Interactive Map Selection */}
          {step === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '0.6rem 0.85rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}
              >
                <Compass size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>
                  {lang === 'hi'
                    ? 'मैप पर कहीं भी सिंगल-क्लिक करके स्टॉप मार्क करें, या ड्रैग करके घूमें'
                    : 'Click anywhere on map to mark your stop, or drag to pan'}
                </span>
              </div>

              {/* Map Canvas with Clickable/Draggable Marker and Floating Zoom Controls */}
              <div
                style={{
                  position: 'relative',
                  height: '340px',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  border: '1.5px solid #cbd5e1',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                }}
              >
                <MapContainer
                  center={position || INVERTIS_CENTER}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  scrollWheelZoom={true}
                  doubleClickZoom={false}
                  touchZoom={true}
                  dragging={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://osm.org/copyright">OSM</a>'
                  />
                  <MapClickHandler
                    onLocationSelect={(coords) => setPosition(coords)}
                    setMapInstance={setMapInstance}
                  />
                  {position && (
                    <Marker
                      position={position}
                      icon={stopMarkerIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend(e) {
                          const latlng = e.target.getLatLng();
                          setPosition([latlng.lat, latlng.lng]);
                        },
                      }}
                    />
                  )}
                </MapContainer>

                {/* Floating Map Navigation Controls (Top Right) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* Zoom In */}
                  <button
                    type="button"
                    title={lang === 'hi' ? 'बड़ा करें (+)' : 'Zoom In (+)'}
                    onClick={() => mapInstance?.zoomIn()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </button>

                  {/* Zoom Out */}
                  <button
                    type="button"
                    title={lang === 'hi' ? 'छोटा करें (-)' : 'Zoom Out (-)'}
                    onClick={() => mapInstance?.zoomOut()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    <Minus size={18} strokeWidth={2.5} />
                  </button>

                  {/* Locate Me (GPS) */}
                  <button
                    type="button"
                    title={lang === 'hi' ? 'मेरी लोकेशन पर जाएं' : 'Go to My Location'}
                    onClick={handleLocateMeOnMap}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'white',
                      border: '1.5px solid #bfdbfe',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#2563eb',
                    }}
                  >
                    <Crosshair size={18} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Floating Map Helper Badge (Bottom Left) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    zIndex: 1000,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <MapPin size={13} color="#60a5fa" />
                  <span>
                    {position
                      ? (lang === 'hi' ? 'स्टॉप चुना गया' : 'Stop Marked')
                      : (lang === 'hi' ? 'मैप पर क्लिक करें' : 'Click map to mark')}
                  </span>
                </div>
              </div>

              {/* Coordinates & Status Bar */}
              {position && (
                <div
                  style={{
                    padding: '0.55rem 0.95rem',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: '#15803d',
                    fontWeight: 600,
                  }}
                >
                  <span>📍 {position[0].toFixed(4)}°, {position[1].toFixed(4)}°</span>
                  <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} />
                    {lang === 'hi' ? 'बिंदु तैयार' : 'Target Selected'}
                  </span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!position}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: position ? '#2563eb' : '#94a3b8',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: position ? 'pointer' : 'not-allowed',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                }}
              >
                <span>{lang === 'hi' ? 'यह स्थान कन्फ़र्म करें →' : 'Confirm This Location →'}</span>
              </button>
            </div>
          )}

          {/* STEP 3: Confirm with Threshold Radius */}
          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              {/* Mini Map Preview with Radius Geofence Circle - Matching WakeAlarmOptionsModal */}
              {position && (
                <div
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                    <MapContainer
                      center={position}
                      zoom={14}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                      attributionControl={false}
                      dragging={false}
                      touchZoom={false}
                      doubleClickZoom={false}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Circle
                        center={position}
                        radius={thresholdKm * 1000}
                        pathOptions={{
                          color: '#2563eb',
                          fillColor: '#3b82f6',
                          fillOpacity: 0.22,
                          weight: 2,
                        }}
                      />
                    </MapContainer>
                    {/* Fixed Center Pin overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -100%)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                    >
                      <div
                        style={{
                          background: '#2563eb',
                          borderRadius: '10px 10px 10px 0',
                          transform: 'rotate(-45deg)',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.4)',
                          border: '2px solid white',
                        }}
                      >
                        <div style={{ transform: 'rotate(45deg)' }}>
                          <MapPin size={14} color="white" fill="white" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '0.5rem 0.95rem',
                      fontSize: '0.72rem',
                      color: '#64748b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'white',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      📍 {position[0].toFixed(4)}°, {position[1].toFixed(4)}°
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('map')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {lang === 'hi' ? 'पिन बदलें' : 'Change Pin'}
                    </button>
                  </div>
                </div>
              )}

              {/* KM Threshold Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  {lang === 'hi' ? 'अलार्म दायरा चुनें (दूरी):' : 'Alert me when bus is within:'}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {KM_OPTIONS.map((km) => {
                    const isSelected = !isCustomThreshold && thresholdKm === km;
                    return (
                      <button
                        key={km}
                        type="button"
                        onClick={() => {
                          setThresholdKm(km);
                          setIsCustomThreshold(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.65rem 0.25rem',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : 'white',
                          color: isSelected ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {km} km
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomThreshold(true)}
                    style={{
                      flex: 1.2,
                      padding: '0.65rem 0.25rem',
                      borderRadius: '12px',
                      border: isCustomThreshold ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                      background: isCustomThreshold ? '#eff6ff' : 'white',
                      color: isCustomThreshold ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {lang === 'hi' ? 'अन्य' : 'Custom'}
                  </button>
                </div>

                {isCustomThreshold && (
                  <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="20"
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value);
                        if (e.target.value && !isNaN(e.target.value)) {
                          setThresholdKm(parseFloat(e.target.value));
                        }
                      }}
                      placeholder={lang === 'hi' ? 'दायरा दर्ज करें' : 'Enter distance'}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.85rem',
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        outline: 'none',
                        fontSize: '0.88rem',
                        color: '#0f172a',
                      }}
                    />
                    <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>km</span>
                  </div>
                )}
              </div>

              {/* Informative Note Box */}
              <div
                style={{
                  background: '#f0f7ff',
                  borderRadius: '12px',
                  padding: '0.65rem 0.95rem',
                  border: '1px solid #dbeafe',
                  fontSize: '0.76rem',
                  color: '#1e40af',
                  lineHeight: 1.45,
                }}
              >
                ⚡ {lang === 'hi'
                  ? 'इसके बाद आपका GPS चालू रहना ज़रूरी नहीं है। बस सर्वर से ट्रैक होकर ऑटोमैटिक अलर्ट मिल जाएगा।'
                  : 'Your GPS does not need to stay on. The bus is tracked by our server and alerts you automatically.'}
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: loading ? '#93c5fd' : '#2563eb',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  transition: 'background 0.2s ease',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{lang === 'hi' ? 'अलार्म सेट किया जा रहा है...' : 'Setting Alarm...'}</span>
                  </>
                ) : (
                  <span>{lang === 'hi' ? 'अलार्म सक्रिय करें' : 'Activate Wake-Up Alarm'}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('choose')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '0.25rem',
                }}
              >
                {lang === 'hi' ? '← वापस विकल्प पर जाएं' : '← Back to Options'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WakeAlarmModal;
