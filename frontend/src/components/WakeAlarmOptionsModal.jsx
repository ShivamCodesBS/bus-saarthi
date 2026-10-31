import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLang } from '../context/LanguageContext';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, AlarmClock, MapPin, BellOff, ChevronRight, Loader2 } from 'lucide-react';

// Fix default leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const WakeAlarmOptionsModal = ({ alarmData, onClose, onChangeLocation, onTurnOff, loading = false }) => {
  useModalA11y(true, onClose);
  const { t } = useLang();

  const currentAlarm = alarmData || (() => {
    try {
      return JSON.parse(localStorage.getItem('wake_alarm_data') || 'null');
    } catch {
      return null;
    }
  })();

  const hasCoords = currentAlarm?.lat != null && currentAlarm?.lng != null;
  const lat = hasCoords ? parseFloat(currentAlarm.lat) : 0;
  const lng = hasCoords ? parseFloat(currentAlarm.lng) : 0;
  const thresholdKm = currentAlarm?.thresholdKm ? parseFloat(currentAlarm.thresholdKm) : 2;

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
        }}
      >
        {/* Header */}
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
            <div
              style={{
                position: 'relative',
                background: '#eff6ff',
                borderRadius: '12px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlarmClock size={22} color="#2563eb" />
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px white',
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {t('alarmActiveTitle')}
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {t('alarmActiveSubtitle')}
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
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Options */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Current Active Location Preview with Mini Map */}
          {hasCoords && (
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1.5px solid #bfdbfe',
                background: '#f8fafc',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.04)',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: '0.65rem 0.95rem',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #dbeafe',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} color="#2563eb" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                    {t('currentAlarmLocation')}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    background: '#dbeafe',
                    padding: '3px 9px',
                    borderRadius: '999px',
                  }}
                >
                  🎯 {thresholdKm} km {t('currentAlarmRadius')}
                </span>
              </div>

              {/* Map Preview */}
              <div style={{ height: '145px', width: '100%', position: 'relative' }}>
                <MapContainer
                  center={[lat, lng]}
                  zoom={14}
                  zoomControl={false}
                  scrollWheelZoom={false}
                  dragging={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                    subdomains={['a', 'b', 'c', 'd']}
                  />
                  <Circle
                    center={[lat, lng]}
                    radius={thresholdKm * 1000}
                    pathOptions={{
                      color: '#2563eb',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.22,
                      weight: 2,
                    }}
                  />
                  <Marker position={[lat, lng]} />
                </MapContainer>
              </div>

              {/* Card Footer */}
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
                  📍 {lat.toFixed(4)}°, {lng.toFixed(4)}°
                </span>
                <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Active Geofence
                </span>
              </div>
            </div>
          )}

          {/* Option 1: Change Location */}
          <button
            onClick={onChangeLocation}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.15rem',
              borderRadius: '16px',
              border: '1.5px solid #bfdbfe',
              background: '#f0f7ff',
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.04)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.background = '#e0f2fe';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
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
              <MapPin size={22} color="#1d4ed8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e3a8a' }}>
                {t('changeLocation')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                {t('changeLocationSubtitle')}
              </div>
            </div>
            <ChevronRight size={18} color="#60a5fa" />
          </button>

          {/* Option 2: Turn Off Alarm */}
          <button
            onClick={onTurnOff}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.15rem',
              borderRadius: '16px',
              border: '1.5px solid #fecaca',
              background: '#fff5f5',
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.04)',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#fecaca';
              e.currentTarget.style.background = '#fff5f5';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {loading ? (
                <Loader2 size={22} color="#dc2626" className="animate-spin" />
              ) : (
                <BellOff size={22} color="#dc2626" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#991b1b' }}>
                {loading ? t('setting') : t('turnOffAlarm')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '2px' }}>
                {t('turnOffAlarmSubtitle')}
              </div>
            </div>
            <ChevronRight size={18} color="#f87171" />
          </button>
        </div>

        {/* Footer / Cancel */}
        <div
          style={{
            padding: '0.85rem 1.25rem 1.25rem',
            display: 'flex',
            justifyContent: 'center',
            borderTop: '1px solid #f8fafc',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {t('keepAlarmActive')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WakeAlarmOptionsModal;
