import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    // User is not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // User does not have the required role, redirect to their appropriate home
    const fallback =
      user.role === 'admin' ? '/admin-dashboard' :
      user.role === 'transport_incharge' ? '/transport-incharge-dashboard' :
      '/home';
    return <Navigate to={fallback} replace />;
  }

  // User is authenticated and has the correct role, render the component
  return children;
};

export default ProtectedRoute;
