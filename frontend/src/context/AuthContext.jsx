import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { clearSwrDiskCache } from '../hooks/useStaleWhileRevalidate';
import { BACKEND_URL } from '../config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

/** The session is shared by every tab of this origin. */
const STORAGE_KEY = 'bus_saarthi_user';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Get token from the HttpOnly cookie where the browser sends it, falling
// back to the token stored with the session — cross-site deployments
// (Vercel app -> Render API) may block the cookie entirely, so the stored
// token is what actually keeps those sessions alive.
const getAuthToken = async ({ allowStored = true } = {}) => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/auth/token`, { withCredentials: true });
    if (res.data?.token) return res.data.token;
  } catch {
    /* cookie not sent — fall through to the stored session */
  }
  if (!allowStored) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return stored?.token || null;
  } catch {
    return null;
  }
};

const subscribeToPushNotifications = async () => {
  const token = await getAuthToken();
  if (!token) return;
  
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) return;

      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied') return;

      const registration = await navigator.serviceWorker.register('/sw.js');
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }
      if (permission === 'granted') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
        await axios.post(`${BACKEND_URL}/api/push/subscribe`, {
          subscription,
          device_type: 'web'
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.debug('Push notifications unavailable in dev:', err.name);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load. A credential is resolved (cookie token or
  // the stored session's token) and validated against /api/users/me with the
  // Bearer header — the cookie alone can never be relied on cross-site.
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          console.log("Not authenticated");
          return;
        }
        const res = await axios.get(`${BACKEND_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        if (res.data) {
          const userData = {
            ...res.data,
            token,
            id: res.data.loginId || res.data.login_id,
          };
          setUser(userData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
          subscribeToPushNotifications();
        }
      } catch (e) {
        // 401 (or worse): the credential is expired/revoked. Drop the stored
        // session so the next load starts clean at the login screen instead
        // of restoring a half-broken session.
        localStorage.removeItem(STORAGE_KEY);
        console.log("Not authenticated");
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  /**
   * Keep every tab in step.
   *
   * The `storage` event fires in the OTHER tabs of the same origin when
   * localStorage changes. Without this, signing out in one tab left the
   * others signed in, and signing in as a different user in one tab left
   * the other tabs still holding the previous user's token — so a refresh
   * silently switched accounts.
   */
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;

      if (event.newValue === null) {
        // Signed out in another tab.
        setUser(null);
        return;
      }

      try {
        const nextUser = JSON.parse(event.newValue);
        setUser(nextUser);
        subscribeToPushNotifications();
      } catch (e) {
        setUser(null);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Listen for real-time profile updates across devices
  useEffect(() => {
    if (!user) return;
    // The auth token lets the gateway auto-join `user_<login_id>` — that
    // room is what carries profile_update / personal notifications.
    let socket = null;
    let cancelled = false;

    const initSocket = async () => {
      const token = await getAuthToken();
      if (cancelled) return;
      socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket connection error (Auth):', err.message);
      });

      socket.on('profile_update', (data) => {
        if (data.login_id === user.id || data.login_id === user.login_id) {
          setUser(prev => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              profile_pic: data.profile_pic,
              name: data.name || prev.name,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
        }
      });
    };
    // Listeners register INSIDE initSocket: the token fetch is async, so
    // touching `socket` before it resolves dereferences null — that was the
    // white screen every signed-in user hit on load.
    initSocket();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [user?.id, user?.login_id]);

  /**
   * Sign in.
   *
   * The session lives in localStorage (user data only), token is in HttpOnly cookie.
   */
  const login = useCallback(async (userData) => {
    // The login response carries the token (needed for every later Bearer
    // call). If a caller passes a user without one, pull it from the cookie
    // that the login response just set — deliberately NOT the localStorage
    // fallback, which could attach a previous session's token here.
    if (!userData?.token) {
      const token = await getAuthToken({ allowStored: false });
      userData = { ...userData, token };
    }
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    await subscribeToPushNotifications();
  }, []);

  /**
   * Merge partial profile changes (name, phone, profile_pic, …) into the
   * signed-in user without a re-login. Used when the user edits their own
   * account — the header, menus, and every page reading the auth context
   * would otherwise show the old values until the next full login.
   */
  const updateUser = (partial) => {
    if (!partial) return;
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  /**
   * Sign out. The other tabs are told by the `storage` event, so a session
   * cannot survive in a tab that is still open.
   */
  const logout = async () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    // withCredentials so the server can clear the HttpOnly cookie too —
    // without it the cookie survives across sites and the next login flow
    // sees a stale session on the API side.
    await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    clearSwrDiskCache();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
