import { useEffect, useRef, useState } from 'react';

/**
 * Trip status for live tracking, shared by the dashboards.
 *
 *   'offline' — no telemetry at all, or the last fix is older than staleMs
 *   'moving'  — bus is reporting and its speed is above the threshold
 *   'active'  — bus is reporting but standing still
 *
 * The transition moving → active is deliberately debounced (stopMs): GPS
 * speed flickers to 0 at every red light, and the status card used to
 * flap between "Running" and "Active" constantly. A bus keeps showing
 * "moving" for stopMs after the last moving fix before it settles.
 */
export function useTripStatus(telemetry, options = {}) {
  const {
    staleMs = 10000,   // no fix for this long → offline
    stopMs = 8000,     // grace period after the last moving fix
    movingKmh = 3,     // above this speed the bus counts as moving
  } = options;

  const [status, setStatus] = useState('offline');
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const lastMovingAtRef = useRef(0);

  useEffect(() => {
    const evaluate = () => {
      const t = telemetryRef.current;
      if (!t?.lastUpdated) {
        setStatus('offline');
        return;
      }
      const age = Date.now() - new Date(t.lastUpdated).getTime();
      if (age > staleMs) {
        setStatus('offline');
        return;
      }
      if ((t.speed || 0) > movingKmh) {
        lastMovingAtRef.current = Date.now();
        setStatus('moving');
        return;
      }
      // Standing still — but hold "moving" for the grace period so the
      // status does not flap at every signal.
      if (lastMovingAtRef.current && Date.now() - lastMovingAtRef.current < stopMs) {
        setStatus('moving');
      } else {
        setStatus('active');
      }
    };

    evaluate();
    const timer = setInterval(evaluate, 2000);
    return () => clearInterval(timer);
  }, [staleMs, stopMs, movingKmh]);

  return status;
}
