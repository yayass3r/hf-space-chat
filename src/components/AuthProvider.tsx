"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured, isAdminEmail } from "@/lib/supabase";
import { localAuth, localProfiles, isLocalDBReady } from "@/lib/localdb";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isLocalAuth: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: "Not initialized" }),
  signUp: async () => ({ error: "Not initialized" }),
  signOut: async () => {},
  isLocalAuth: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLocalAuth, setIsLocalAuth] = useState(false);
  const [supabaseReachable, setSupabaseReachable] = useState<boolean | null>(null);

  const updateAdminStatus = useCallback((user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Check app_metadata.role
    const appMetaRole = (user.app_metadata as Record<string, unknown>)?.role;
    if (appMetaRole === "admin") {
      setIsAdmin(true);
      return;
    }

    // Check user_metadata.role
    const userMetaRole = (user.user_metadata as Record<string, unknown>)?.role;
    if (userMetaRole === "admin") {
      setIsAdmin(true);
      return;
    }

    // Check email against admin emails list
    if (isAdminEmail(user.email)) {
      setIsAdmin(true);
      return;
    }

    setIsAdmin(false);
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    async function initAuth() {
      // First try LocalDB (always available)
      const localSession = localAuth.getSession();
      if (localSession) {
        const localUser = localAuth.getUser(localSession.userId);
        if (localUser) {
          const sbUser = localAuth.toSupabaseUser(localUser);
          setUser(sbUser);
          updateAdminStatus(sbUser);
          localProfiles.updateLastSeen(localUser.id);
          setIsLocalAuth(true);
          setLoading(false);

          // Try Supabase in background for sync (non-blocking)
          if (supabase && isSupabaseConfigured) {
            try {
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                setSupabaseReachable(true);
                setSession(data.session);
              }
            } catch {
              setSupabaseReachable(false);
            }
          }
          return;
        }
      }

      // No local session - try Supabase
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: { session: sbSession }, error } = await supabase.auth.getSession();
          if (error || !sbSession) {
            // Supabase not reachable or no session
            setSupabaseReachable(false);
            setIsLocalAuth(true);
            setLoading(false);
            return;
          }
          setSupabaseReachable(true);
          setSession(sbSession);
          setUser(sbSession.user);
          updateAdminStatus(sbSession.user);

          // Also create local session for offline use
          const localProfile = localProfiles.getByEmail(sbSession.user.email || "");
          if (localProfile) {
            writeJSON("hf_db_auth_session", { userId: localProfile.id, email: localProfile.email, timestamp: Date.now() });
          }

          setLoading(false);

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
        } catch {
          setSupabaseReachable(false);
        }
      }

      // No Supabase and no local session
      setIsLocalAuth(true);
      setLoading(false);
    }

    initAuth();
  }, [updateAdminStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Try Supabase first if it was reachable before
    if (supabase && supabaseReachable) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          // Also create/update local session
          const localResult = localAuth.signUp(email, password);
          if (localResult.user) {
            // Update local auth user if not exists
          }
          return { error: null };
        }
      } catch {
        // Supabase failed, try local
      }
    }

    // Use LocalDB
    const result = localAuth.signIn(email, password);
    if (result.user) {
      const sbUser = localAuth.toSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      updateAdminStatus(sbUser);
      localProfiles.updateLastSeen(result.user.id);
      return { error: null };
    }
    return { error: result.error };
  }, [supabaseReachable, updateAdminStatus]);

  const signUp = useCallback(async (email: string, password: string) => {
    // Try Supabase first if it was reachable before
    if (supabase && supabaseReachable) {
      try {
        const { error } = await supabase.auth.signUp({ email, password });
        if (!error) return { error: null };
      } catch {
        // Supabase failed, try local
      }
    }

    // Use LocalDB
    const result = localAuth.signUp(email, password);
    if (result.user) {
      const sbUser = localAuth.toSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      updateAdminStatus(sbUser);
      return { error: null };
    }
    return { error: result.error };
  }, [supabaseReachable, updateAdminStatus]);

  const signOut = useCallback(async () => {
    if (supabase && supabaseReachable) {
      try { await supabase.auth.signOut(); } catch {}
    }
    localAuth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  }, [supabaseReachable]);

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut, isLocalAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper to write JSON (avoiding circular dependency)
function writeJSON(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}
