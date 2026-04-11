"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: "Not initialized" }),
  signUp: async () => ({ error: "Not initialized" }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    if (!supabase) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist yet, create it
        const newProfile = {
          id: userId,
          email: userEmail || "",
          role: "user" as const,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (!insertError && inserted) {
          setProfile(inserted as UserProfile);

          // Check if this email is in admin_emails setting
          await checkAdminFromSettings(userId, userEmail);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      } else if (data) {
        setProfile(data as UserProfile);
        setIsAdmin((data as UserProfile).role === "admin");
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    } catch {
      setProfile(null);
      setIsAdmin(false);
    }
  }, []);

  const checkAdminFromSettings = useCallback(async (userId: string, email?: string) => {
    if (!supabase || !email) return;

    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "admin_emails")
        .single();

      if (data?.value) {
        const adminEmails = data.value.split(",").map((e: string) => e.trim().toLowerCase());
        if (adminEmails.includes(email.toLowerCase())) {
          // Promote this user to admin
          await supabase
            .from("profiles")
            .update({ role: "admin" })
            .eq("id", userId);
          setIsAdmin(true);
          // Refresh profile
          await fetchProfile(userId, email);
        }
      }
    } catch {
      // Silently fail
    }
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id, s.user.email);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id, s.user.email);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, checkAdminFromSettings]);

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
    setProfile(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
