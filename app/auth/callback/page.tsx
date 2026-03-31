"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const handled = useRef(false);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    console.log("[auth-callback]", msg);
  };

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function handleCallback() {
      const url = new URL(window.location.href);
      log(`hash present: ${url.hash.length > 1 ? "yes" : "no"}`);

      // Check for hash tokens (implicit flow)
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        log(`access_token: ${accessToken ? accessToken.substring(0, 20) + "..." : "missing"}`);
        log(`refresh_token: ${refreshToken ? refreshToken.substring(0, 20) + "..." : "missing"}`);

        if (accessToken && refreshToken) {
          log("Calling setSession...");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && data.session) {
            log("setSession SUCCESS - redirecting");
            window.location.href = "/";
            return;
          }
          log(`setSession FAILED: ${error?.message || "no session returned"}`);
        } else {
          log("Missing access_token or refresh_token in hash");
        }
      }

      // Check for authorization code (PKCE flow)
      const code = url.searchParams.get("code");
      if (code) {
        log("Found ?code=, attempting exchange...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          log("Code exchange SUCCESS - redirecting");
          window.location.href = "/";
          return;
        }
        log(`Code exchange FAILED: ${error.message}`);
      }

      // Check if session already exists
      const { data: { session } } = await supabase.auth.getSession();
      log(`Existing session: ${session ? "yes" : "no"}`);
      if (session) {
        window.location.href = "/";
        return;
      }

      log("All methods failed. Staying on page for debug.");
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg w-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm mb-4">Signing you in...</p>
        {logs.length > 0 && (
          <div className="text-left bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Debug:</p>
            {logs.map((msg, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono break-all">{msg}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
