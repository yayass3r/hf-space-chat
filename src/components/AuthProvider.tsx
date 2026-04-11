"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured, isAdminEmail, checkProfilesTable } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: "Not initialized" }),
  signUp: async () => ({ error: "Not initialized" }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const updateAdminStatus = useCallback((user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Method 1: Check app_metadata.role (set via Auth Admin API)
    const appMetaRole = (user.app_metadata as Record<string, unknown>)?.role;
    if (appMetaRole === "admin") {
      setIsAdmin(true);
      return;
    }

    // Method 2: Check user_metadata.role
    const userMetaRole = (user.user_metadata as Record<string, unknown>)?.role;
    if (userMetaRole === "admin") {
      setIsAdmin(true);
      return;
    }

    // Method 3: Check email against admin emails list (env var + localStorage)
    if (isAdminEmail(user.email)) {
      setIsAdmin(true);
      return;
    }

    // Method 4: Check profiles table (if it exists)
    if (supabase && user.email) {
      checkProfilesTable().then((exists) => {
        if (exists) {
          supabase!.from("profiles").select("role").eq("id", user.id).single()
            .then(({ data }) => {
              if (data && data.role === "admin") {
                setIsAdmin(true);
              }
            });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => setLoading(false));
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        updateAdminStatus(s.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          updateAdminStatus(s.user);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [updateAdminStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
