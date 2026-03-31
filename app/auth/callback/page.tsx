"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const handled = useRef(false);
  const [debug, setDebug] = useState<string[]>([]);

  const log = (msg: string) => {
    setDebug(prev => [...prev, msg]);
    console.log("[auth-callback]", msg);
  };

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const url = window.location.href;
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get("code");
    const hashParams = urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)) : null;
    const accessToken = hashParams?.get("access_token");

    log(`URL params: code=${code ? "yes" : "no"}, hash_token=${accessToken ? "yes" : "no"}`);
    log(`Full URL: ${url.substring(0, 120)}...`);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        log(`Auth event: ${event}, session=${session ? "yes" : "no"}`);
        if (session) {
          log("Session established! Redirecting...");
          subscription.unsubscribe();
          window.location.href = "/";
        }
      }
    );

    // If there's a code, try exchanging it manually
    if (code) {
      log("Attempting code exchange...");
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          log(`Exchange error: ${error.message}`);
        } else if (data.session) {
          log("Exchange success! Redirecting...");
          window.location.href = "/";
        }
      });
    }

    // Also check if session already exists
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        log(`getSession check: session=${session ? "yes" : "no"}`);
        if (session) {
          window.location.href = "/";
        }
      });
    }, 2000);

    // Timeout - show debug info instead of redirecting
    const timeout = setTimeout(() => {
      log("Timed out after 10s. Debug info above.");
    }, 10000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm mb-4">Signing you in...</p>
        {debug.length > 0 && (
          <div className="text-left bg-card border border-border rounded-lg p-4 mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Debug log:</p>
            {debug.map((msg, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono break-all">{msg}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
