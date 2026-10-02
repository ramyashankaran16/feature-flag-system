import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { tokens } from '../api/client';
import { authApi } from '../api/endpoints';
import type { RoleName, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleName[]) => boolean;
  /** Admins can change any environment; Developers only unprotected ones. */
  canEditEnv: (isProtected: boolean) => boolean;
  canEdit: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.access()) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('ff:session-expired', onExpired);
    return () => window.removeEventListener('ff:session-expired', onExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    tokens.set(res);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(tokens.refresh());
    } catch {
      /* token may already be invalid; sign out locally anyway */
    }
    tokens.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role.name;
    const hasRole = (...roles: RoleName[]) => !!role && roles.includes(role);
    return {
      user,
      loading,
      login,
      logout,
      hasRole,
      canEditEnv: (isProtected: boolean) => role === 'Admin' || (role === 'Developer' && !isProtected),
      canEdit: role === 'Admin' || role === 'Developer',
      isAdmin: role === 'Admin',
    };
  }, [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
