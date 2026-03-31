"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Handle the OAuth redirect — extract tokens from URL hash
    // and establish the session before navigating to home
    const handleAuth = async () => {
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } else {
        // Might be PKCE flow with code in query params
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }

      router.replace("/");
    };

    handleAuth();
  }, [router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
