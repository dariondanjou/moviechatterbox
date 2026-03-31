"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    // With implicit flow, detectSessionInUrl automatically processes
    // the access_token and refresh_token from the URL hash.
    // We listen for the auth state change to know when it's done.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Session established — full reload to update all components
          window.location.href = "/";
        }
      }
    );

    // Fallback: if already authenticated (session from cookies), redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/";
      }
    });

    // Timeout fallback — if nothing happens after 5s, something went wrong
    const timeout = setTimeout(() => {
      window.location.href = "/auth?error=auth_failed";
    }, 5000);

    return () => {
      subscription.unsubscribe();
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
