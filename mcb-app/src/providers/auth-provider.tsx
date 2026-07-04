import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the persisted session has been read from storage. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Only refresh tokens while the app is foregrounded — pairs with the
  // aggressive-disconnect posture for backgrounded clients (FR-4.1.4).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    supabase.auth.startAutoRefresh();
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
