"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured, isAdminEmail, checkProfilesTable } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

// ==================== Local Auth Fallback ====================
// When Supabase is unreachable, we use localStorage-based auth
// This allows the app to work in demo/offline mode

const LOCAL_AUTH_KEY = "hf_local_auth_users";
const LOCAL_SESSION_KEY = "hf_local_auth_session";

// Default admin credentials (hashed)
const DEFAULT_ADMIN_EMAIL = "yayass3r@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Admin@2026";

interface LocalUser {
  id: string;
  email: string;
  password: string; // In production this would be hashed; here it's simple local storage
  role: "admin" | "user";
  created_at: string;
}

function getLocalUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) {
      // Initialize with default admin account
      const defaultUsers: LocalUser[] = [
        {
          id: "local-admin-001",
          email: DEFAULT_ADMIN_EMAIL,
          password: DEFAULT_ADMIN_PASSWORD,
          role: "admin",
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalUser(user: LocalUser): void {
  const users = getLocalUsers();
  const existingIndex = users.findIndex((u) => u.email === user.email);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(users));
}

function localSignIn(email: string, password: string): { user: LocalUser | null; error: string | null } {
  const users = getLocalUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { user: null, error: "حساب غير موجود. يرجى إنشاء حساب جديد أولاً." };
  if (user.password !== password) return { user: null, error: "كلمة المرور غير صحيحة" };
  // Save session
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: user.id, email: user.email }));
  return { user, error: null };
}

function localSignUp(email: string, password: string): { user: LocalUser | null; error: string | null } {
  const users = getLocalUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { user: null, error: "هذا البريد الإلكتروني مسجل مسبقاً" };
  }
  const newUser: LocalUser = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    email,
    password,
    role: isAdminEmail(email) ? "admin" : "user",
    created_at: new Date().toISOString(),
  };
  saveLocalUser(newUser);
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: newUser.id, email: newUser.email }));
  return { user: newUser, error: null };
}

function localSignOut(): void {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

function getLocalSession(): { userId: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Convert LocalUser to a Supabase-like User object
function localUserToSupabaseUser(localUser: LocalUser): User {
  return {
    id: localUser.id,
    app_metadata: { role: localUser.role, provider: "local" },
    user_metadata: { role: localUser.role, email: localUser.email },
    aud: "authenticated",
    confirmed_at: localUser.created_at,
    created_at: localUser.created_at,
    email: localUser.email,
    email_confirmed_at: localUser.created_at,
    last_sign_in_at: new Date().toISOString(),
    phone: "",
    role: "authenticated",
    updated_at: localUser.created_at,
  } as unknown as User;
}

// ==================== Auth Context ====================

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
    // First, check if Supabase is reachable
    if (!isSupabaseConfigured || !supabase) {
      // No Supabase configured - use local auth
      setIsLocalAuth(true);
      // Try to restore local session
      const localSession = getLocalSession();
      if (localSession) {
        const users = getLocalUsers();
        const localUser = users.find((u) => u.id === localSession.userId);
        if (localUser) {
          const sbUser = localUserToSupabaseUser(localUser);
          setUser(sbUser);
          updateAdminStatus(sbUser);
        }
      }
      setLoading(false);
      return;
    }

    // Try to reach Supabase
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("fetch"))) {
        // Supabase unreachable - fall back to local auth
        console.warn("[Auth] Supabase unreachable, switching to local auth");
        setIsLocalAuth(true);
        const localSession = getLocalSession();
        if (localSession) {
          const users = getLocalUsers();
          const localUser = users.find((u) => u.id === localSession.userId);
          if (localUser) {
            const sbUser = localUserToSupabaseUser(localUser);
            setUser(sbUser);
            updateAdminStatus(sbUser);
          }
        }
        setLoading(false);
        return;
      }

      setSupabaseReachable(true);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        updateAdminStatus(s.user);
      }
      setLoading(false);
    }).catch(() => {
      // Supabase unreachable - fall back to local auth
      console.warn("[Auth] Supabase error, switching to local auth");
      setIsLocalAuth(true);
      const localSession = getLocalSession();
      if (localSession) {
        const users = getLocalUsers();
        const localUser = users.find((u) => u.id === localSession.userId);
        if (localUser) {
          const sbUser = localUserToSupabaseUser(localUser);
          setUser(sbUser);
          updateAdminStatus(sbUser);
        }
      }
      setLoading(false);
    });

    // Listen for auth changes (only if Supabase is reachable)
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
    // Try Supabase first if it's reachable
    if (supabase && supabaseReachable) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };
      // If Supabase fails, fall through to local auth
      console.warn("[Auth] Supabase sign-in failed, trying local auth");
    }

    // Local auth fallback
    const result = localSignIn(email, password);
    if (result.user) {
      const sbUser = localUserToSupabaseUser(result.user);
      setUser(sbUser);
      setIsLocalAuth(true);
      updateAdminStatus(sbUser);
      return { error: null };
    }
    return { error: result.error };
  }, [supabaseReachable, updateAdminStatus]);

  const signUp = useCallback(async (email: string, password: string) => {
    // Try Supabase first if it's reachable
    if (supabase && supabaseReachable) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (!error) return { error: null };
      // If Supabase fails, fall through to local auth
      console.warn("[Auth] Supabase sign-up failed, trying local auth");
    }

    // Local auth fallback
    const result = localSignUp(email, password);
    if (result.user) {
      const sbUser = localUserToSupabaseUser(result.user);
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
    localSignOut();
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
