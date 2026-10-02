import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AuditLogsPage from './pages/AuditLogsPage';
import DashboardPage from './pages/DashboardPage';
import EnvironmentsPage from './pages/EnvironmentsPage';
import FlagDetailPage from './pages/flag/FlagDetailPage';
import FlagsPage from './pages/FlagsPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="flags" element={<FlagsPage />} />
        <Route path="flags/:id" element={<FlagDetailPage />} />
        <Route path="environments" element={<EnvironmentsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="users" element={<ProtectedRoute roles={['Admin']}><UsersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
