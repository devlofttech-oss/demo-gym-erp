import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleRoute({ children, allowedRoles }) {
  const { currentUser, role } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Staff lands on /checkin, anyone else back to root
    return <Navigate to={role === 'staff' ? '/checkin' : '/'} replace />;
  }

  return children;
}
