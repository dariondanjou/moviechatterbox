import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

// App-level user shape that components expect
export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  user: AppUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean; // alias for isLoading (compat)
  signInWithGoogle: () => Promise<void>;

  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

function toAppUser(su: SupabaseUser | null): AppUser | null {
  if (!su) return null;
  return {
    id: su.id,
    name: su.user_metadata?.name || su.user_metadata?.full_name || su.email?.split("@")[0] || null,
    email: su.email || null,
    avatarUrl: su.user_metadata?.avatar_url || su.user_metadata?.picture || null,
  };
}

export function useAuth(): AuthState {
  const [rawUser, setRawUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setRawUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setRawUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const user = useMemo(() => toAppUser(rawUser), [rawUser]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  }, []);


  const signInWithTwitter = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "twitter",
      options: { redirectTo: `${window.location.origin}/` },
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    session,
    isAuthenticated: !!session,
    isLoading,
    loading: isLoading,
    signInWithGoogle,

    signInWithTwitter,
    signInWithEmail,
    signUpWithEmail,
    logout,
  };
}
