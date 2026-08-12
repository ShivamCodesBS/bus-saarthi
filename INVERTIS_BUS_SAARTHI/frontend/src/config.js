// Global Configuration for Bus Saarthi
// This URL will be used across all components for API and Socket.io connections.
//
// For LOCAL DEVELOPMENT: Set VITE_API_URL=http://localhost:5000 in frontend/.env
// For PRODUCTION: VITE_API_URL is not set → falls back to Render.com deployment URL

export const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://bus-sarthi.onrender.com';
export const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://bus-sarthi.onrender.com';
