import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Login from './pages/Login';

function ProtectedRoute({ children, authToken }) {
  const location = useLocation();
  if (!authToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('tech_admin_token'));

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          authToken ? <Navigate to="/" replace /> : <Login setAuthToken={setAuthToken} />
        } />
        
        <Route path="/" element={
          <ProtectedRoute authToken={authToken}>
            <Layout setAuthToken={setAuthToken} />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard authToken={authToken} />} />
          <Route path="logs" element={<Logs authToken={authToken} />} />
          <Route path="health" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
