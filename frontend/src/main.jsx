import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import axios from 'axios';

axios.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('bus_saarthi_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user && user.token) {
        if (config.headers && typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${user.token}`);
        } else {
          config.headers['Authorization'] = `Bearer ${user.token}`;
        }
      }
    } catch {
      // A malformed stored session is ignored — the user simply signs in again.
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired session should send the user back to the login screen
    // rather than leaving them on a page that silently does nothing.
    // Every other failure is handled by the calling component, which shows
    // a human-readable message — the raw error never reaches the screen.
    const status = error?.response?.status;
    if (status === 401) {
      if (localStorage.getItem('bus_saarthi_user')) {
        // The login endpoint itself returning 401 is a normal
        // "wrong password", not an expired session.
        const isLoginCall = String(error?.config?.url || '').includes(
          '/api/login',
        );
        if (!isLoginCall) {
          localStorage.removeItem('bus_saarthi_user');
          if (window.location.pathname !== '/login') {
            window.location.replace('/login');
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Any unhandled promise rejection is logged, never shown raw.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
