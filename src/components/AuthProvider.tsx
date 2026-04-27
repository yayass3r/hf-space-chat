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

  // Try to restore session on mount - PRIORITY: Supabase first, LocalDB second
  useEffect(() => {
    async function initAuth() {
      // Step 1: Try Supabase first (primary auth source)
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: { session: sbSession }, error } = await supabase.auth.getSession();
          
          if (!error && sbSession) {
            // Supabase session found - use it
            setSupabaseReachable(true);
            setSession(sbSession);
            setUser(sbSession.user);
            updateAdminStatus(sbSession.user);
            setIsLocalAuth(false);
            
            // Sync to LocalDB for offline use
            syncToLocalStorage(sbSession.user);
            
            // Update last seen in local profile
            const localProfile = localProfiles.getByEmail(sbSession.user.email || "");
            if (localProfile) {
              localProfiles.updateLastSeen(localProfile.id);
            }
            
            setLoading(false);
            
            // Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
              async (_event, s) => {
                setSession(s);
                setUser(s?.user ?? null);
                if (s?.user) {
                  updateAdminStatus(s.user);
                  syncToLocalStorage(s.user);
                } else {
                  setIsAdmin(false);
                }
                setLoading(false);
              }
            );
            
            return () => subscription.unsubscribe();
          }
          
          // No Supabase session but Supabase is reachable
          setSupabaseReachable(true);
        } catch {
          // Supabase unreachable - will try LocalDB
          setSupabaseReachable(false);
        }
      }

      // Step 2: Try LocalDB session (fallback)
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
          return;
        }
      }

      // Step 3: No session found anywhere
      setIsLocalAuth(!supabaseReachable);
      setLoading(false);
    }

    initAuth();
  }, [updateAdminStatus]);

  // Helper: sync Supabase user to LocalDB for offline access
  const syncToLocalStorage = (sbUser: User) => {
    try {
      // Ensure local profile exists
      const localProfile = localProfiles.getByEmail(sbUser.email || "");
      if (!localProfile) {
        // Create local profile from Supabase user
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
          .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
        const isAdminUser = adminEmails.includes((sbUser.email || "").toLowerCase()) ||
          (sbUser.app_metadata as Record<string, unknown>)?.role === "admin";
        
        // Create local auth user for offline sign-in
        const users = JSON.parse(localStorage.getItem("hf_db_auth_users") || "[]");
        if (!users.find((u: { email: string }) => u.email === (sbUser.email || "").toLowerCase())) {
          users.push({
            id: sbUser.id,
            email: sbUser.email,
            password: "", // No offline password unless user sets one
            role: isAdminUser ? "admin" : "user",
            created_at: sbUser.created_at,
          });
          localStorage.setItem("hf_db_auth_users", JSON.stringify(users));
        }
      }
      
      // Save session reference
      localStorage.setItem("hf_db_auth_session", JSON.stringify({
        userId: sbUser.id,
        email: sbUser.email,
        timestamp: Date.now(),
        source: "supabase"
      }));
    } catch {}
  };

  const signIn = useCallback(async (email: string, password: string) => {
    // Always try Supabase first
    if (supabase && isSupabaseConfigured) {
      try {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          setSupabaseReachable(true);
          setIsLocalAuth(false);
          // Sync to local for offline access
          if (data.user) {
            syncToLocalStorage(data.user);
          }
          return { error: null };
        }
        // If Supabase returned an error, check if it's reachable
        // Auth errors (wrong password, user not found) still mean Supabase is reachable
        setSupabaseReachable(true);
        
        // Only fall back to local if the error is a network/connection error
        if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
          setSupabaseReachable(false);
          // Fall through to local auth
        } else {
          // Supabase auth error (wrong password, etc.) - don't fall back to local
          const msg = error.message;
          if (msg.includes("Invalid login credentials")) {
            return { error: "بيانات الدخول غير صحيحة" };
          }
          return { error: msg };
        }
      } catch {
        setSupabaseReachable(false);
        // Fall through to local auth
      }
    }

    // Use LocalDB (offline fallback)
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
  }, [updateAdminStatus]);

  const signUp = useCallback(async (email: string, password: string) => {
    // Always try Supabase first
    if (supabase && isSupabaseConfigured) {
      try {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (!error) {
          setSupabaseReachable(true);
          setIsLocalAuth(false);
          if (data.user) {
            syncToLocalStorage(data.user);
          }
          return { error: null };
        }
        setSupabaseReachable(true);
        
        // Only fall back to local for network errors
        if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
          setSupabaseReachable(false);
        } else {
          const msg = error.message;
          if (msg.includes("already registered") || msg.includes("User already registered")) {
            return { error: "هذا البريد الإلكتروني مسجل مسبقاً" };
          }
          return { error: msg };
        }
      } catch {
        setSupabaseReachable(false);
      }
    }

    // Use LocalDB (offline fallback)
    const result = localAuth.signUp(email, password);
    if (result.user) {
      const sbUser = localAuth.toSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      updateAdminStatus(sbUser);
      return { error: null };
    }
    return { error: result.error };
  }, [updateAdminStatus]);

  const signOut = useCallback(async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    localAuth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut, isLocalAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
