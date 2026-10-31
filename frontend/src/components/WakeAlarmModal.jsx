import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLang } from '../context/LanguageContext';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Navigation, AlarmClock, ChevronRight, ArrowLeft, Loader2, Compass } from 'lucide-react';
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

const INVERTIS_CENTER = [28.3180, 79.4670]; // Invertis University
const VAPID_PUBLIC_KEY = 'BGhJZ_87jdyNrfmo6cZDJ7-ububtXfroy89VdBNNTn9o9837VbC3AVrUqJlzkd6PdI676sIQI-APdKayBup44EY';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Leaflet map component that allows pin dragging and clicking
function DraggableMarker({ position, onPositionChange }) {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    <Marker
      draggable
      position={position}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker) {
            const latlng = marker.getLatLng();
            onPositionChange([latlng.lat, latlng.lng]);
          }
        },
      }}
    />
  ) : null;
}

const KM_OPTIONS = [1, 2, 3, 5];

const WakeAlarmModal = ({ onClose, onAlarmSet, user }) => {
  const { t, lang } = useLang();
  const [step, setStep] = useState('choose'); // 'choose' | 'gps' | 'map' | 'confirm'
  const [position, setPosition] = useState(null);
  const [thresholdKm, setThresholdKm] = useState(2);
  const [isCustomThreshold, setIsCustomThreshold] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'

  useModalA11y(true, onClose);

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
        setPosition([pos.coords.latitude, pos.coords.longitude]);
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
    if (!position) {
      setPosition(INVERTIS_CENTER);
    }
    setStep('map');
  };

  const handleConfirm = async () => {
    if (!position) return;
    setLoading(true);

    try {
      // 1. Register Service Worker and get push subscription
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
            toast(lang === 'hi' ? 'सूचनाएं बंद हैं। ऐप खुला होने पर ही अलार्म बजेगा।' : 'Notifications blocked. Alarm will only work when app is open.', { icon: '⚠️' });
          }
        } catch (pushErr) {
          console.warn('Push setup failed:', pushErr);
        }
      }

      // 2. Save alarm to backend
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

      // 3. Store locally
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
          maxWidth: '440px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          maxHeight: '90vh',
        }}
      >
        {/* Header - Identical to WakeAlarmOptionsModal */}
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
                onClick={() => setStep(step === 'confirm' ? 'choose' : 'choose')}
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
                  ? (lang === 'hi' ? 'मानचित्र पर अपना स्टॉप चुनें' : 'Pinpoint your boarding spot')
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
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
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
                    {lang === 'hi' ? 'मानचित्र पर अपना सही पिक-अप पॉइंट चुनें' : 'Drag a pin to your exact pickup point'}
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

          {/* STEP: Interactive Map Selection */}
          {step === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.65rem 0.95rem',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.78rem',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Compass size={16} color="#2563eb" />
                <span>
                  {lang === 'hi'
                    ? 'मानचित्र पर कहीं भी टैप करें या पिन को अपने स्टॉप पर खींचें।'
                    : 'Tap anywhere on the map or drag the pin to your exact pickup spot.'}
                </span>
              </div>

              <div
                style={{
                  height: '240px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1.5px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <MapContainer
                  center={position || INVERTIS_CENTER}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DraggableMarker position={position || INVERTIS_CENTER} onPositionChange={setPosition} />
                </MapContainer>
              </div>

              {position && (
                <div
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.74rem',
                    color: '#15803d',
                    fontWeight: 600,
                  }}
                >
                  <span>📍 {position[0].toFixed(4)}°, {position[1].toFixed(4)}°</span>
                  <span style={{ color: '#16a34a' }}>{lang === 'hi' ? 'पिन सेट' : 'Pin Placed'}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!position}
                style={{
                  marginTop: '0.25rem',
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: position ? '#2563eb' : '#94a3b8',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: position ? 'pointer' : 'not-allowed',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                {lang === 'hi' ? 'लोकेशन कन्फ़र्म करें →' : 'Confirm Location →'}
              </button>
            </div>
          )}

          {/* STEP: Confirm with Threshold Radius */}
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
                      <Marker position={position} />
                    </MapContainer>
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
                        fontSize: '0.72rem',
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
