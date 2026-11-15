"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getAuthStatusMessage } from "@/lib/auth/auth-status";

interface AuthState { user: User | null; loading: boolean; error: string | null; getAccessToken: () => Promise<string | null>; signIn: (email: string) => Promise<void>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthState | null>(null);

export class AuthSessionInvalidError extends Error {
  constructor() { super("The saved sign-in session is expired or invalid."); this.name = "AuthSessionInvalidError"; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    // getSession reads the browser's persisted session and refreshes it when
    // needed. getUser() without a token treats a normal signed-out browser as
    // AuthSessionMissingError, which should not be shown as a service outage.
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setError(authError ? getAuthStatusMessage(authError) : null);
      setLoading(false);
    }).catch((authError: unknown) => {
      if (!active) return;
      setUser(null);
      setError(getAuthStatusMessage(authError));
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setError(null);
      setLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);
  const value = useMemo<AuthState>(() => ({
    user, loading, error,
    getAccessToken: async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) return null;

      const { data: verified, error: verifyError } = await supabase.auth.getUser(data.session.access_token);
      if (!verifyError && verified.user) return data.session.access_token;

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        const status = "status" in refreshError ? refreshError.status : undefined;
        if (status === 400 || status === 401) throw new AuthSessionInvalidError();
        throw refreshError;
      }
      if (!refreshed.session) throw new AuthSessionInvalidError();

      const { data: refreshedUser, error: refreshedVerifyError } = await supabase.auth.getUser(refreshed.session.access_token);
      if (refreshedVerifyError || !refreshedUser.user) throw new AuthSessionInvalidError();
      return refreshed.session.access_token;
    },
    signIn: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    },
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; },
  }), [user, loading, error, supabase]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
