"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

interface AuthState { user: User | null; loading: boolean; error: string | null; cloudEnabled: boolean; signIn: (email: string) => Promise<void>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudEnabled = hasSupabaseConfig();
  const supabase = useMemo(() => cloudEnabled ? createClient() : null, [cloudEnabled]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setUser(data.user);
      setError(authError ? "Couldn’t check your sign-in status. Cloud data may be unavailable until you reconnect." : null);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setError("Couldn’t check your sign-in status. Cloud data may be unavailable until you reconnect.");
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
    user, loading, error, cloudEnabled,
    signIn: async (email) => {
      if (!supabase) throw new Error("Cloud sign-in is not configured. You can keep using Splitzy in guest mode.");
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    },
    signOut: async () => { if (!supabase) return; const { error } = await supabase.auth.signOut(); if (error) throw error; },
  }), [user, loading, error, cloudEnabled, supabase]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
