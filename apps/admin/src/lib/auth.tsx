'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export interface Me {
  user: { id: string; name: string; email: string; roleKey: string; totpEnabled: boolean };
  capabilities: string[];
  stepUpUntil: string | null;
  testMode: boolean;
  mustEnroll2fa: boolean;
  mustChangePassword: boolean;
  quickActions: string[];
}

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasCap: (cap: string) => boolean;
  hasAnyCap: (prefix: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  refresh: async () => {},
  hasCap: () => false,
  hasAnyCap: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Me>('/auth/me');
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasCap = useCallback((cap: string) => me?.capabilities.includes(cap) ?? false, [me]);
  const hasAnyCap = useCallback(
    (prefix: string) => me?.capabilities.some((c) => c.startsWith(prefix)) ?? false,
    [me],
  );

  return (
    <AuthContext.Provider value={{ me, loading, refresh, hasCap, hasAnyCap }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
