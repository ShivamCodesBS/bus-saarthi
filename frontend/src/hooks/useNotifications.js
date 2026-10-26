import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { BACKEND_URL, SOCKET_URL } from '../config';

/**
 * In-app notification feed for the signed-in user.
 *
 * Loads the inbox once, keeps the unread badge in sync with the server's
 * own count, and applies live `notification` socket events (delivered to
 * the `user_<login_id>` room by the gateway) instead of waiting for the
 * next poll.
 */
export function useNotifications(options = {}) {
  const {
    limit = 30,
    autoRefresh = true,
    refreshInterval = 30000,
    token: initialToken = null,
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const tokenRef = useRef(initialToken);
  const mountedRef = useRef(true);

  const setToken = useCallback((token) => {
    tokenRef.current = token;
  }, []);

  const fetchNotifications = useCallback(async (signal) => {
    const token = tokenRef.current;
    if (!token) {
      setIsLoading(false);
      return [];
    }
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/notifications/inbox?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` }, signal },
      );
      // The inbox response carries the authoritative unread count — the
      // feed only holds the newest `limit` items, so counting them locally
      // under-reports once there are more than `limit` unread.
      const result = response.data?.data || [];
      const serverUnread = response.data?.unread_count;
      if (mountedRef.current) {
        setNotifications(result);
        if (typeof serverUnread === 'number') setUnreadCount(serverUnread);
        setIsLoading(false);
        setError(null);
      }
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return [];
      if (mountedRef.current) {
        setError(err);
        setIsLoading(false);
      }
      return [];
    }
  }, [limit]);

  const markAsRead = useCallback(async (ids) => {
    const token = tokenRef.current;
    if (!token) return { status: 'error', message: 'No token' };
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/notifications/read`,
        { ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (mountedRef.current && response.data?.status === 'success') {
        setNotifications((prev) =>
          prev.map((n) => (ids?.includes(n.id) ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - (ids?.length || 1)));
      }
      return response.data;
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      return { status: 'error', message: err.message };
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return { status: 'error', message: 'No token' };
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/notifications/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (mountedRef.current && response.data?.status === 'success') {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
      return response.data;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      return { status: 'error', message: err.message };
    }
  }, []);

  // Initial load + polling refresh
  useEffect(() => {
    mountedRef.current = true;
    if (!initialToken) {
      setIsLoading(false);
      return;
    }
    tokenRef.current = initialToken;

    const controller = new AbortController();
    fetchNotifications(controller.signal);

    let timer = null;
    if (autoRefresh) {
      timer = setInterval(() => {
        if (mountedRef.current && tokenRef.current) {
          fetchNotifications().catch(() => {});
        }
      }, refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
      controller.abort();
    };
  }, [initialToken, limit, autoRefresh, refreshInterval, fetchNotifications]);

  // Live updates over the socket the gateway already routes to `user_<id>`.
  useEffect(() => {
    if (!initialToken) return;
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: initialToken },
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('notification', (n) => {
      if (!mountedRef.current || !n) return;
      setNotifications((prev) => {
        if (n.id && prev.some((p) => p.id === n.id)) return prev;
        return [{ ...n, read: false }, ...prev].slice(0, limit);
      });
      setUnreadCount((prev) => prev + 1);
    });

    return () => socket.disconnect();
  }, [initialToken, limit]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    setToken,
  };
}
