"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const handled = useRef(false);
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function handleCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get("access_token");

        if (code) {
          // Supabase returned an authorization code — exchange it
          setStatus("Exchanging authorization code...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Code exchange failed:", error.message, error);
            setStatus(`Code exchange failed: ${error.message}`);
            setTimeout(() => { window.location.href = "/auth?error=auth_failed"; }, 2000);
            return;
          }
          if (data.session) {
            window.location.href = "/";
            return;
          }
        }

        if (accessToken) {
          // Implicit flow — tokens in hash, let the client detect them
          setStatus("Processing tokens...");
          // Wait for onAuthStateChange to fire
          await new Promise<void>((resolve) => {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
              if (session) {
                subscription.unsubscribe();
                resolve();
              }
            });
            // Also try getSession as fallback
            setTimeout(async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) { subscription.unsubscribe(); resolve(); }
            }, 1000);
          });
          window.location.href = "/";
          return;
        }

        // No code or tokens — check if session already exists (e.g. from auto-detection)
        setStatus("Checking session...");
        // Give the supabase client time to auto-detect
        await new Promise(r => setTimeout(r, 1500));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = "/";
          return;
        }

        setStatus("No session found. Redirecting...");
        setTimeout(() => { window.location.href = "/auth?error=auth_failed"; }, 1000);

      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("Something went wrong. Redirecting...");
        setTimeout(() => { window.location.href = "/auth?error=auth_failed"; }, 2000);
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">{status}</p>
      </div>
    </div>
  );
}
