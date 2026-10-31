import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Navigation, Maximize2, X, Activity, Gauge, Compass, Wind, 
  MapPin, RefreshCw, Crosshair, Layers, Info,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { BACKEND_URL } from '../config';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Bus marker: a white badge with a navigation arrow that rotates with the
// live heading. When offline, shows "Last seen" timing as a label below.
// When clicked, fetches fresh last known data.
const busDirectionIcon = (heading, isOffline, lastSeenText, onMarkerClick) => {
  const markerHtml = `
    <div style="position:relative;width:42px;height:42px;cursor:pointer;">
      <div style="position:absolute;inset:0;border-radius:50%;background:white;border:3px solid ${isOffline ? '#cf1322' : '#3b82f6'};box-shadow:0 3px 10px rgba(0,0,0,0.35);"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(${Number(heading) || 0}deg);transition:transform 0.4s ease;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="${isOffline ? '#cf1322' : '#3b82f6'}"><path d="M12 2 L19 21 L12 17 L5 21 Z"/></svg>
      </div>
      <div style="position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:50%;background:white;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;">🚌</div>
    </div>
    ${isOffline && lastSeenText ? `
      <div style="position:absolute;top:44px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(207,19,34,0.95);color:white;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;">
        Last seen ${lastSeenText}
      </div>
    ` : ''}
  `;
  
  return new L.DivIcon({
    className: 'bus-direction-marker',
    html: markerHtml,
    iconSize: [42, isOffline ? 70 : 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
  });
};

// Destination Icon
const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Small marker for the OTHER buses of the fleet (the selected bus gets the
// large busIcon above).
const otherBusIcon = new L.DivIcon({
  className: 'other-bus-marker',
  html: `<div style="width:26px;height:26px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1">🚌</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/**
 * Google-Maps-style "lock on bus" control — a circular crosshair button that
 * fills blue while following. Replaces the checkbox pill, which read like a
 * form control rather than a map control.
 */
const LockOnBusButton = ({ active, onToggle, size = 40 }) => (
  <button
    onClick={() => onToggle(!active)}
    title={active ? 'Following the bus — click to unlock' : 'Lock on bus'}
    aria-pressed={active}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? '#3b82f6' : 'rgba(255,255,255,0.95)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      transition: 'all 0.2s',
      flexShrink: 0,
    }}
  >
    <Crosshair size={Math.round(size * 0.5)} color={active ? 'white' : '#3b82f6'} />
  </button>
);

// STOP_COORDS for route polyline
const STOP_COORDS = {
  'Civil Lines': [28.3615, 79.4180],
  'Rajendra Nagar': [28.3610, 79.4501],
  'DD Puram': [28.3715, 79.4452],
  'Pilibhit Bypass': [28.3842, 79.4310],
  'Invertis University': [28.3180, 79.4670],
  'labela chowk': [28.3500, 79.4200],
  'police line': [28.3550, 79.4250],
  'Chauki Chauraha': [28.3580, 79.4120],
  'Satellite Bus Stand': [28.3440, 79.4420],
  'Bareilly Mod': [28.2500, 79.5200],
  'Shahjahanpur': [27.8805, 79.9140],
  'Shahjahanpur Bus Stand': [27.8820, 79.9100],
  'Roza Junction': [27.8350, 79.9200],
  'Tilhar': [28.0200, 79.7300],
  'Miranpur Katra': [28.1100, 79.6200],
  'Badaun': [28.0300, 79.1200],
  'Badaun Road': [28.2000, 79.2800],
  'Ujhani': [28.0100, 79.0100],
  'Dataganj': [27.9400, 79.3500],
  'Pilibhit': [28.6300, 79.8000],
  'Bisalpur': [28.3000, 79.8000],
  'Nawabganj': [28.5400, 79.6300],
  'Faridpur': [28.2100, 79.5400],
};

// Map setup: invalidate size on resize/container changes and hand the map
// instance back to the parent exactly once.
const MapResizer = ({ onMapReady }) => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 900);
    const t4 = setTimeout(() => map.invalidateSize(), 1600);
    const ro = new ResizeObserver(() => map.invalidateSize());
    const container = map.getContainer();
    if (container) ro.observe(container);
    if (onMapReady) onMapReady(map);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      if (container) ro.unobserve(container);
    };
  }, [map, onMapReady]);
  return null;
};

// Heading to direction label
const getHeadingLabel = (deg) => {
  if (deg == null || isNaN(deg)) return '—';
  let h = Number(deg) % 360;
  if (h < 0) h += 360;
  if (h >= 315 || h < 45) return 'N ↑';
  if (h >= 45 && h < 135) return 'E →';
  if (h >= 135 && h < 225) return 'S ↓';
  return 'W ←';
};

// Format time
const formatTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
};

// Format last update time
const formatLastUpdate = (isoString) => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffSecs < 30) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * UnifiedMap - A reusable map component for all user types
 * 
 * Features:
 * - Auto-follow bus with retracing on user interaction
 * - GPS status indicator (Live/Offline with timing)
 * - Fullscreen support without glitches
 * - Telemetry display (speed, heading, comfort)
 * - Route polyline with stops
 * - Works for Parent, Student, Transport Incharge, Admin
 */
const UnifiedMap = ({
  // Required props
  busLocation = [28.3180, 79.4670],
  routeInfo = null,
  telemetry = null,
  isLive = false,
  
  // Optional props
  initialZoom = 14,
  showFullscreenButton = true,
  showAutoFollowToggle = true,
  showRecenterButton = true,
  showTelemetryPanel = true,
  showRoutePolyline = true,
  showDestinationMarker = true,
  height = '320px',
  // Percentage heights collapse to zero inside an auto-height parent, which
  // is exactly how the admin/TI map containers are built — so the floor
  // below is what actually keeps the map visible there.
  minHeight = '320px',
  // Other buses of the fleet: [{ id, position: [lat,lng], label, live }]
  // Rendered as small markers; clicking one asks the parent to switch.
  buses = [],
  onSelectBus = null,
  // Last DB-recorded GPS fix for the tracked route: { position, timestamp }.
  // While offline the marker sits there and the popup says when it was seen.
  lastKnown = null,
  className = '',
  style = {},
  busLabel = 'Bus',
  onMapClick = null,
  // For external map instance access
  mapRef = null,
}) => {
  const [autoFollow, setAutoFollow] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapCenter, setMapCenter] = useState(busLocation);
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const [telemetryStale, setTelemetryStale] = useState(false);
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState(null);
  // Telemetry panel can collapse to a compact speed chip.
  const [telemetryMinimized, setTelemetryMinimized] = useState(false);
  // For fetching fresh last-known data on marker click
  const [lastKnownData, setLastKnownData] = useState(lastKnown);
  const [isFetchingLastKnown, setIsFetchingLastKnown] = useState(false);
  
  const mapInstance = useRef(null);
  const autoFollowRef = useRef(true);
  const staleTimerRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef(null);
  
  // Sync ref with state
  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);
  
  // Update lastKnownData when lastKnown prop changes
  useEffect(() => {
    setLastKnownData(lastKnown);
  }, [lastKnown]);
  
  // Expose map instance to parent if ref provided
  useEffect(() => {
    if (mapRef && mapInstance.current) {
      mapRef.current = mapInstance.current;
    }
  }, [mapRef]);
  
  // Dynamic Route Polyline based on routeInfo. Draws ONLY real stop
  // coordinates — when the route is unknown or no stop resolves, there is
  // no line at all. The previous hardcoded fallbacks read as a dotted
  // "line to nowhere".
  const dynamicRoutePolyline = useMemo(() => {
    if (!routeInfo || !routeInfo.stops) return [];

    let stopsArray = [];
    if (Array.isArray(routeInfo.stops)) {
      stopsArray = routeInfo.stops;
    } else {
      try {
        const parsed = JSON.parse(routeInfo.stops);
        if (Array.isArray(parsed)) stopsArray = parsed;
        else stopsArray = String(routeInfo.stops).split(',').map((s) => s.trim());
      } catch {
        stopsArray = String(routeInfo.stops).split(',').map((s) => s.trim());
      }
    }

    const coords = stopsArray
      .map((s) => {
        const name = typeof s === 'object' && s !== null ? (s.name || s.stopName) : String(s).trim();
        return STOP_COORDS[name];
      })
      .filter(Boolean);

    if (coords.length === 0) return [];

    const lastStop = typeof stopsArray[stopsArray.length - 1] === 'object'
      ? (stopsArray[stopsArray.length - 1]?.name || '')
      : String(stopsArray[stopsArray.length - 1]).trim();
    if (lastStop !== 'Invertis University') {
      coords.push(STOP_COORDS['Invertis University']);
    }
    return coords;
  }, [routeInfo]);
  
  // Handle telemetry updates - mark stale after 30 seconds (progressive degradation)
  // 0-15s: LIVE (green), 15-30s: STALE (orange), 30s+: OFFLINE (red)
  useEffect(() => {
    if (telemetry && telemetry.lastUpdated) {
      setLastTelemetryUpdate(telemetry.lastUpdated);
      setTelemetryStale(false);
      clearTimeout(staleTimerRef.current);
      // Extended to 30s for better mobile network resilience
      staleTimerRef.current = setTimeout(() => setTelemetryStale(true), 30000);
    } else if (!telemetry) {
      setTelemetryStale(true);
      setLastTelemetryUpdate(null);
    }
  }, [telemetry]);
  
  // Auto-follow logic with smooth animation
  useEffect(() => {
    if (autoFollowRef.current && mapInstance.current && busLocation) {
      // Never yank the map while the user is actively panning/zooming.
      if (isUserInteractingRef.current) return;
      const map = mapInstance.current;
      const currentCenter = map.getCenter();
      const distance = currentCenter.distanceTo(L.latLng(busLocation));

      // Only animate if bus moved significantly (>50 meters)
      if (distance > 50) {
        map.setView(busLocation, map.getZoom(), {
          animate: true,
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    }
  }, [busLocation, autoFollow]);
  
  // Handle map interaction - disable auto-follow when user drags/zooms
  const handleMapInteraction = useCallback((map) => {
    if (!map) return () => {};
    
    const onMoveStart = () => {
      isUserInteractingRef.current = true;
      clearTimeout(interactionTimeoutRef.current);
    };
    
    const onMoveEnd = () => {
      isUserInteractingRef.current = false;
      // Re-enable auto-follow after 3 seconds of no interaction
      interactionTimeoutRef.current = setTimeout(() => {
        if (!isUserInteractingRef.current) {
          setAutoFollow(true);
        }
      }, 3000);
    };
    
    const onZoomStart = () => {
      isUserInteractingRef.current = true;
      clearTimeout(interactionTimeoutRef.current);
    };
    
    const onZoomEnd = () => {
      isUserInteractingRef.current = false;
      interactionTimeoutRef.current = setTimeout(() => {
        if (!isUserInteractingRef.current) {
          setAutoFollow(true);
        }
      }, 3000);
    };
    
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    map.on('zoomstart', onZoomStart);
    map.on('zoomend', onZoomEnd);
    
    return () => {
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.off('zoomstart', onZoomStart);
      map.off('zoomend', onZoomEnd);
      clearTimeout(interactionTimeoutRef.current);
    };
  }, []);
  
  const recenterMap = useCallback(() => {
    setAutoFollow(true);
    if (mapInstance.current && busLocation) {
      mapInstance.current.setView(busLocation, 16, { animate: true, duration: 1.5 });
    }
  }, [busLocation]);

  // Stable one-time map setup. `whenCreated` no longer exists in
  // react-leaflet v4+, so the instance arrives through MapResizer instead.
  // The interaction listeners stop the auto-follow from yanking the map
  // back while the user pans/zooms.
  const handleMapReady = useCallback((map) => {
    mapInstance.current = map;
    handleMapInteraction(map);
  }, [handleMapInteraction]);
  
  // Fetch fresh last-known GPS data when bus is offline and user clicks marker
  const fetchLastKnownTelemetry = useCallback(async () => {
    if (!routeInfo) return;
    const routeId = routeInfo.routeId || routeInfo.route_id;
    if (!routeId) return;

    setIsFetchingLastKnown(true);
    try {
      // The session (with its token) is stored as one JSON blob under
      // `bus_saarthi_user` — there is no separate token key.
      let token = null;
      try {
        token = JSON.parse(localStorage.getItem('bus_saarthi_user') || 'null')?.token || null;
      } catch { token = null; }
      const res = await fetch(`${BACKEND_URL}/api/telemetry/last/${routeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          const freshData = {
            position: [data.data.lat, data.data.lng],
            timestamp: data.data.timestamp,
            speed: data.data.speed,
          };
          setLastKnownData(freshData);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch fresh last-known telemetry:', err);
    } finally {
      setIsFetchingLastKnown(false);
    }
  }, [routeInfo]);
  
  const handleAutoFollowChange = useCallback((enabled) => {
    setAutoFollow(enabled);
    if (enabled && mapInstance.current && busLocation) {
      mapInstance.current.setView(busLocation, 16, { animate: true, duration: 1.5 });
    }
  }, [busLocation]);
  
  const handleMarkerClick = useCallback(() => {
    fetchLastKnownTelemetry();
  }, [fetchLastKnownTelemetry]);
  
  // Fullscreen via the native Fullscreen API: the browser scales the SAME
  // map element to the viewport — no React remount, so tiles and map state
  // persist. The portal/CSS mode below is only the fallback for browsers
  // without the API (iOS Safari), where a remount is unavoidable.
  const mapHostRef = useRef(null);
  const portalFallbackRef = useRef(false);

  const toggleFullscreen = useCallback((expand) => {
    const el = mapHostRef.current;
    if (expand) {
      if (el?.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          portalFallbackRef.current = true;
          setIsFullscreen(true);
        });
      } else {
        portalFallbackRef.current = true;
        setIsFullscreen(true);
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      portalFallbackRef.current = true;
      setIsFullscreen(false);
    }
  }, []);

  // Native Escape/fullscreen changes must stay in sync with our state.
  useEffect(() => {
    const onChange = () => {
      const active =
        !!document.fullscreenElement && document.fullscreenElement === mapHostRef.current;
      if (!document.fullscreenElement) {
        portalFallbackRef.current = false;
        setIsFullscreen(false);
      } else {
        setIsFullscreen(active);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  
  const handleMapClick = useCallback((e) => {
    if (onMapClick) {
      onMapClick(e.latlng);
    }
  }, [onMapClick]);
  
  // GPS Status badge
  // Motion state with a grace period: GPS speed flickers to 0 at signals,
  // so the badge holds "MOVING" for a few seconds before settling on
  // "ACTIVE" instead of flapping between the two.
  const [tripState, setTripState] = useState('offline'); // offline | active | moving
  const tripTelemetryRef = useRef(telemetry);
  tripTelemetryRef.current = telemetry;
  const lastMovingAtRef = useRef(0);

  useEffect(() => {
    const evaluate = () => {
      const t = tripTelemetryRef.current;
      if (!t?.lastUpdated) return setTripState('offline');
      const age = Date.now() - new Date(t.lastUpdated).getTime();
      // Extended to 30s to match telemetryStale timeout for consistency
      if (age > 30000) return setTripState('offline');
      if ((t.speed || 0) > 3) {
        lastMovingAtRef.current = Date.now();
        setTripState('moving');
      } else if (lastMovingAtRef.current && Date.now() - lastMovingAtRef.current < 8000) {
        setTripState('moving');
      } else {
        setTripState('active');
      }
    };
    evaluate();
    const timer = setInterval(evaluate, 2000);
    return () => clearInterval(timer);
  }, []);

  const getGPSStatus = () => {
    if (!telemetry || telemetryStale) {
      return { 
        status: 'offline', 
        label: 'OFFLINE', 
        color: '#cf1322', 
        bg: '#fff1f0',
        icon: '🔴',
        tooltip: 'No live GPS signal'
      };
    }
    const lastUpdate = formatLastUpdate(lastTelemetryUpdate);
    if (tripState === 'moving') {
      return {
        status: 'live',
        label: 'MOVING',
        color: '#28a745',
        bg: '#e6fae6',
        icon: '🟢',
        tooltip: `Bus is moving • Last update: ${lastUpdate}`,
      };
    }
    return {
      status: 'live',
      label: 'ACTIVE',
      color: '#d46b08',
      bg: '#fff7e6',
      icon: '🟠',
      tooltip: `Bus is live and standing • Last update: ${lastUpdate}`,
    };
  };
  
  const gpsStatus = getGPSStatus();
  
  // Use a simple block container instead of flex column to avoid extra space
  // when parent uses min-height instead of fixed height. The inner map host
  // uses height: 100% + min-height to fill available space.
  const mapHostStyle = {
    height: height === '100%' ? '100%' : height,
    minHeight: isFullscreen ? undefined : minHeight,
    width: '100%',
    borderRadius: isFullscreen ? '0' : '16px',
    position: 'relative',
    ...style
  };
  
  const containerStyle = isFullscreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    background: '#1a1a2e',
  } : mapHostStyle;
  
  const renderMapContent = () => (
    <>
      <MapResizer onMapReady={handleMapReady} />
      
      {/* Tile Layer - CartoDB Voyager (fast CDN, no 403 blocks) */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
        minZoom={3}
        subdomains={['a', 'b', 'c', 'd']}
      />
      
      {/* Route Polyline — only while the trip is live. When the bus is
          offline the marker sits at its last-seen fix, and a route line
          starting from there read as a dotted line to nowhere. */}
      {showRoutePolyline && tripState !== 'offline' && dynamicRoutePolyline.length > 1 && (
        <Polyline
          positions={dynamicRoutePolyline}
          color="#0056b3"
          weight={5}
          opacity={0.6}
          lineCap="round"
          lineJoin="round"
          dashArray="10, 10"
        />
      )}

      {/* Other buses of the fleet — click one to track it */}
      {buses.map((bus) => (
        <Marker
          key={bus.id}
          position={bus.position}
          icon={otherBusIcon}
          eventHandlers={{
            click: () => { if (onSelectBus) onSelectBus(bus.id); },
          }}
        >
          <Tooltip direction="top" offset={[0, -14]} opacity={1}>
            {bus.label}{bus.live === false ? ' (offline)' : ''}
          </Tooltip>
        </Marker>
      ))}

      {/* Destination Marker — same live-only rule as the polyline */}
      {showDestinationMarker && tripState !== 'offline' && dynamicRoutePolyline.length > 0 && (
        <Marker position={dynamicRoutePolyline[dynamicRoutePolyline.length - 1]} icon={destinationIcon}>
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>🎯 Destination</strong><br />
              <small>{routeInfo?.routeName || 'Final Stop'}</small>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Bus Marker with live telemetry popup */}
      <Marker 
        position={busLocation} 
        icon={busDirectionIcon(
          telemetry?.heading, 
          !telemetry || telemetryStale,
          lastKnownData?.timestamp ? formatLastUpdate(lastKnownData.timestamp) : null,
          handleMarkerClick
        )}
        eventHandlers={{
          click: handleMarkerClick,
        }}
      >
        <Popup
          minWidth={180}
          maxWidth={240}
          className="custom-bus-popup"
        >
          <div style={{ textAlign: 'center', padding: '4px 8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
              🚌 {busLabel} {routeInfo?.busNumber || routeInfo?.bus_number || routeInfo?.routeId || ''}
            </div>
            {telemetry && !telemetryStale && (
<>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ color: '#666' }}>Speed:</span>
                  <span style={{ fontWeight: 'bold', color: telemetry.speed > 60 ? '#cf1322' : '#28a745' }}>
                    {telemetry.speed > 0 ? Math.round(telemetry.speed) : 0} km/h
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ color: '#666' }}>Direction:</span>
                  <span style={{ fontWeight: 'bold' }}>{getHeadingLabel(telemetry.heading)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ color: '#666' }}>Comfort:</span>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: (telemetry.comfort || 'Smooth') === 'Smooth' ? '#28a745' : 
                           (telemetry.comfort || 'Smooth') === 'Moderate' ? '#f97316' : '#ef4444' 
                  }}>
                    {telemetry.comfort || 'Smooth'}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                  Updated: {formatLastUpdate(lastTelemetryUpdate)}
                </div>
              </>
            )}
            {(!telemetry || telemetryStale) && (
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#cf1322' }}>
                {isFetchingLastKnown
                  ? '📡 Fetching last location...'
                  : lastKnownData?.timestamp
                  ? `📡 Offline - Last seen ${formatLastUpdate(lastKnownData.timestamp)}`
                  : '📡 No GPS signal yet'}
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
  
  const renderOverlayControls = () => (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      bottom: 12,
      pointerEvents: 'none',
      zIndex: 500,
    }}>
      {/* Top-left: GPS Status (fullscreen header shows its own badge) */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', pointerEvents: 'auto', display: isFullscreen ? 'none' : 'block' }}>
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.7rem',
            fontWeight: '700',
            background: gpsStatus.bg,
            color: gpsStatus.color,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            border: `1px solid ${gpsStatus.color}40`,
            cursor: 'help',
          }}
          title={gpsStatus.tooltip}
        >
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: gpsStatus.color,
            animation: gpsStatus.status === 'live' ? 'pulse 1.5s infinite' : 'none'
          }} />
          <span style={{ letterSpacing: '0.5px' }}>{gpsStatus.label}</span>
          {lastTelemetryUpdate && gpsStatus.status === 'live' && (
            <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
              {formatLastUpdate(lastTelemetryUpdate)}
            </span>
          )}
        </div>
        
        {/* Telemetry Panel — collapsible to a compact speed chip */}
        {showTelemetryPanel && telemetry && !telemetryStale && telemetry.speed > 0 && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.08)',
            minWidth: '160px',
            pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
              <button
                onClick={() => setTelemetryMinimized((m) => !m)}
                title={telemetryMinimized ? 'Expand telemetry' : 'Minimize telemetry'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px', borderRadius: '6px', color: '#666',
                  display: 'flex', alignItems: 'center', fontSize: '12px',
                }}
              >
                {telemetryMinimized ? '▼' : '▲'}
              </button>
            </div>
            {telemetryMinimized ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a2e', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(telemetry.speed)}
                </span>
                <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#666' }}>km/h</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6' }}>{getHeadingLabel(telemetry.heading)}</span>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '0.65rem', 
                  color: '#666',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <Activity size={10} style={{ color: '#3b82f6' }} />
                  Speed
                </div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '800', 
                  color: telemetry.speed > 60 ? '#cf1322' : '#1a1a2e',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {Math.round(telemetry.speed)} km/h
                </div>
              </div>
              
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '0.65rem', 
                  color: '#666',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <Compass size={10} style={{ color: '#f97316' }} />
                  Heading
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  fontWeight: '700', 
                  color: '#1a1a2e',
                }}>
                  {getHeadingLabel(telemetry.heading)}
                </div>
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '0.65rem', 
                  color: '#666',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <Wind size={10} style={{ 
                    color: (telemetry.comfort || 'Smooth') === 'Smooth' ? '#28a745' : 
                           (telemetry.comfort || 'Smooth') === 'Moderate' ? '#f97316' : '#ef4444' 
                  }} />
                  Comfort
                </div>
                <div style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '700', 
                  color: (telemetry.comfort || 'Smooth') === 'Smooth' ? '#28a745' : 
                         (telemetry.comfort || 'Smooth') === 'Moderate' ? '#f97316' : '#ef4444',
                }}>
                  {telemetry.comfort || 'Smooth'}
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Top-right: Fullscreen button (normal mode only — the fullscreen
          header has its own exit button) */}
      {showFullscreenButton && !isFullscreen && (
        <div style={{ position: 'absolute', top: '12px', right: '12px', pointerEvents: 'auto' }}>
          <button
            onClick={() => toggleFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              border: '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isFullscreen ? <X size={20} color="#1a1a2e" /> : <Maximize2 size={20} color="#3b82f6" />}
          </button>
        </div>
      )}
      
      {/* Bottom-right: Zoom / Recenter / Lock. Leaflet's default zoom sat
          top-left UNDER the LIVE badge and telemetry panel — custom buttons
          in this stack remove the overlap. Raised in fullscreen so it does
          not sit on the footer lock. */}
      <div style={{ position: 'absolute', bottom: isFullscreen ? '76px' : '12px', right: '12px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        {[
          { label: '+', title: 'Zoom in', action: () => mapInstance.current?.zoomIn() },
          { label: '−', title: 'Zoom out', action: () => mapInstance.current?.zoomOut() },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            title={btn.title}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              border: '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#1a1a2e',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            {btn.label}
          </button>
        ))}
        {showRecenterButton && !isFullscreen && (
          <button
            onClick={recenterMap}
            title="Recenter on bus"
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              border: '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Navigation size={20} color="#3b82f6" />
          </button>
        )}
        
        {showAutoFollowToggle && !isFullscreen && (
          <LockOnBusButton active={autoFollow} onToggle={handleAutoFollowChange} />
        )}
      </div>
      
      {/* Bottom-left: Map info */}
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', pointerEvents: 'auto' }}>
        <div style={{
          padding: '6px 10px',
          borderRadius: '8px',
          fontSize: '0.65rem',
          fontWeight: 600,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#666',
          fontFamily: 'monospace',
        }}>
          {busLocation[0].toFixed(5)}, {busLocation[1].toFixed(5)}
        </div>
      </div>
    </div>
  );
  
  const fullscreenHeader = isFullscreen ? (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '12px', 
          background: 'rgba(59,130,246,0.2)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <MapPin size={22} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
            Live Bus Tracking
          </h2>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
            {busLabel} {routeInfo?.busNumber || routeInfo?.bus_number || routeInfo?.routeId || ''} • 
            {routeInfo?.routeName || 'Active Route'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* GPS Status in fullscreen */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.7rem',
            fontWeight: '700',
            background: gpsStatus.bg,
            color: gpsStatus.color,
            border: `1px solid ${gpsStatus.color}40`,
          }}
        >
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: gpsStatus.color,
            animation: gpsStatus.status === 'live' ? 'pulse 1.5s infinite' : 'none'
          }} />
          {gpsStatus.label}
        </div>
        <button
          onClick={() => toggleFullscreen(false)}
          title="Exit Fullscreen"
          style={{
            padding: '8px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            color: 'white',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <X size={22} />
        </button>
      </div>
    </div>
  ) : null;
  
  const fullscreenFooter = isFullscreen && showAutoFollowToggle ? (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      zIndex: 1000,
      pointerEvents: 'auto',
    }}>
      <LockOnBusButton active={autoFollow} onToggle={handleAutoFollowChange} size={44} />
    </div>
  ) : null;
  
  const fullscreenRecenter = isFullscreen && showRecenterButton ? (
    <div style={{
      position: 'absolute',
      top: '72px',
      right: '16px',
      zIndex: 1000,
      pointerEvents: 'auto',
    }}>
      <button
        onClick={recenterMap}
        title="Recenter on bus"
        style={{
          padding: '10px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          border: '1px solid rgba(0,0,0,0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Navigation size={22} color="#3b82f6" />
      </button>
    </div>
  ) : null;

  const mapUi = (
    <div
      ref={mapHostRef}
      style={containerStyle}
      className={className}
      role="application"
      aria-label="Live bus tracking map"
    >
      {fullscreenHeader}
      <div style={{
        height: '100%',
        minHeight: isFullscreen ? 0 : minHeight,
        width: '100%',
        position: 'relative',
        borderRadius: isFullscreen ? '0' : '16px',
        overflow: 'hidden'
      }}>
        {/* Absolute fill: percentage heights nested inside auto-height cards
            resolve to zero, but an absolutely-positioned child stretches to
            the host's real box regardless. */}
        <MapContainer
          center={isFullscreen && autoFollow ? busLocation : mapCenter}
          zoom={isFullscreen && autoFollow ? 15 : mapZoom}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
          zoomControl={false}
          scrollWheelZoom={true}
          dragging={true}
          attributionControl={true}
          onClick={handleMapClick}
        >
          {renderMapContent()}
        </MapContainer>
        {renderOverlayControls()}
        {fullscreenFooter}
        {fullscreenRecenter}
      </div>
      
      {/* Animation keyframes for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .custom-bus-popup .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
        }
        .custom-bus-popup .leaflet-popup-tip {
          background: white !important;
        }
      `}</style>
    </div>
  );

  // CSS/portal fallback only (no Fullscreen API). Dashboard cards use
  // backdrop-filter, which makes them the containing block for fixed
  // children — the portal escapes that by mounting on document.body.
  if (isFullscreen && portalFallbackRef.current && typeof document !== 'undefined') {
    return createPortal(mapUi, document.body);
  }
  return mapUi;
};

export default UnifiedMap;