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
    } catch (e) {}
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Disabled aggressive auto-logout.
    // If a specific route fails (like a 403 WAF block on Render), 
    // it will now just return the error gracefully to the component instead of kicking you out.
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
