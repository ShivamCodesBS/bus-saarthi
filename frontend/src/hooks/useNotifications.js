import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export function useNotifications(options) {
  if (options === void 0) { options = {}; }
  var limit = options.limit !== undefined ? options.limit : 30;
  var autoRefresh = options.autoRefresh !== undefined ? options.autoRefresh : true;
  var refreshInterval = options.refreshInterval !== undefined ? options.refreshInterval : 30000;
  var initialToken = options.token !== undefined ? options.token : null;

  var _a = useState([]),
    notifications = _a[0],
    setNotifications = _a[1];
  var _b = useState(0),
    unreadCount = _b[0],
    setUnreadCount = _b[1];
  var _c = useState(true),
    isLoading = _c[0],
    setIsLoading = _c[1];
  var _d = useState(null),
    error = _d[0],
    setError = _d[1];

  var tokenRef = useRef(initialToken);
  var abortControllerRef = useRef(null);
  var mountedRef = useRef(true);
  var refreshTimerRef = useRef(null);

  var setToken = useCallback(function (token) {
    tokenRef.current = token;
  }, []);

  var fetchNotifications = useCallback(function (signal) {
    try {
      var token = tokenRef.current;
      if (!token) return [];
      var headers = { Authorization: 'Bearer ' + token };
      return axios.get(BACKEND_URL + '/api/notifications/inbox?limit=' + limit, {
        headers: headers,
        signal: signal,
      }).then(function (response) {
        var result = response.data?.data || [];
        if (mountedRef.current) {
          setNotifications(result);
          var unread = result.filter(function (n) { return !n.read; }).length;
          setUnreadCount(unread);
          setIsLoading(false);
          setError(null);
        }
        return result;
      });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return [];
      }
      if (mountedRef.current) {
        setError(err);
        setIsLoading(false);
      }
      return [];
    }
  }, [limit]);

  var fetchUnreadCount = useCallback(function () {
    try {
      var token = tokenRef.current;
      if (!token) return 0;
      var headers = { Authorization: 'Bearer ' + token };
      return axios.get(BACKEND_URL + '/api/notifications/unread-count', { headers: headers })
        .then(function (response) {
          var count = response.data?.unread_count || 0;
          if (mountedRef.current) {
            setUnreadCount(count);
          }
          return count;
        });
    } catch (err) {
      return 0;
    }
  }, []);

  var markAsRead = useCallback(function (ids) {
    try {
      var token = tokenRef.current;
      if (!token) return { status: 'error', message: 'No token' };
      var headers = { Authorization: 'Bearer ' + token };
      return axios.post(BACKEND_URL + '/api/notifications/read', { ids: ids }, { headers: headers })
        .then(function (response) {
          if (mountedRef.current && response.data?.status === 'success') {
            setNotifications(function (prev) {
              return prev.map(function (n) {
                return ids?.includes(n.id) ? { read: true } : n;
              });
            });
            setUnreadCount(function (prev) { return Math.max(0, prev - (ids?.length || 1)); });
          }
          return response.data;
        });
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      return { status: 'error', message: err.message };
    }
  }, []);

  var markAllAsRead = useCallback(function () {
    try {
      var token = tokenRef.current;
      if (!token) return { status: 'error', message: 'No token' };
      var headers = { Authorization: 'Bearer ' + token };
      return axios.post(BACKEND_URL + '/api/notifications/read', {}, { headers: headers })
        .then(function (response) {
          if (mountedRef.current && response.data?.status === 'success') {
            setNotifications(function (prev) {
              return prev.map(function (n) { return { read: true }; });
            });
            setUnreadCount(0);
          }
          return response.data;
        });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      return { status: 'error', message: err.message };
    }
  }, []);

  useEffect(function () {
    mountedRef.current = true;
    if (!initialToken) {
      setIsLoading(false);
      return;
    }
    tokenRef.current = initialToken;
    abortControllerRef.current = new AbortController();
    var cancelled = false;
    var loadInitial = function () {
      try {
        fetchNotifications(abortControllerRef.current.signal);
      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError' || cancelled) return;
      } finally {
        if (mountedRef.current && !cancelled) {
          setIsLoading(false);
        }
      }
    };
    loadInitial();
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(function () {
        if (!mountedRef.current || !tokenRef.current) return;
        fetchNotifications(new AbortController().signal).catch(function () {});
        fetchUnreadCount().catch(function () {});
      }, refreshInterval);
    }
    return function () {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [initialToken, limit, autoRefresh, refreshInterval, fetchNotifications, fetchUnreadCount]);

  useEffect(function () {
    return function () {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    notifications: notifications,
    unreadCount: unreadCount,
    isLoading: isLoading,
    error: error,
    refetch: fetchNotifications,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    setToken: setToken,
  };
}