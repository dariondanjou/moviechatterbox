"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // The supabase client auto-detects ?code= or #access_token= in the URL
    // and exchanges it for a session (PKCE verifier is in localStorage).
    // We just need to wait for the session to be established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session) {
            subscription.unsubscribe();
            window.location.href = "/";
          }
        }
      }
    );

    // Timeout fallback
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      window.location.href = "/auth?error=auth_failed";
    }, 8000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
