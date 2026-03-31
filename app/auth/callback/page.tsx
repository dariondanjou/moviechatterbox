"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function handleCallback() {
      const url = new URL(window.location.href);

      // Hash tokens (implicit flow) — extract and set session manually
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            window.location.href = "/";
            return;
          }
        }
      }

      // Authorization code (PKCE flow)
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          window.location.href = "/";
          return;
        }
      }

      // Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.href = "/";
        return;
      }

      window.location.href = "/auth?error=auth_failed";
    }

    handleCallback();
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
