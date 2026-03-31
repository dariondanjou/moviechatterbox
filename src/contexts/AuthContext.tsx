"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

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
  loading: boolean;
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

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [rawUser, setRawUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes first so we catch the SIGNED_IN event
    // that fires when detectSessionInUrl processes the OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setRawUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setRawUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = useMemo(() => toAppUser(rawUser), [rawUser]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const signInWithTwitter = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "twitter",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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

  const value = useMemo<AuthState>(() => ({
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
  }), [user, session, isLoading, signInWithGoogle, signInWithTwitter, signInWithEmail, signUpWithEmail, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
