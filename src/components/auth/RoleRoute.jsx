import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleRoute({ children, allowedRoles }) {
  const { currentUser, role, isImpersonating } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admin can only access /super-admin/* routes — unless they're impersonating a gym
  if (role === 'superadmin' && !allowedRoles?.includes('superadmin') && !isImpersonating) {
    return <Navigate to="/super-admin" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role) && !isImpersonating) {
    return <Navigate to={role === 'staff' ? '/checkin' : '/'} replace />;
  }

  return children;
}
