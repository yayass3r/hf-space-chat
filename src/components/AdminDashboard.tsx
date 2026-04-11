"use client";

import React, { useState, useEffect } from "react";
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

  // Load users and stats when tab changes
  useEffect(() => {
    if (activeTab === "users" && supabase) {
      loadUsers();
    }
    if (activeTab === "overview" && supabase) {
      loadStats();
    }
  }, [activeTab]);

  async function loadUsers() {
    if (!supabase) return;
    try {
      const profilesExist = await checkProfilesTable();
      if (profilesExist) {
        const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
        if (data) setUsers(data as UserProfile[]);
      }
    } catch {}
  }

  async function loadStats() {
    if (!supabase) return;
    try {
      const [usersRes, sessionsRes, messagesRes, todayRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("ai_chat_messages").select("id", { count: "exact", head: true }),
        supabase.from("ai_chat_messages").select("id").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        totalMessages: messagesRes.count || 0,
        todayMessages: todayRes.data?.length || 0,
        activeUsers: usersRes.count || 0,
      });
    } catch {}
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950" dir="rtl">
        <div className="flex items-center gap-3 text-slate-400">
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
    <div className="flex h-screen bg-slate-950" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/20">
              HF
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">لوحة التحكم</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
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
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                <h3 className="text-lg font-bold text-white mb-1">نظرة عامة</h3>
                <p className="text-sm text-slate-500">إحصائيات الاستخدام والحالة العامة</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="المستخدمين" value={stats.totalUsers} icon="👥" color="blue" />
                <StatCard title="المحادثات" value={stats.totalSessions} icon="💬" color="emerald" />
                <StatCard title="الرسائل" value={stats.totalMessages} icon="✉️" color="orange" />
                <StatCard title="رسائل اليوم" value={stats.todayMessages} icon="📊" color="purple" />
              </div>

              {/* Quick Actions */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h4 className="text-sm font-semibold text-white mb-3">إجراءات سريعة</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setActiveTab("users")}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors text-center"
                  >
                    إدارة المستخدمين
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors text-center"
                  >
                    إعدادات الموقع
                  </button>
                  <button
                    onClick={() => setActiveTab("ads")}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors text-center"
                  >
                    إدارة الإعلانات
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/ucmpclgctjeyoimtmqir"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors text-center block"
                  >
                    Supabase Dashboard
                  </a>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h4 className="text-sm font-semibold text-white mb-3">حالة النظام</h4>
                <div className="space-y-3">
                  <StatusRow label="Supabase" status={isSupabaseConfigured ? "connected" : "disconnected"} />
                  <StatusRow label="HF Space API" status={settings.hf_space_url !== "https://your-space.hf.space" ? "connected" : "warning"} />
                  <StatusRow label="AdSense" status={settings.adsense_enabled === "true" ? "connected" : "inactive"} />
                  <StatusRow label="AdMob" status={settings.admob_enabled === "true" ? "connected" : "inactive"} />
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">الإعدادات العامة</h3>
                <p className="text-sm text-slate-500">إعدادات الموقع والاتصال الأساسية</p>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">اسم الموقع</label>
                    <input type="text" value={settings.site_name} onChange={(e) => updateSetting("site_name", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">بريد المسؤولين (مفصول بفواصل)</label>
                    <input type="text" value={settings.admin_emails} onChange={(e) => updateSetting("admin_emails", e.target.value)}
                      placeholder="admin@example.com" dir="ltr"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                  </div>
                </div>

                {/* HF API Section */}
                <div className="border-t border-slate-800 pt-5">
                  <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Hugging Face API
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">رابط HF Space</label>
                      <input type="url" value={settings.hf_space_url} onChange={(e) => updateSetting("hf_space_url", e.target.value)}
                        dir="ltr" className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">مسار API</label>
                      <input type="text" value={settings.hf_api_path} onChange={(e) => updateSetting("hf_api_path", e.target.value)}
                        dir="ltr" className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">HF API Token</label>
                      <input type="password" value={settings.hf_api_token} onChange={(e) => updateSetting("hf_api_token", e.target.value)}
                        placeholder="hf_..." dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      <p className="text-[10px] text-slate-500 mt-1">من huggingface.co/settings/tokens</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">النموذج الافتراضي</label>
                      <select value={settings.hf_model} onChange={(e) => updateSetting("hf_model", e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                        <option value="HuggingFaceTB/SmolLM2-1.7B-Instruct">SmolLM2 1.7B (سريع)</option>
                        <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B (متوازن)</option>
                        <option value="mistralai/Mistral-7B-Instruct-v0.3">Mistral 7B (قوي)</option>
                        <option value="google/gemma-2-2b-it">Gemma 2 2B (جوجل)</option>
                        <option value="Qwen/Qwen2.5-3B-Instruct">Qwen 2.5 3B (متعدد اللغات)</option>
                        <option value="microsoft/Phi-3.5-mini-instruct">Phi 3.5 Mini (مايكروسوفت)</option>
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
                <h3 className="text-lg font-bold text-white mb-1">إدارة المستخدمين</h3>
                <p className="text-sm text-slate-500">عرض وإدارة المستخدمين المسجلين</p>
              </div>

              {users.length === 0 ? (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
                  <p className="text-slate-500">لا يوجد مستخدمين مسجلين</p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-right px-4 py-3 text-slate-400 font-medium">البريد الإلكتروني</th>
                        <th className="text-right px-4 py-3 text-slate-400 font-medium">الدور</th>
                        <th className="text-right px-4 py-3 text-slate-400 font-medium">تاريخ التسجيل</th>
                        <th className="text-right px-4 py-3 text-slate-400 font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-white" dir="ltr">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.role === "admin" ? "bg-orange-500/20 text-orange-400" : "bg-slate-700 text-slate-300"
                            }`}>
                              {u.role === "admin" ? "مسؤول" : "مستخدم"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs" dir="ltr">
                            {new Date(u.created_at).toLocaleDateString("ar-SA")}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => updateUserRole(u.id, u.role === "admin" ? "user" : "admin")}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                u.role === "admin"
                                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
              )}

              <button
                onClick={loadUsers}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
              >
                تحديث القائمة
              </button>
            </div>
          )}

          {/* Ads Tab */}
          {activeTab === "ads" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">إدارة الإعلانات</h3>
                <p className="text-sm text-slate-500">إعدادات Google AdSense و AdMob</p>
              </div>

              {/* AdSense */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Google AdSense</h4>
                      <p className="text-xs text-slate-500">إعلانات الويب</p>
                    </div>
                  </div>
                  <button onClick={() => updateSetting("adsense_enabled", settings.adsense_enabled === "true" ? "false" : "true")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${settings.adsense_enabled === "true" ? "bg-orange-500" : "bg-slate-700"}`}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.adsense_enabled === "true" ? "right-0.5" : "right-7"}`} />
                  </button>
                </div>
                {settings.adsense_enabled === "true" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">AdSense Client ID</label>
                      <input type="text" value={settings.adsense_client_id} onChange={(e) => updateSetting("adsense_client_id", e.target.value)}
                        placeholder="ca-pub-XXXXXXXXXXXXXXXX" dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad Slot ID</label>
                      <input type="text" value={settings.adsense_ad_slot} onChange={(e) => updateSetting("adsense_ad_slot", e.target.value)}
                        placeholder="XXXXXXXXXX" dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                  </div>
                )}
              </div>

              {/* AdMob */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Google AdMob</h4>
                      <p className="text-xs text-slate-500">إعلانات التطبيقات</p>
                    </div>
                  </div>
                  <button onClick={() => updateSetting("admob_enabled", settings.admob_enabled === "true" ? "false" : "true")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${settings.admob_enabled === "true" ? "bg-orange-500" : "bg-slate-700"}`}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.admob_enabled === "true" ? "right-0.5" : "right-7"}`} />
                  </button>
                </div>
                {settings.admob_enabled === "true" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">AdMob App ID</label>
                      <input type="text" value={settings.admob_app_id} onChange={(e) => updateSetting("admob_app_id", e.target.value)}
                        placeholder="ca-app-pub-XXXX~YYYY" dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad Unit ID</label>
                      <input type="text" value={settings.admob_ad_unit_id} onChange={(e) => updateSetting("admob_ad_unit_id", e.target.value)}
                        placeholder="ca-app-pub-XXXX/ZZZZ" dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
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

// Stat Card Component
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
    orange: "from-orange-500/20 to-orange-600/5 border-orange-500/30",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString("ar-SA")}</p>
      <p className="text-xs text-slate-400 mt-1">{title}</p>
    </div>
  );
}

// Status Row Component
function StatusRow({ label, status }: { label: string; status: "connected" | "disconnected" | "warning" | "inactive" }) {
  const statusConfig = {
    connected: { color: "bg-emerald-400", text: "متصل" },
    disconnected: { color: "bg-red-400", text: "غير متصل" },
    warning: { color: "bg-yellow-400", text: "يحتاج إعداد" },
    inactive: { color: "bg-slate-600", text: "غير مفعّل" },
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
        <span className="text-xs text-slate-400">{config.text}</span>
      </div>
    </div>
  );
}
