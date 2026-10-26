import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

/**
 * Simple in-memory cache for stale-while-revalidate pattern
 * Key: cache key, Value: { data, timestamp }
 */
const dataCache = new Map();

/**
 * Stale-while-revalidate hook for fast initial load with live updates
 * 
 * @param {string} url - API endpoint (relative to BACKEND_URL)
 * @param {Object} options - Fetch options
 * @param {string} options.cacheKey - Custom cache key (defaults to URL)
 * @param {number} options.staleTime - Time in ms before data is considered stale (default 30s)
 * @param {boolean} options.skip - Skip initial fetch
 * @param {Function} options.onData - Callback when fresh data arrives
 * @returns {Object} { data, isLoading, isStale, error, refetch }
 */
export function useStaleWhileRevalidate(url, options = {}) {
  const {
    cacheKey = url,
    staleTime = 30000, // 30 seconds
    skip = false,
    onData,
    token: initialToken = null, // Accept initial token
  } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref for token so it can be updated externally via setToken
  // but also accept initial token from options
  const tokenRef = useRef(initialToken);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  // onData is usually an inline arrow, so its identity changes every render.
  // Keeping it in a ref keeps fetchFresh (and therefore the initial-load
  // effect below) stable — otherwise every re-render aborted and re-issued
  // the in-flight request.
  const onDataRef = useRef(onData);
  useEffect(() => { onDataRef.current = onData; }, [onData]);

  // Set token from outside (auth context)
  const setToken = useCallback((token) => {
    tokenRef.current = token;
  }, []);

  const fetchFresh = useCallback(async (signal) => {
    try {
      const token = tokenRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${BACKEND_URL}${url}`, {
        headers,
        signal,
      });

      // Handle different response formats:
      // - Array: use directly
      // - Object with .data property: use .data
      // - Object without .data (direct object): use the object itself
      let result;
      if (Array.isArray(response.data)) {
        result = response.data;
      } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        result = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        // Direct object response (e.g., /api/users/me returns user object directly)
        result = response.data;
      } else {
        result = [];
      }
      
      // Update cache with fresh data
      dataCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      if (mountedRef.current) {
        setData(result);
        setIsStale(false);
        setError(null);
        if (onDataRef.current) onDataRef.current(result);
      }

      return result;
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return null; // Silently ignore aborted requests
      }
      if (mountedRef.current) {
        setError(err);
      }
      throw err;
    }
  }, [url, cacheKey]);

  const refetch = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    if (mountedRef.current) {
      setIsLoading(true);
    }
    
    try {
      await fetchFresh(abortControllerRef.current.signal);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFresh]);

  // Initial load - show cached data immediately, then fetch fresh
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Check cache first
    const cached = dataCache.get(cacheKey);
    if (cached && !skip) {
      const isExpired = Date.now() - cached.timestamp > staleTime;
      setData(cached.data);
      setIsStale(isExpired);
      setIsLoading(false);

      // If stale, fetch fresh in background
      if (isExpired) {
        // Don't await - fire and forget for background refresh
        abortControllerRef.current = new AbortController();
        fetchFresh(abortControllerRef.current.signal).catch(() => {});
      }
    } else if (!skip) {
      // No cache - fetch immediately AND AWAIT IT
      abortControllerRef.current = new AbortController();

      const loadInitial = async () => {
        try {
          await fetchFresh(abortControllerRef.current.signal);
        } catch (err) {
          // Ignore abort/cancel errors
          if (err.name === 'AbortError' || err.name === 'CanceledError' || cancelled) return;
        } finally {
          if (mountedRef.current && !cancelled) {
            setIsLoading(false);
          }
        }
      };

      loadInitial();
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, cacheKey, staleTime, skip, fetchFresh]);

  // Invalidate cache entry
  const invalidate = useCallback(() => {
    dataCache.delete(cacheKey);
    return refetch();
  }, [cacheKey, refetch]);

  return { data, isLoading, isStale, error, refetch, invalidate, setToken };
}

/**
 * Hook for managing multiple related queries with coordinated invalidation
 */
export function useQueryClient() {
  const invalidateQueries = useCallback((patterns) => {
    if (typeof patterns === 'string') {
      patterns = [patterns];
    }
    patterns.forEach(pattern => {
      for (const key of dataCache.keys()) {
        if (key.includes(pattern)) {
          dataCache.delete(key);
        }
      }
    });
  }, []);

  const clearAll = useCallback(() => {
    dataCache.clear();
  }, []);

  const getCached = useCallback((key) => {
    return dataCache.get(key)?.data || null;
  }, []);

  const setCached = useCallback((key, data, staleTime = 30000) => {
    dataCache.set(key, { data, timestamp: Date.now() });
  }, []);

  return { invalidateQueries, clearAll, getCached, setCached };
}

/**
 * Preload data into cache without triggering UI updates
 */
export async function preloadQuery(url, options = {}) {
  const { cacheKey = url, token = null } = options;
  
  // Don't preload if already cached and fresh
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }

  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get(`${BACKEND_URL}${url}`, { headers });
    const result = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    
    dataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    
    return result;
  } catch (err) {
    console.warn(`Preload failed for ${url}:`, err.message);
    return null;
  }
}

/**
 * Manually set cache data (e.g., after a mutation)
 */
export function setCacheData(cacheKey, data) {
  dataCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get cache data without subscribing
 */
export function getCacheData(cacheKey) {
  return dataCache.get(cacheKey)?.data || null;
}

export default dataCache;