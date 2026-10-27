import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * ConnectionStatus - Visual indicator for WebSocket and GPS connection state
 * Shows real-time feedback during reconnection attempts
 */
const ConnectionStatus = ({ isLive, lastUpdate, onRetry }) => {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdate) {
        const seconds = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000);
        setTimeSinceUpdate(seconds);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Determine connection state
  const getState = () => {
    if (isLive && timeSinceUpdate < 30) {
      return {
        status: 'connected',
        label: 'LIVE',
        color: '#28a745',
        bg: '#e6fae6',
        icon: Wifi,
        animate: true,
      };
    } else if (isLive && timeSinceUpdate < 60) {
      return {
        status: 'stale',
        label: 'STALE',
        color: '#d46b08',
        bg: '#fff7e6',
        icon: AlertCircle,
        animate: false,
      };
    } else {
      return {
        status: 'offline',
        label: 'OFFLINE',
        color: '#cf1322',
        bg: '#fff1f0',
        icon: WifiOff,
        animate: false,
      };
    }
  };

  const state = getState();
  const Icon = state.icon;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        background: state.bg,
        border: `1px solid ${state.color}40`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
      }}
    >
      <Icon
        size={16}
        color={state.color}
        style={{
          animation: state.animate ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: state.color,
          letterSpacing: '0.5px',
        }}
      >
        {state.label}
      </span>
      {timeSinceUpdate > 30 && (
        <span
          style={{
            fontSize: '0.65rem',
            color: '#666',
            fontWeight: 600,
          }}
        >
          {Math.floor(timeSinceUpdate / 60)}m ago
        </span>
      )}
      {state.status === 'offline' && onRetry && (
        <button
          onClick={() => {
            setIsReconnecting(true);
            onRetry();
            setTimeout(() => setIsReconnecting(false), 2000);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Retry connection"
        >
          <RefreshCw
            size={14}
            color={state.color}
            style={{
              animation: isReconnecting ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>
      )}
    </div>
  );
};

export default ConnectionStatus;
