import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
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

const subscribeToPushNotifications = async (token) => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      // Skip silently if VAPID key is not configured (local dev)
      if (!publicVapidKey) return;

      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
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
      // Silent fail — push notifications are optional and require HTTPS + VAPID keys
      if (import.meta.env.DEV) console.debug('Push notifications unavailable in dev:', err.name);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (parsedUser.token) {
          subscribeToPushNotifications(parsedUser.token);
        }
      } catch (e) {
        console.error("Error parsing user data");
      }
    }
    setLoading(false);
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
        if (nextUser?.token) {
          subscribeToPushNotifications(nextUser.token);
        }
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
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    
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

    return () => socket.disconnect();
  }, [user?.id, user?.login_id]);

  /**
   * Sign in.
   *
   * The session lives in localStorage, which every tab of the same origin
   * shares. Writing it here is what lets the other tabs pick the change up
   * through the `storage` event below.
   */
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    if (userData.token) {
      subscribeToPushNotifications(userData.token);
    }
  };

  /**
   * Sign out. The other tabs are told by the `storage` event, so a session
   * cannot survive in a tab that is still open.
   */
  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
