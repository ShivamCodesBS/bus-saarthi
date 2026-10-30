import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLang } from '../context/LanguageContext';
import { X, AlarmClock, MapPin, BellOff, ChevronRight, Loader2 } from 'lucide-react';

const WakeAlarmOptionsModal = ({ onClose, onChangeLocation, onTurnOff, loading = false }) => {
  useModalA11y(true, onClose);
  const { t } = useLanguage();

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
