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
import MonthlyReport from './pages/reports/MonthlyReport';
import PlanList from './pages/plans/PlanList';
import LeadList from './pages/leads/LeadList';
import MeasurementList from './pages/measurements/MeasurementList';
import WorkoutList from './pages/workouts/WorkoutList';
import PTList from './pages/pt/PTList';
// import DietList from './pages/diet/DietList'; // Diet module on hold
import CommunicationHub from './pages/communication/CommunicationHub';
import RenewalsList from './pages/renewals/RenewalsList';
import MemberQRPage from './pages/public/MemberQRPage';
import ReceiptPage from './pages/public/ReceiptPage';

// Super Admin
import SuperAdminLayout from './pages/super-admin/SuperAdminLayout';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import GymList from './pages/super-admin/GymList';
import GymForm from './pages/super-admin/GymForm';
import SetupSuperAdmin from './pages/super-admin/SetupSuperAdmin';
import TrialList from './pages/super-admin/TrialList';
import SubscriptionPlans from './pages/super-admin/SubscriptionPlans';
import RegisterPage from './pages/RegisterPage';
import SubscriptionEnded from './pages/SubscriptionEnded';
import SubscribePage from './pages/subscription/SubscribePage';
import PaymentReturn from './pages/subscription/PaymentReturn';

function RoleRedirect() {
  const { role } = useAuth();
  if (role === 'staff') return <Navigate to="/checkin" replace />;
  return <Dashboard />;
}

const ADMIN      = ['admin'];
const ALL        = ['admin', 'staff'];
const SUPERADMIN = ['superadmin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/subscription-ended" element={<SubscriptionEnded />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/setup-superadmin" element={<SetupSuperAdmin />} />
      <Route path="/qr/:memberId" element={<MemberQRPage />} />
      <Route path="/receipt/:receiptId" element={<ReceiptPage />} />

      {/* Standalone scanner kiosk */}
      <Route path="/scanner" element={
        <RoleRoute allowedRoles={ALL}>
          <ScannerKiosk />
        </RoleRoute>
      } />

      {/* Super Admin panel */}
      <Route path="/super-admin" element={
        <RoleRoute allowedRoles={SUPERADMIN}>
          <SuperAdminLayout />
        </RoleRoute>
      }>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="gyms" element={<GymList />} />
        <Route path="gyms/new" element={<GymForm />} />
        <Route path="gyms/:id/edit" element={<GymForm />} />
        <Route path="trials" element={<TrialList />} />
        <Route path="plans" element={<SubscriptionPlans />} />
      </Route>

      {/* Gym ERP (admin + staff) */}
      <Route path="/*" element={
        <RoleRoute allowedRoles={ALL}>
          <DashboardLayout />
        </RoleRoute>
      }>
        <Route index element={<RoleRedirect />} />

        {/* Admin-only */}
        {/* Subscription: admin buys/renews; PhonePe returns to /subscription/return */}
        <Route path="subscription"        element={<RoleRoute allowedRoles={ADMIN}><SubscribePage /></RoleRoute>} />
        <Route path="subscription/return" element={<RoleRoute allowedRoles={ADMIN}><PaymentReturn /></RoleRoute>} />

        <Route path="members"            element={<RoleRoute allowedRoles={ADMIN}><MemberList /></RoleRoute>} />
        <Route path="members/add"        element={<RoleRoute allowedRoles={ADMIN}><AddMember /></RoleRoute>} />
        <Route path="members/:id"        element={<RoleRoute allowedRoles={ADMIN}><MemberProfile /></RoleRoute>} />
        <Route path="members/:id/edit"   element={<RoleRoute allowedRoles={ADMIN}><AddMember /></RoleRoute>} />
        <Route path="payments"          element={<RoleRoute allowedRoles={ADMIN}><PaymentsList /></RoleRoute>} />
        <Route path="payments/new"      element={<RoleRoute allowedRoles={ADMIN}><PaymentPage /></RoleRoute>} />
        <Route path="classes"           element={<RoleRoute allowedRoles={ADMIN}><ClassList /></RoleRoute>} />
        <Route path="classes/add"       element={<RoleRoute allowedRoles={ADMIN}><AddClass /></RoleRoute>} />
        <Route path="classes/edit/:id"  element={<RoleRoute allowedRoles={ADMIN}><AddClass /></RoleRoute>} />
        <Route path="classes/:id"       element={<RoleRoute allowedRoles={ADMIN}><ClassDetail /></RoleRoute>} />
        <Route path="staff"             element={<RoleRoute allowedRoles={ADMIN}><StaffList /></RoleRoute>} />
        <Route path="staff/:id"         element={<RoleRoute allowedRoles={ADMIN}><StaffProfile /></RoleRoute>} />
        <Route path="equipment"         element={<RoleRoute allowedRoles={ADMIN}><EquipmentList /></RoleRoute>} />
        <Route path="supplements"       element={<RoleRoute allowedRoles={ADMIN}><SupplementList /></RoleRoute>} />
        <Route path="expenses"          element={<RoleRoute allowedRoles={ADMIN}><ExpenseList /></RoleRoute>} />
        <Route path="plans"             element={<RoleRoute allowedRoles={ADMIN}><PlanList /></RoleRoute>} />
        <Route path="leads"             element={<RoleRoute allowedRoles={ADMIN}><LeadList /></RoleRoute>} />
        <Route path="measurements"      element={<RoleRoute allowedRoles={ALL}><MeasurementList /></RoleRoute>} />
        <Route path="workouts"          element={<RoleRoute allowedRoles={ADMIN}><WorkoutList /></RoleRoute>} />
        <Route path="pt"                element={<RoleRoute allowedRoles={ADMIN}><PTList /></RoleRoute>} />
        {/* <Route path="diet" element={<RoleRoute allowedRoles={ADMIN}><DietList /></RoleRoute>} /> */} {/* Diet module on hold */}
        <Route path="communication"     element={<RoleRoute allowedRoles={ADMIN}><CommunicationHub /></RoleRoute>} />
        <Route path="renewals"          element={<RoleRoute allowedRoles={ADMIN}><RenewalsList /></RoleRoute>} />
        <Route path="reports/monthly"   element={<RoleRoute allowedRoles={ADMIN}><MonthlyReport /></RoleRoute>} />
        <Route path="settings"          element={<RoleRoute allowedRoles={ADMIN}><Settings /></RoleRoute>} />

        <Route path="attendance" element={<RoleRoute allowedRoles={ALL}><AllCheckins /></RoleRoute>} />
        <Route path="checkin"    element={<RoleRoute allowedRoles={ALL}><CheckinScreen /></RoleRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
