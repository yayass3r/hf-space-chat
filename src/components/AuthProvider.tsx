"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured, isAdminEmail } from "@/lib/supabase";
import { localAuth, localProfiles, isLocalDBReady } from "@/lib/localdb";
import { appwriteAuth, checkAppwriteConnection, getIsAppwriteConfigured } from "@/lib/appwrite";
import type { User, Session } from "@supabase/supabase-js";

type AuthSource = "supabase" | "appwrite" | "local";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isLocalAuth: boolean;
  authSource: AuthSource;
  appwriteConnected: boolean | null;
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
  authSource: "local",
  appwriteConnected: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLocalAuth, setIsLocalAuth] = useState(false);
  const [supabaseReachable, setSupabaseReachable] = useState<boolean | null>(null);
  const [appwriteConnected, setAppwriteConnected] = useState<boolean | null>(null);
  const [authSource, setAuthSource] = useState<AuthSource>("local");

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

  // Try to restore session on mount - PRIORITY: Supabase → Appwrite → LocalDB
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      // Check Appwrite connection status
      if (getIsAppwriteConfigured()) {
        const awConnected = await checkAppwriteConnection();
        if (!cancelled) setAppwriteConnected(awConnected);
      }

      // Step 1: Try Supabase first (primary auth source)
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: { session: sbSession }, error } = await supabase.auth.getSession();

          if (cancelled) return;

          if (!error && sbSession) {
            // Supabase session found - use it
            setSupabaseReachable(true);
            setSession(sbSession);
            setUser(sbSession.user);
            updateAdminStatus(sbSession.user);
            setIsLocalAuth(false);
            setAuthSource("supabase");

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
                if (cancelled) return;
                setSession(s);
                setUser(s?.user ?? null);
                if (s?.user) {
                  updateAdminStatus(s.user);
                  syncToLocalStorage(s.user);
                  setAuthSource("supabase");
                } else {
                  setIsAdmin(false);
                }
                setLoading(false);
              }
            );

            subscriptionRef.current = subscription;
            return;
          }

          // No Supabase session but Supabase is reachable
          setSupabaseReachable(true);
        } catch {
          if (cancelled) return;
          setSupabaseReachable(false);
        }
      }

      // Step 2: Try Appwrite session (secondary auth source)
      if (getIsAppwriteConfigured()) {
        try {
          const awUser = await appwriteAuth.getSession();
          if (awUser && !cancelled) {
            // Convert Appwrite user to Supabase-compatible User object
            const sbUser = appwriteToSupabaseUser(awUser);
            setUser(sbUser);
            updateAdminStatus(sbUser);
            setIsLocalAuth(false);
            setAuthSource("appwrite");
            setLoading(false);
            return;
          }
        } catch {
          // Appwrite session not available, continue to LocalDB
        }
      }

      // Step 3: Try LocalDB session (fallback)
      const localSession = localAuth.getSession();
      if (localSession) {
        const localUser = localAuth.getUser(localSession.userId);
        if (localUser) {
          const sbUser = localAuth.toSupabaseUser(localUser);
          setUser(sbUser);
          updateAdminStatus(sbUser);
          localProfiles.updateLastSeen(localUser.id);
          setIsLocalAuth(true);
          setAuthSource("local");
          setLoading(false);
          return;
        }
      }

      // Step 4: No session found anywhere
      setIsLocalAuth(false);
      setAuthSource("local");
      setLoading(false);
    }

    initAuth();

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [updateAdminStatus]);

  // Helper: convert Appwrite user to Supabase-compatible User
  const appwriteToSupabaseUser = (awUser: { id: string; email: string; name: string; role: string; created_at: string; provider: string }): User => {
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
      .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdminUser = adminEmails.includes(awUser.email.toLowerCase());

    return {
      id: awUser.id,
      app_metadata: { role: isAdminUser ? "admin" : awUser.role, provider: "appwrite" },
      user_metadata: { role: isAdminUser ? "admin" : awUser.role, email: awUser.email, full_name: awUser.name },
      aud: "authenticated",
      confirmed_at: awUser.created_at,
      created_at: awUser.created_at,
      email: awUser.email,
      email_confirmed_at: awUser.created_at,
      last_sign_in_at: new Date().toISOString(),
      phone: "",
      role: "authenticated",
      updated_at: awUser.created_at,
    } as unknown as User;
  };

  // Helper: sync Supabase user to LocalDB for offline access
  const syncToLocalStorage = (sbUser: User) => {
    try {
      const localProfile = localProfiles.getByEmail(sbUser.email || "");
      if (!localProfile) {
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
          .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
        const isAdminUser = adminEmails.includes((sbUser.email || "").toLowerCase()) ||
          (sbUser.app_metadata as Record<string, unknown>)?.role === "admin";

        const users = JSON.parse(localStorage.getItem("hf_db_auth_users") || "[]");
        if (!users.find((u: { email: string }) => u.email === (sbUser.email || "").toLowerCase())) {
          users.push({
            id: sbUser.id,
            email: sbUser.email,
            password: "",
            role: isAdminUser ? "admin" : "user",
            created_at: sbUser.created_at,
          });
          localStorage.setItem("hf_db_auth_users", JSON.stringify(users));
        }
      }

      localStorage.setItem("hf_db_auth_session", JSON.stringify({
        userId: sbUser.id,
        email: sbUser.email,
        timestamp: Date.now(),
        source: authSource
      }));
    } catch {}
  };

  const signIn = useCallback(async (email: string, password: string) => {
    // Step 1: Try Supabase first
    if (supabase && isSupabaseConfigured) {
      try {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          setSupabaseReachable(true);
          setIsLocalAuth(false);
          setAuthSource("supabase");
          if (data.user) {
            syncToLocalStorage(data.user);
          }
          return { error: null };
        }
        setSupabaseReachable(true);

        if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
          setSupabaseReachable(false);
          // Fall through to Appwrite
        } else {
          const msg = error.message;
          if (msg.includes("Invalid login credentials")) {
            // Try Appwrite before giving up
            // Fall through to Appwrite
          } else {
            return { error: msg };
          }
        }
      } catch {
        setSupabaseReachable(false);
        // Fall through to Appwrite
      }
    }

    // Step 2: Try Appwrite
    if (getIsAppwriteConfigured()) {
      try {
        const result = await appwriteAuth.signIn(email, password);
        if (result.user) {
          const sbUser = appwriteToSupabaseUser(result.user);
          setUser(sbUser);
          updateAdminStatus(sbUser);
          setIsLocalAuth(false);
          setAuthSource("appwrite");
          setAppwriteConnected(true);
          return { error: null };
        }
        // Appwrite auth failed with non-network error - fall through to local
        if (!result.error?.includes("غير متاح")) {
          // Appwrite was reachable but credentials wrong - still try local as fallback
        }
      } catch {
        setAppwriteConnected(false);
      }
    }

    // Step 3: Use LocalDB (offline fallback)
    const result = localAuth.signIn(email, password);
    if (result.user) {
      const sbUser = localAuth.toSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      setAuthSource("local");
      updateAdminStatus(sbUser);
      localProfiles.updateLastSeen(result.user.id);
      return { error: null };
    }
    return { error: result.error };
  }, [updateAdminStatus, authSource]);

  const signUp = useCallback(async (email: string, password: string) => {
    // Step 1: Try Supabase first
    if (supabase && isSupabaseConfigured) {
      try {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (!error) {
          setSupabaseReachable(true);
          setIsLocalAuth(false);
          setAuthSource("supabase");
          if (data.user) {
            syncToLocalStorage(data.user);
          }
          return { error: null };
        }
        setSupabaseReachable(true);

        if (error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("Failed to fetch")) {
          setSupabaseReachable(false);
        } else {
          const msg = error.message;
          if (msg.includes("already registered") || msg.includes("User already registered")) {
            // Try Appwrite
          } else {
            return { error: msg };
          }
        }
      } catch {
        setSupabaseReachable(false);
      }
    }

    // Step 2: Try Appwrite
    if (getIsAppwriteConfigured()) {
      try {
        const result = await appwriteAuth.signUp(email, password, email.split("@")[0]);
        if (result.user) {
          const sbUser = appwriteToSupabaseUser(result.user);
          setUser(sbUser);
          updateAdminStatus(sbUser);
          setIsLocalAuth(false);
          setAuthSource("appwrite");
          setAppwriteConnected(true);
          return { error: null };
        }
      } catch {
        setAppwriteConnected(false);
      }
    }

    // Step 3: Use LocalDB (offline fallback)
    const result = localAuth.signUp(email, password);
    if (result.user) {
      const sbUser = localAuth.toSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      setAuthSource("local");
      updateAdminStatus(sbUser);
      return { error: null };
    }
    return { error: result.error };
  }, [updateAdminStatus, authSource]);

  const signOut = useCallback(async () => {
    // Sign out from all providers
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    try { await appwriteAuth.signOut(); } catch {}
    localAuth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setAuthSource("local");
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut, isLocalAuth, authSource, appwriteConnected }}>
      {children}
    </AuthContext.Provider>
  );
}
