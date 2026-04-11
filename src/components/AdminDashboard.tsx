"use client";

import React, { useState, useEffect, useCallback, startTransition } from "react";
import { useAuth } from "./AuthProvider";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, supabase, isSupabaseConfigured, checkProfilesTable } from "@/lib/supabase";
import type { SiteSettingKey, UserProfile, DashboardStats } from "@/lib/types";

interface AdminTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, totalSessions: 0, totalMessages: 0, todayMessages: 0, activeUsers: 0 });
  // Initialize from DOM (set by inline script in layout.tsx before paint)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Sync with global dark mode via MutationObserver
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const tabs: AdminTab[] = [
    {
      id: "overview",
      label: "نظرة عامة",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "الإعدادات العامة",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: "users",
      label: "إدارة المستخدمين",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: "ads",
      label: "إدارة الإعلانات",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    let mounted = true;
    async function init() {
      const s = await loadSettings();
      if (mounted) {
        setSettings(s);
        setLoading(false);
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Load users and stats
  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    try {
      const profilesExist = await checkProfilesTable();
      if (profilesExist) {
        const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
        if (data) setUsers(data as UserProfile[]);
      }
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    if (!supabase) return;
    try {
      // Try to load stats - gracefully handle RLS errors
      const [usersRes, sessionsRes, messagesRes, todayRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("ai_chat_messages").select("id", { count: "exact", head: true }),
        supabase.from("ai_chat_messages").select("id").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      // Check for RLS recursion errors
      const hasRlsError = [usersRes, sessionsRes, messagesRes, todayRes].some(
        r => r.error?.code === "42P17" || r.error?.message?.includes("infinite recursion")
      );

      if (hasRlsError) {
        // RLS has issues - show connection as working but stats unavailable
        setStats({ totalUsers: -1, totalSessions: -1, totalMessages: -1, todayMessages: -1, activeUsers: -1 });
        return;
      }

      setStats({
        totalUsers: usersRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        totalMessages: messagesRes.count || 0,
        todayMessages: todayRes.data?.length || 0,
        activeUsers: usersRes.count || 0,
      });
    } catch {}
  }, []);

  // Load users and stats when tab changes
  useEffect(() => {
    if (activeTab === "users" && supabase) {
      startTransition(() => { loadUsers(); });
    }
    if (activeTab === "overview" && supabase) {
      startTransition(() => { loadStats(); });
    }
  }, [activeTab, loadUsers, loadStats]);

  async function updateUserRole(userId: string, newRole: "admin" | "user") {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
      if (!error) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
        setMessage({ type: "success", text: "تم تحديث دور المستخدم بنجاح" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {}
  }

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(settings);
      setMessage({ type: "success", text: "تم حفظ الإعدادات بنجاح" });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "حدث خطأ أثناء الحفظ" });
    }
    setSaving(false);
  };

  const updateSetting = (key: SiteSettingKey, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Toggle theme
  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) { document.documentElement.classList.add("dark"); localStorage.setItem("hf_theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("hf_theme", "light"); }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
        <div className={`flex items-center gap-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          جاري تحميل لوحة التحكم...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
      {/* Sidebar */}
      <aside className={`w-64 ${isDark ? "bg-slate-900 border-l border-slate-800" : "bg-white border-l border-slate-200"} flex flex-col`}>
        <div className={`p-5 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/20">
              HF
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>لوحة التحكم</h2>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-orange-500/10 text-orange-400"
                  : isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={`p-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"} space-y-2`}>
          {/* Theme toggle in admin */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
            {isDark ? "الوضع الفاتح" : "الوضع المظلم"}
          </button>
          <button
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            العودة للمحادثة
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm ${message.type === "success" ? "bg-emerald-900/20 border border-emerald-800 text-emerald-400" : "bg-red-900/20 border border-red-800 text-red-400"}`}>
              {message.text}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"} mb-1`}>نظرة عامة</h3>
                <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>إحصائيات الاستخدام والحالة العامة</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="المستخدمين" value={stats.totalUsers} icon="2" color="blue" isDark={isDark} />
                <StatCard title="المحادثات" value={stats.totalSessions} icon="3" color="emerald" isDark={isDark} />
                <StatCard title="الرسائل" value={stats.totalMessages} icon="4" color="orange" isDark={isDark} />
                <StatCard title="رسائل اليوم" value={stats.todayMessages} icon="5" color="purple" isDark={isDark} />
              </div>

              {/* RLS Warning */}
              {stats.totalUsers === -1 && (
                <div className="px-4 py-3 rounded-xl bg-amber-900/20 border border-amber-700 text-amber-400 text-sm">
                  <p className="font-semibold mb-1">تحذير: سياسات RLS بحاجة لإصلاح</p>
                  <p className="text-xs text-amber-500">جداول profiles/projects/messages تعاني من حلقة لا نهائية في سياسات الأمان. يرجى تشغيل سكريبت fix_rls_policies.sql في Supabase SQL Editor.</p>
                  <a href="https://supabase.com/dashboard/project/ucmpclgctjeyoimtmqir/sql/new" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1 rounded-lg bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 text-xs transition-colors">
                    فتح SQL Editor ←
                  </a>
                </div>
              )}

              {/* Quick Actions */}
              <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-5`}>
                <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"} mb-3`}>إجراءات سريعة</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button onClick={() => setActiveTab("users")} className={`px-4 py-3 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm transition-colors text-center`}>
                    إدارة المستخدمين
                  </button>
                  <button onClick={() => setActiveTab("settings")} className={`px-4 py-3 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm transition-colors text-center`}>
                    إعدادات الموقع
                  </button>
                  <button onClick={() => setActiveTab("ads")} className={`px-4 py-3 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm transition-colors text-center`}>
                    إدارة الإعلانات
                  </button>
                  <a href="https://supabase.com/dashboard/project/ucmpclgctjeyoimtmqir" target="_blank" rel="noopener noreferrer" className={`px-4 py-3 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm transition-colors text-center block`}>
                    Supabase Dashboard
                  </a>
                </div>
              </div>

              {/* System Status */}
              <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-5`}>
                <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"} mb-3`}>حالة النظام</h4>
                <div className="space-y-3">
                  <StatusRow label="Supabase" status={isSupabaseConfigured ? "connected" : "disconnected"} isDark={isDark} />
                  <StatusRow label="RLS Policies" status={stats.totalUsers === -1 ? "warning" : "connected"} isDark={isDark} />
                  <StatusRow label="HF Inference API" status={settings.hf_space_url !== "https://your-space.hf.space" ? "connected" : "warning"} isDark={isDark} />
                  <StatusRow label="HF API Token" status={settings.hf_api_token ? "connected" : "warning"} isDark={isDark} />
                  <StatusRow label="AdSense" status={settings.adsense_enabled === "true" ? "connected" : "inactive"} isDark={isDark} />
                  <StatusRow label="AdMob" status={settings.admob_enabled === "true" ? "connected" : "inactive"} isDark={isDark} />
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"} mb-1`}>الإعدادات العامة</h3>
                <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>إعدادات الموقع والاتصال الأساسية</p>
              </div>

              <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-5 space-y-5`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>اسم الموقع</label>
                    <input type="text" value={settings.site_name} onChange={(e) => updateSetting("site_name", e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>بريد المسؤولين (مفصول بفواصل)</label>
                    <input type="text" value={settings.admin_emails} onChange={(e) => updateSetting("admin_emails", e.target.value)}
                      placeholder="admin@example.com" dir="ltr"
                      className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                  </div>
                </div>

                {/* HF API Section */}
                <div className={`border-t ${isDark ? "border-slate-800" : "border-slate-200"} pt-5`}>
                  <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Hugging Face Inference API
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>رابط HF API</label>
                      <input type="url" value={settings.hf_space_url} onChange={(e) => updateSetting("hf_space_url", e.target.value)}
                        dir="ltr" className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                      <p className="text-[10px] text-slate-500 mt-1" dir="ltr">https://api-inference.huggingface.co</p>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>مسار API</label>
                      <input type="text" value={settings.hf_api_path} onChange={(e) => updateSetting("hf_api_path", e.target.value)}
                        dir="ltr" className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>HF API Token</label>
                      <input type="password" value={settings.hf_api_token} onChange={(e) => updateSetting("hf_api_token", e.target.value)}
                        placeholder="hf_..." dir="ltr"
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                      <p className="text-[10px] text-slate-500 mt-1">من huggingface.co/settings/tokens</p>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>النموذج الافتراضي</label>
                      <select value={settings.hf_model} onChange={(e) => updateSetting("hf_model", e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`}>
                        <option value="meta-llama/Llama-3.2-1B-Instruct">Llama 3.2 1B (سريع ومجاني)</option>
                        <option value="Qwen/Qwen3-8B">Qwen3 8B (متوازن ومجاني)</option>
                        <option value="meta-llama/Llama-3.1-8B-Instruct">Llama 3.1 8B (رخيص)</option>
                        <option value="Qwen/Qwen2.5-Coder-7B-Instruct">Qwen Coder 7B (برمجة)</option>
                        <option value="Qwen/Qwen3-4B-Instruct-2507">Qwen3 4B (سريع)</option>
                        <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-7B">DeepSeek R1 7B (استدلال)</option>
                        <option value="google/gemma-3n-E4B-it">Gemma 3n E4B (جوجل)</option>
                        <option value="Qwen/Qwen3-14B">Qwen3 14B (قوي)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 text-sm">
                {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"} mb-1`}>إدارة المستخدمين</h3>
                <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>عرض وإدارة المستخدمين المسجلين</p>
              </div>

              {users.length === 0 ? (
                <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-8 text-center`}>
                  <p className={isDark ? "text-slate-500" : "text-slate-400"}>لا يوجد مستخدمين مسجلين</p>
                </div>
              ) : (
                <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>المستخدم</th>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>الدور</th>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>الموقع</th>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>آخر نشاط</th>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>تاريخ التسجيل</th>
                          <th className={`text-right px-4 py-3 ${isDark ? "text-slate-400" : "text-slate-500"} font-medium`}>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className={`border-b ${isDark ? "border-slate-800/50 hover:bg-slate-800/30" : "border-slate-100 hover:bg-slate-50"}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {(u as unknown as Record<string, unknown>).display_name ? String((u as unknown as Record<string, unknown>).display_name).charAt(0) : u.email?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                                    {(u as unknown as Record<string, unknown>).display_name ? String((u as unknown as Record<string, unknown>).display_name) : u.email?.split("@")[0]}
                                  </p>
                                  <p className={`text-xs truncate ${isDark ? "text-slate-500" : "text-slate-400"}`} dir="ltr">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.role === "admin" ? "bg-orange-500/20 text-orange-400" : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                              }`}>
                                {u.role === "admin" ? "مسؤول" : "مستخدم"}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {(u as unknown as Record<string, unknown>).location ? String((u as unknown as Record<string, unknown>).location) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {(u as unknown as Record<string, unknown>).last_seen ? new Date(String((u as unknown as Record<string, unknown>).last_seen)).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`} dir="ltr">
                              {new Date(u.created_at).toLocaleDateString("ar-SA")}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => updateUserRole(u.id, u.role === "admin" ? "user" : "admin")}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  u.role === "admin"
                                    ? isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                                }`}
                              >
                                {u.role === "admin" ? "إلغاء الإدارة" : "جعل مسؤول"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={loadUsers}
                className={`px-4 py-2 rounded-lg ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"} text-sm transition-colors`}
              >
                تحديث القائمة
              </button>
            </div>
          )}

          {/* Ads Tab */}
          {activeTab === "ads" && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"} mb-1`}>إدارة الإعلانات</h3>
                <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>إعدادات Google AdSense و AdMob</p>
              </div>

              {/* AdSense */}
              <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-5 space-y-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Google AdSense</h4>
                      <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>إعلانات الويب</p>
                    </div>
                  </div>
                  <button onClick={() => updateSetting("adsense_enabled", settings.adsense_enabled === "true" ? "false" : "true")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${settings.adsense_enabled === "true" ? "bg-orange-500" : isDark ? "bg-slate-700" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.adsense_enabled === "true" ? "right-0.5" : "right-7"}`} />
                  </button>
                </div>
                {settings.adsense_enabled === "true" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>AdSense Client ID</label>
                      <input type="text" value={settings.adsense_client_id} onChange={(e) => updateSetting("adsense_client_id", e.target.value)}
                        placeholder="ca-pub-XXXXXXXXXXXXXXXX" dir="ltr"
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>Ad Slot ID</label>
                      <input type="text" value={settings.adsense_ad_slot} onChange={(e) => updateSetting("adsense_ad_slot", e.target.value)}
                        placeholder="XXXXXXXXXX" dir="ltr"
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                    </div>
                  </div>
                )}
              </div>

              {/* AdMob */}
              <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} rounded-xl border p-5 space-y-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Google AdMob</h4>
                      <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>إعلانات التطبيقات</p>
                    </div>
                  </div>
                  <button onClick={() => updateSetting("admob_enabled", settings.admob_enabled === "true" ? "false" : "true")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${settings.admob_enabled === "true" ? "bg-orange-500" : isDark ? "bg-slate-700" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.admob_enabled === "true" ? "right-0.5" : "right-7"}`} />
                  </button>
                </div>
                {settings.admob_enabled === "true" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>AdMob App ID</label>
                      <input type="text" value={settings.admob_app_id} onChange={(e) => updateSetting("admob_app_id", e.target.value)}
                        placeholder="ca-app-pub-XXXX~YYYY" dir="ltr"
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-1.5`}>Ad Unit ID</label>
                      <input type="text" value={settings.admob_ad_unit_id} onChange={(e) => updateSetting("admob_ad_unit_id", e.target.value)}
                        placeholder="ca-app-pub-XXXX/ZZZZ" dir="ltr"
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 bg-slate-50 text-slate-900"} focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`} />
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleSaveSettings} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 text-sm">
                {saving ? "جاري الحفظ..." : "حفظ إعدادات الإعلانات"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Stat Card Component - FIXED: Uses isDark prop instead of hardcoded dark
function StatCard({ title, value, icon, color, isDark }: { title: string; value: number; icon: string; color: string; isDark: boolean }) {
  const darkColorClasses: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
    orange: "from-orange-500/20 to-orange-600/5 border-orange-500/30",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  };
  const lightColorClasses: Record<string, string> = {
    blue: "from-blue-50 to-blue-100/50 border-blue-200",
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200",
    orange: "from-orange-50 to-orange-100/50 border-orange-200",
    purple: "from-purple-50 to-purple-100/50 border-purple-200",
  };

  return (
    <div className={`bg-gradient-to-br ${isDark ? darkColorClasses[color] : lightColorClasses[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${value === -1 ? "text-amber-400" : isDark ? "text-white" : "text-slate-900"}`}>{value === -1 ? "⚠" : value.toLocaleString("ar-SA")}</p>
      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"} mt-1`}>{title}</p>
    </div>
  );
}

// Status Row Component - FIXED: Uses isDark prop
function StatusRow({ label, status, isDark }: { label: string; status: "connected" | "disconnected" | "warning" | "inactive"; isDark: boolean }) {
  const statusConfig = {
    connected: { color: "bg-emerald-400", text: "متصل" },
    disconnected: { color: "bg-red-400", text: "غير متصل" },
    warning: { color: "bg-yellow-400", text: "يحتاج إعداد" },
    inactive: { color: isDark ? "bg-slate-600" : "bg-slate-300", text: "غير مفعّل" },
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{config.text}</span>
      </div>
    </div>
  );
}
