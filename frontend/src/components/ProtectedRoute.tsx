import { Box, CircularProgress } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types';
import EmptyState from './EmptyState';

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: RoleName[] }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !hasRole(...roles)) {
    return <EmptyState title="You don't have access to this page" text={`This page is available to: ${roles.join(', ')}. Ask an Admin if you need access.`} />;
  }
  return <>{children}</>;
}
