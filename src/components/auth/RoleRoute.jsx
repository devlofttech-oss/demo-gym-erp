import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleRoute({ children, allowedRoles }) {
  const { currentUser, role } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admin can only access /super-admin/* routes
  if (role === 'superadmin' && !allowedRoles?.includes('superadmin')) {
    return <Navigate to="/super-admin" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'staff' ? '/checkin' : '/'} replace />;
  }

  return children;
}
