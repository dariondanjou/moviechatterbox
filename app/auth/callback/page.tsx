"use client";

import { useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get("code");

    if (code) {
      // Exchange the auth code client-side where the PKCE code verifier is accessible
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("OAuth code exchange failed:", error.message);
          window.location.href = "/auth?error=auth_failed";
        } else {
          // Full reload ensures AuthProvider picks up the new session
          window.location.href = "/";
        }
      });
    } else {
      // No code param — check if detectSessionInUrl already handled it
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          window.location.href = "/";
        } else {
          window.location.href = "/auth?error=auth_failed";
        }
      });
    }
  }, [searchParams]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
