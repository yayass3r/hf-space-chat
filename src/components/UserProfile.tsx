"use client";

import React, { useState, useEffect, useCallback, startTransition } from "react";
import { useAuth } from "./AuthProvider";
import { supabase, checkProfilesTable } from "@/lib/supabase";
import type { UserProfile, UserActivityStats } from "@/lib/types";

// ==================== AVATAR COMPONENT ====================
function UserAvatar({
  profile,
  size = "lg",
  className = "",
}: {
  profile: UserProfile | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-20 h-20 text-2xl",
    xl: "w-28 h-28 text-3xl",
  };

  const initial = profile?.display_name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || "?";

  // Gradient colors based on email hash for consistent colors per user
  const getGradient = (email: string) => {
    const gradients = [
      "from-orange-500 to-yellow-400",
      "from-violet-500 to-purple-600",
      "from-emerald-500 to-teal-400",
      "from-blue-500 to-cyan-400",
      "from-pink-500 to-rose-400",
      "from-indigo-500 to-blue-400",
      "from-red-500 to-orange-400",
      "from-teal-500 to-green-400",
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
    <img
        src={profile.avatar_url}
        alt={profile.display_name || profile.email}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
    />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${getGradient(profile?.email || "")} flex items-center justify-center text-white font-bold shadow-lg ${sizeClasses[size]} ${className}`}
    >
      {initial}
    </div>
  );
}

// ==================== STAT CARD ====================
function StatCard({
  icon,
  label,
  value,
  color = "orange",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: "orange" | "violet" | "emerald" | "blue";
}) {
  const colorMap = {
    orange: "from-orange-500 to-yellow-400 shadow-orange-500/20",
    violet: "from-violet-500 to-purple-600 shadow-violet-500/20",
    emerald: "from-emerald-500 to-teal-400 shadow-emerald-500/20",
    blue: "from-blue-500 to-cyan-400 shadow-blue-500/20",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white shadow-lg`}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

// ==================== MAIN USER PROFILE COMPONENT ====================
export default function UserProfile({ onClose }: { onClose: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserActivityStats>({
    totalSessions: 0,
    totalMessages: 0,
    todayMessages: 0,
    streak: 0,
    joinedDaysAgo: 0,
    lastActive: "",
  });
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "activity" | "settings">("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    display_name: "",
    avatar_url: "",
    bio: "",
    phone: "",
    website: "",
    location: "",
  });

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    language_preference: "ar",
    theme_preference: "system",
    notifications_enabled: true,
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Load profile data
  const loadProfile = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const profilesTableExists = await checkProfilesTable();
      if (!profilesTableExists) {
        // Fallback: create minimal profile from auth data
        setProfile({
          id: user.id,
          email: user.email || "",
          role: isAdmin ? "admin" : "user",
          display_name: user.email?.split("@")[0] || "",
          avatar_url: "",
          bio: "",
          phone: "",
          website: "",
          location: "",
          language_preference: "ar",
          theme_preference: "system",
          notifications_enabled: true,
          last_seen: new Date().toISOString(),
          created_at: user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (err) {
        console.error("Load profile error:", err);
        setProfile({
          id: user.id,
          email: user.email || "",
          role: isAdmin ? "admin" : "user",
          display_name: user.email?.split("@")[0] || "",
          avatar_url: "",
          bio: "",
          phone: "",
          website: "",
          location: "",
          language_preference: "ar",
          theme_preference: "system",
          notifications_enabled: true,
          last_seen: new Date().toISOString(),
          created_at: user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (data) {
        const p = data as UserProfile;
        setProfile(p);
        setEditForm({
          display_name: p.display_name || "",
          avatar_url: p.avatar_url || "",
          bio: p.bio || "",
          phone: p.phone || "",
          website: p.website || "",
          location: p.location || "",
        });
        setSettingsForm({
          language_preference: p.language_preference || "ar",
          theme_preference: p.theme_preference || "system",
          notifications_enabled: p.notifications_enabled ?? true,
        });
      }

      // Load activity stats
      try {
        const { count: sessionCount } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        const { count: messageCount } = await supabase
          .from("ai_chat_messages")
          .select("id, project_id, projects!inner(user_id)", { count: "exact", head: true });

        // Today's messages count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayMsgCount } = await supabase
          .from("ai_chat_messages")
          .select("id, project_id, projects!inner(user_id)", { count: "exact", head: true })
          .gte("created_at", today.toISOString());

        const createdAt = new Date(user.created_at || new Date());
        const joinedDaysAgo = Math.floor(
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        startTransition(() => {
          setStats({
            totalSessions: sessionCount || 0,
            totalMessages: messageCount || 0,
            todayMessages: todayMsgCount || 0,
            streak: 0,
            joinedDaysAgo,
            lastActive: data?.last_seen || new Date().toISOString(),
          });
        });
      } catch {}
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Update last_seen on mount
  useEffect(() => {
    if (supabase && user) {
      (async () => {
        try {
          const { error: rpcError } = await supabase.rpc("update_last_seen");
          if (rpcError) {
            // Fallback: direct update
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", user.id);
          }
        } catch {
          // Silently handle - last_seen update is non-critical
        }
      })();
    }
  }, [user]);

  // Save profile edits
  const saveProfile = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          display_name: editForm.display_name,
          avatar_url: editForm.avatar_url,
          bio: editForm.bio,
          phone: editForm.phone,
          website: editForm.website,
          location: editForm.location,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (err) {
        setError(err.message);
      } else {
        setSaveSuccess(true);
        startTransition(() => {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  display_name: editForm.display_name,
                  avatar_url: editForm.avatar_url,
                  bio: editForm.bio,
                  phone: editForm.phone,
                  website: editForm.website,
                  location: editForm.location,
                  updated_at: new Date().toISOString(),
                }
              : prev
          );
        });
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setError("حدث خطأ أثناء حفظ الملف الشخصي");
    } finally {
      setSaving(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          language_preference: settingsForm.language_preference,
          theme_preference: settingsForm.theme_preference,
          notifications_enabled: settingsForm.notifications_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (err) {
        setError(err.message);
      } else {
        setSaveSuccess(true);
        startTransition(() => {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  language_preference: settingsForm.language_preference,
                  theme_preference: settingsForm.theme_preference,
                  notifications_enabled: settingsForm.notifications_enabled,
                }
              : prev
          );
        });
        // Apply theme preference
        if (settingsForm.theme_preference !== "system") {
          const isDark = settingsForm.theme_preference === "dark";
          if (isDark) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("hf_theme", "dark");
          } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("hf_theme", "light");
          }
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setError("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const changePassword = async () => {
    if (!supabase) return;
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("كلمات المرور غير متطابقة");
      return;
    }

    try {
      const { error: err } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (err) {
        setPasswordError(err.message);
      } else {
        setPasswordSuccess(true);
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch {
      setPasswordError("حدث خطأ غير متوقع");
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "غير محدد";
    try {
      return new Date(dateStr).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return "الآن";
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "الآن";
      if (minutes < 60) return `منذ ${minutes} دقيقة`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `منذ ${hours} ساعة`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `منذ ${days} يوم`;
      const months = Math.floor(days / 30);
      return `منذ ${months} شهر`;
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-orange-500/20 animate-pulse">
            HF
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">جاري تحميل الملف الشخصي...</span>
          </div>
        </div>
      </div>
    );
  }

  // isDark is available for future use in profile UI
  const _isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
  void _isDark;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300" dir="rtl">
      {/* Cover/Header Section */}
      <div className="relative">
        {/* Cover gradient */}
        <div className="h-40 sm:h-48 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0tNCA0aC0ydi0yaDJ2MnptMCA0aC0ydi0yaDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          title="رجوع"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Avatar - overlapping cover and content */}
        <div className="absolute -bottom-14 right-6 sm:right-8">
          <div className="relative">
            <UserAvatar profile={profile} size="xl" className="ring-4 ring-white dark:ring-slate-900 shadow-xl" />
            {isAdmin && (
              <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-lg" title="مسؤول">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {profile?.display_name || profile?.email?.split("@")[0] || "مستخدم"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1" dir="ltr">
              {profile?.email}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                isAdmin
                  ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                {isAdmin ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" clipRule="evenodd" /></svg>
                    مسؤول
                  </>
                ) : "مستخدم"}
              </span>
              {profile?.location && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {profile.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                انضم منذ {stats.joinedDaysAgo} يوم
              </span>
            </div>
            {profile?.bio && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 max-w-lg leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("edit")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all"
            >
              تعديل الملف الشخصي
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            label="المحادثات"
            value={stats.totalSessions}
            color="orange"
          />
          <StatCard
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
            label="الرسائل"
            value={stats.totalMessages}
            color="violet"
          />
          <StatCard
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="رسائل اليوم"
            value={stats.todayMessages}
            color="emerald"
          />
          <StatCard
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            label="أيام النشاط"
            value={stats.joinedDaysAgo}
            color="blue"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8">
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: "overview" as const, label: "نظرة عامة", icon: "👤" },
            { id: "edit" as const, label: "تعديل الملف", icon: "✏️" },
            { id: "activity" as const, label: "النشاط", icon: "📊" },
            { id: "settings" as const, label: "الإعدادات", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-600 dark:text-orange-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {/* Personal Info Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">المعلومات الشخصية</h3>
              </div>
              <div className="p-6 space-y-4">
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                } label="الاسم المعروض" value={profile?.display_name || "غير محدد"} />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                } label="البريد الإلكتروني" value={profile?.email || ""} dir="ltr" />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                } label="الهاتف" value={profile?.phone || "غير محدد"} dir="ltr" />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                } label="الموقع الإلكتروني" value={profile?.website || "غير محدد"} dir="ltr" isLink={!!profile?.website} />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                } label="الموقع" value={profile?.location || "غير محدد"} />
              </div>
            </div>

            {/* Bio Card */}
            {profile?.bio && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">نبذة عني</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </div>
              </div>
            )}

            {/* Account Info Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">معلومات الحساب</h3>
              </div>
              <div className="p-6 space-y-4">
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                } label="الدور" value={isAdmin ? "مسؤول" : "مستخدم"} />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                } label="تاريخ الانضمام" value={formatDate(profile?.created_at || "")} />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                } label="آخر نشاط" value={formatRelativeTime(stats.lastActive)} />
                <InfoRow icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                } label="آخر تحديث" value={formatDate(profile?.updated_at || "")} />
              </div>
            </div>
          </div>
        )}

        {/* ==================== EDIT TAB ==================== */}
        {activeTab === "edit" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">تعديل الملف الشخصي</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">قم بتحديث معلوماتك الشخصية</p>
              </div>
              <div className="p-6 space-y-5">
                {/* Success/Error messages */}
                {saveSuccess && (
                  <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    تم حفظ التعديلات بنجاح
                  </div>
                )}
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}

                {/* Avatar preview + URL */}
                <div className="flex items-center gap-4">
                  <UserAvatar
                    profile={{
                      ...editForm,
                      id: user?.id || "",
                      email: user?.email || "",
                      role: profile?.role || "user",
                      bio: "",
                      phone: "",
                      website: "",
                      location: "",
                      language_preference: "ar",
                      theme_preference: "system",
                      notifications_enabled: true,
                      last_seen: "",
                      created_at: "",
                      updated_at: "",
                    }}
                    size="lg"
                    className="shadow-lg"
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">رابط الصورة الشخصية</label>
                    <input
                      type="url"
                      value={editForm.avatar_url}
                      onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                      dir="ltr"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">الاسم المعروض</label>
                  <input
                    type="text"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                    placeholder="أدخل اسمك المعروض"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">نبذة عني</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="اكتب نبذة مختصرة عنك..."
                    rows={3}
                    maxLength={300}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm resize-none"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{editForm.bio.length}/300</p>
                </div>

                {/* Phone & Website */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="+966 5XX XXX XXX"
                      dir="ltr"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">الموقع الإلكتروني</label>
                    <input
                      type="url"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      placeholder="https://example.com"
                      dir="ltr"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">الموقع</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="مثال: الرياض، السعودية"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Save button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        جاري الحفظ...
                      </span>
                    ) : "حفظ التعديلات"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ACTIVITY TAB ==================== */}
        {activeTab === "activity" && (
          <div className="space-y-6 animate-fade-in">
            {/* Activity Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">ملخص النشاط</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <ActivityStat icon="💬" label="إجمالي المحادثات" value={stats.totalSessions} />
                  <ActivityStat icon="📝" label="إجمالي الرسائل" value={stats.totalMessages} />
                  <ActivityStat icon="📅" label="رسائل اليوم" value={stats.todayMessages} />
                  <ActivityStat icon="⏱️" label="أيام منذ الانضمام" value={stats.joinedDaysAgo} />
                  <ActivityStat icon="🔄" label="متوسط الرسائل/يوم" value={stats.joinedDaysAgo > 0 ? Math.round(stats.totalMessages / stats.joinedDaysAgo) : 0} />
                  <ActivityStat icon="📊" label="متوسط محادثات/يوم" value={stats.joinedDaysAgo > 0 ? (stats.totalSessions / stats.joinedDaysAgo).toFixed(1) : "0"} />
                </div>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">آخر المحادثات</h3>
              </div>
              <RecentSessions userId={user?.id || ""} />
            </div>

            {/* Account Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">الجدول الزمني</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <TimelineItem
                    icon="🆕"
                    title="إنشاء الحساب"
                    date={formatDate(profile?.created_at || "")}
                    description={`انضمام ${profile?.email || ""} إلى المنصة`}
                  />
                  <TimelineItem
                    icon="✏️"
                    title="آخر تحديث للملف الشخصي"
                    date={formatDate(profile?.updated_at || "")}
                    description="تحديث بيانات الملف الشخصي"
                  />
                  <TimelineItem
                    icon="🟢"
                    title="آخر نشاط"
                    date={formatRelativeTime(stats.lastActive)}
                    description="آخر مرة تم فيها تسجيل النشاط"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-fade-in">
            {/* Preferences */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">التفضيلات</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تخصيص تجربة الاستخدام</p>
              </div>
              <div className="p-6 space-y-5">
                {saveSuccess && (
                  <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    تم حفظ الإعدادات بنجاح
                  </div>
                )}
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">اللغة المفضلة</label>
                  <select
                    value={settingsForm.language_preference}
                    onChange={(e) => setSettingsForm({ ...settingsForm, language_preference: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">المظهر</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "light", label: "فاتح", icon: "☀️" },
                      { value: "dark", label: "مظلم", icon: "🌙" },
                      { value: "system", label: "تلقائي", icon: "💻" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSettingsForm({ ...settingsForm, theme_preference: option.value })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          settingsForm.theme_preference === option.value
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <span className="text-2xl">{option.icon}</span>
                        <span className={`text-xs font-medium ${
                          settingsForm.theme_preference === option.value
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">الإشعارات</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">تلقي إشعارات الأنشطة والتحديثات</p>
                  </div>
                  <button
                    onClick={() => setSettingsForm({ ...settingsForm, notifications_enabled: !settingsForm.notifications_enabled })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settingsForm.notifications_enabled
                        ? "bg-orange-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        settingsForm.notifications_enabled ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">تغيير كلمة المرور</h3>
              </div>
              <div className="p-6 space-y-4">
                {passwordSuccess && (
                  <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    تم تغيير كلمة المرور بنجاح
                  </div>
                )}
                {passwordError && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={changePassword}
                    disabled={!passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    تغيير كلمة المرور
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">منطقة الخطر</h3>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">تسجيل الخروج من الحساب</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">سيتم تسجيل خروجك من جميع الأجهزة</p>
                  </div>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== HELPER COMPONENTS ====================

function InfoRow({
  icon,
  label,
  value,
  dir,
  isLink,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        {isLink && value !== "غير محدد" ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-orange-600 dark:text-orange-400 hover:underline truncate block"
            dir={dir}
          >
            {value}
          </a>
        ) : (
          <p className={`text-sm text-slate-900 dark:text-white ${dir ? "" : ""}`} dir={dir}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityStat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
      <span className="text-2xl">{icon}</span>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{label}</p>
    </div>
  );
}

function TimelineItem({ icon, title, date, description }: { icon: string; title: string; date: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span className="text-lg">{icon}</span>
        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mt-1" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-orange-500 dark:text-orange-400">{date}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function RecentSessions({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<{ id: string; name: string; created_at: string; messageCount: number }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase || !userId) return;
      try {
        const { data, error: err } = await supabase
          .from("projects")
          .select("id, name, created_at")
          .eq("user_id", userId)
          .eq("template", "chat")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!err && data) {
          const sessionsWithCount = await Promise.all(
            data.map(async (session) => {
              const { count } = await supabase!
                .from("ai_chat_messages")
                .select("*", { count: "exact", head: true })
                .eq("project_id", session.id);
              return { ...session, messageCount: count || 0 };
            })
          );
          startTransition(() => { setSessions(sessionsWithCount); });
        }
      } catch {} finally {
        setLoadingSessions(false);
      }
    }
    load();
  }, [userId]);

  if (loadingSessions) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">جاري التحميل...</span>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">لا توجد محادثات بعد</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700">
      {sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{session.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {new Date(session.created_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{session.messageCount} رسالة</span>
        </div>
      ))}
    </div>
  );
}

export { UserAvatar };
