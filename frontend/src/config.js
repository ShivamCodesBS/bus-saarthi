// Global Configuration for Bus Saarthi
// 
// For LOCAL DEVELOPMENT: Create frontend/.env with VITE_API_URL=http://localhost:5000
// For VERCEL TESTING:    Set VITE_API_URL in Vercel project env vars
// For VPS PRODUCTION:    Set VITE_API_URL to your VPS domain (e.g. https://api.bussaarthi.com)
//
// ⚠️  DO NOT hardcode any production URLs here

export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
