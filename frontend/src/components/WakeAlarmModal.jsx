import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Navigation, AlarmClock, CheckCircle } from 'lucide-react';
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

// Leaflet map component that allows pin dragging
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

const KM_OPTIONS = [1, 2, 5];

const WakeAlarmModal = ({ onClose, onAlarmSet, user }) => {
  const [step, setStep] = useState('choose'); // 'choose' | 'gps' | 'map' | 'confirm'
  const [position, setPosition] = useState(null);
  const [thresholdKm, setThresholdKm] = useState(2);
  const [isCustomThreshold, setIsCustomThreshold] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'

  const handleUseGPS = useCallback(() => {
    setStep('gps');
    setGpsStatus('loading');
    if (!navigator.geolocation) {
      setGpsStatus('error');
      toast.error('GPS not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setGpsStatus('success');
        setStep('confirm');
      },
      (err) => {
        setGpsStatus('error');
        toast.error('Could not detect location. Try setting it on map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSetOnMap = () => {
    setPosition(INVERTIS_CENTER);
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
            toast('Notifications blocked. Alarm will only work when app is open.', { icon: '⚠️' });
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

      // 3. Store locally too
      localStorage.setItem('wake_alarm_enabled', 'true');
      localStorage.setItem('wake_alarm_data', JSON.stringify({ lat: position[0], lng: position[1], thresholdKm }));

      toast.success(`⏰ Alarm set! We'll notify you when bus is within ${thresholdKm}km.`);
      onAlarmSet(true);
      onClose();
    } catch (err) {
      toast.error('Failed to set alarm. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '8px' }}>
              <AlarmClock size={20} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Wake Alarm</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Get notified when bus is near</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}>
            <X size={20} color="#94a3b8" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* STEP: Choose method */}
          {step === 'choose' && (
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Set your location <strong>once</strong>. Even if your GPS is off later, the alarm fires automatically when the bus enters your set radius.
              </p>

              <button
                onClick={handleUseGPS}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1.25rem', borderRadius: '14px', border: '2px solid #dbeafe',
                  background: '#eff6ff', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#dbeafe'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dbeafe'; e.currentTarget.style.background = '#eff6ff'; }}
              >
                <div style={{ background: '#3b82f6', borderRadius: '10px', padding: '10px' }}>
                  <Navigation size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>📍 Use My GPS</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Auto-detect your current location</div>
                </div>
              </button>

              <button
                onClick={handleSetOnMap}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1.25rem', borderRadius: '14px', border: '2px solid #dcfce7',
                  background: '#f0fdf4', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.background = '#dcfce7'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#dcfce7'; e.currentTarget.style.background = '#f0fdf4'; }}
              >
                <div style={{ background: '#22c55e', borderRadius: '10px', padding: '10px' }}>
                  <MapPin size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>🗺️ Set on Map</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Drag a pin to your exact boarding spot</div>
                </div>
              </button>
            </div>
          )}

          {/* STEP: GPS loading */}
          {step === 'gps' && (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              {gpsStatus === 'loading' && (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📡</div>
                  <p style={{ color: '#64748b', fontWeight: 600 }}>Detecting your location...</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Please allow location access when prompted</p>
                </>
              )}
              {gpsStatus === 'error' && (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
                  <p style={{ color: '#ef4444', fontWeight: 600 }}>Couldn't detect location</p>
                  <button onClick={() => setStep('choose')} style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                    Try Again
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP: Map selection */}
          {step === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  <strong>Tap</strong> anywhere on the map or <strong>drag</strong> the pin to set your location
                </p>
              </div>
              <div style={{ height: '300px' }}>
                <MapContainer
                  center={position || INVERTIS_CENTER}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DraggableMarker position={position} onPositionChange={setPosition} />
                </MapContainer>
              </div>
              {position && (
                <div style={{ padding: '0.75rem 1.5rem', background: '#f0fdf4', borderTop: '1px solid #dcfce7' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    📍 {position[0].toFixed(5)}, {position[1].toFixed(5)}
                  </p>
                </div>
              )}
              <div style={{ padding: '1rem 1.5rem' }}>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!position}
                  style={{
                    width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
                    background: position ? '#22c55e' : '#e2e8f0', color: position ? 'white' : '#94a3b8',
                    fontWeight: 700, cursor: position ? 'pointer' : 'not-allowed', fontSize: '0.95rem',
                  }}
                >
                  Confirm Location →
                </button>
              </div>
            </div>
          )}

          {/* STEP: Confirm with threshold */}
          {step === 'confirm' && (
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Location preview */}
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={18} color="#22c55e" />
                <div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.85rem' }}>Location Set</div>
                  <div style={{ color: '#16a34a', fontSize: '0.75rem' }}>
                    {position ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setStep('choose')}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Change
                </button>
              </div>

              {/* KM threshold selector */}
              <div>
                <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                  Alert me when bus is within:
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {KM_OPTIONS.map(km => (
                    <button
                      key={km}
                      onClick={() => { setThresholdKm(km); setIsCustomThreshold(false); }}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '12px', minWidth: '60px',
                        border: `2px solid ${!isCustomThreshold && thresholdKm === km ? '#3b82f6' : '#e2e8f0'}`,
                        background: !isCustomThreshold && thresholdKm === km ? '#eff6ff' : 'white',
                        color: !isCustomThreshold && thresholdKm === km ? '#1d4ed8' : '#475569',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
                        transition: 'all 0.15s',
                      }}
                    >
                      {km} km
                    </button>
                  ))}
                  <button
                    onClick={() => setIsCustomThreshold(true)}
                    style={{
                      flex: 1, padding: '0.75rem', borderRadius: '12px', minWidth: '70px',
                      border: `2px solid ${isCustomThreshold ? '#3b82f6' : '#e2e8f0'}`,
                      background: isCustomThreshold ? '#eff6ff' : 'white',
                      color: isCustomThreshold ? '#1d4ed8' : '#475569',
                      fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    Custom
                  </button>
                </div>
                {isCustomThreshold && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value);
                        if (e.target.value && !isNaN(e.target.value)) {
                          setThresholdKm(parseFloat(e.target.value));
                        }
                      }}
                      placeholder="Enter distance"
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '12px',
                        border: '2px solid #e2e8f0', outline: 'none',
                        fontSize: '0.95rem', color: '#1e293b'
                      }}
                    />
                    <span style={{ fontWeight: 600, color: '#475569' }}>km</span>
                  </div>
                )}
              </div>

              {/* Info box */}
              <div style={{ background: '#fefce8', borderRadius: '10px', padding: '0.75rem', border: '1px solid #fde68a' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: 1.5 }}>
                  ⚡ Your GPS doesn't need to be on after this. Our server tracks the bus and sends a push notification to your device automatically.
                </p>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  padding: '1rem', borderRadius: '14px', border: 'none',
                  background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem', transition: 'all 0.2s',
                }}
              >
                {loading ? '⏳ Setting alarm...' : '⏰ Set Wake Alarm'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WakeAlarmModal;
