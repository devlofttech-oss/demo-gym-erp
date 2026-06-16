import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import RoleRoute from './components/auth/RoleRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MemberList from './pages/members/MemberList';
import AddMember from './pages/members/AddMember';
import MemberProfile from './pages/members/MemberProfile';
import PaymentsList from './pages/payments/PaymentsList';
import PaymentPage from './pages/payments/PaymentPage';
import CheckinScreen from './pages/attendance/CheckinScreen';
import AllCheckins from './pages/attendance/AllCheckins';
import ScannerKiosk from './pages/attendance/ScannerKiosk';
import Settings from './pages/settings/Settings';
import StaffList from './pages/staff/StaffList';
import StaffProfile from './pages/staff/StaffProfile';
import EquipmentList from './pages/equipment/EquipmentList';
import SupplementList from './pages/supplements/SupplementList';
import ClassList from './pages/classes/ClassList';
import ClassDetail from './pages/classes/ClassDetail';
import AddClass from './pages/classes/AddClass';
import ExpenseList from './pages/expenses/ExpenseList';

function RoleRedirect() {
  const { role } = useAuth();
  if (role === 'staff') return <Navigate to="/checkin" replace />;
  return <Dashboard />;
}

const ADMIN = ['admin'];
const ALL   = ['admin', 'staff'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Standalone scanner kiosk — no sidebar/nav, opens in popup window */}
      <Route path="/scanner" element={
        <RoleRoute allowedRoles={ALL}>
          <ScannerKiosk />
        </RoleRoute>
      } />

      <Route
        path="/*"
        element={
          <RoleRoute allowedRoles={ALL}>
            <DashboardLayout />
          </RoleRoute>
        }
      >
        {/* Default — redirects based on role */}
        <Route index element={<RoleRedirect />} />

        {/* Admin-only */}
        <Route path="members"       element={<RoleRoute allowedRoles={ADMIN}><MemberList /></RoleRoute>} />
        <Route path="members/add"   element={<RoleRoute allowedRoles={ADMIN}><AddMember /></RoleRoute>} />
        <Route path="members/:id"   element={<RoleRoute allowedRoles={ADMIN}><MemberProfile /></RoleRoute>} />
        <Route path="payments"      element={<RoleRoute allowedRoles={ADMIN}><PaymentsList /></RoleRoute>} />
        <Route path="payments/new"  element={<RoleRoute allowedRoles={ADMIN}><PaymentPage /></RoleRoute>} />
        <Route path="classes"           element={<RoleRoute allowedRoles={ADMIN}><ClassList /></RoleRoute>} />
        <Route path="classes/add"       element={<RoleRoute allowedRoles={ADMIN}><AddClass /></RoleRoute>} />
        <Route path="classes/edit/:id"  element={<RoleRoute allowedRoles={ADMIN}><AddClass /></RoleRoute>} />
        <Route path="classes/:id"       element={<RoleRoute allowedRoles={ADMIN}><ClassDetail /></RoleRoute>} />
        <Route path="staff"         element={<RoleRoute allowedRoles={ADMIN}><StaffList /></RoleRoute>} />
        <Route path="staff/:id"     element={<RoleRoute allowedRoles={ADMIN}><StaffProfile /></RoleRoute>} />
        <Route path="equipment"     element={<RoleRoute allowedRoles={ADMIN}><EquipmentList /></RoleRoute>} />
        <Route path="supplements"   element={<RoleRoute allowedRoles={ADMIN}><SupplementList /></RoleRoute>} />
        <Route path="expenses"      element={<RoleRoute allowedRoles={ADMIN}><ExpenseList /></RoleRoute>} />
        <Route path="settings"      element={<RoleRoute allowedRoles={ADMIN}><Settings /></RoleRoute>} />

        <Route path="attendance" element={<RoleRoute allowedRoles={ALL}><AllCheckins /></RoleRoute>} />

        {/* Admin + Staff */}
        <Route path="checkin" element={<RoleRoute allowedRoles={ALL}><CheckinScreen /></RoleRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
