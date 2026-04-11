"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/supabase";
import type { SiteSettingKey } from "@/lib/types";

interface AdminTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("settings");
  const [settings, setSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const tabs: AdminTab[] = [
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
      id: "ads",
      label: "إدارة الإعلانات",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
    {
      id: "sql",
      label: "إعداد قاعدة البيانات",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    let mounted = true;
    loadSettings().then((s) => {
      if (mounted) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

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

  const SQL_INSTRUCTIONS = `-- انسخ هذا السكريبت ونفذه في Supabase SQL Editor
-- https://supabase.com/dashboard/project/ucmpclgctjeyoimtmqir/sql

-- 1. إنشاء جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. إنشاء جدول إعدادات الموقع
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- 3. إدراج الإعدادات الافتراضية
INSERT INTO public.site_settings (key, value) VALUES
  ('admin_emails', '${settings.admin_emails}'),
  ('adsense_enabled', '${settings.adsense_enabled}'),
  ('adsense_client_id', '${settings.adsense_client_id}'),
  ('adsense_ad_slot', '${settings.adsense_ad_slot}'),
  ('admob_enabled', '${settings.admob_enabled}'),
  ('admob_app_id', '${settings.admob_app_id}'),
  ('admob_ad_unit_id', '${settings.admob_ad_unit_id}'),
  ('site_name', '${settings.site_name}'),
  ('hf_space_url', '${settings.hf_space_url}'),
  ('hf_api_path', '${settings.hf_api_path}')
ON CONFLICT (key) DO NOTHING;

-- 4. تفعيل Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 5. سياسات الأمان
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Allow profile insert on signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Authenticated users can read settings" ON public.site_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert settings" ON public.site_settings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update settings" ON public.site_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. دالة إنشاء الملف الشخصي تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email,
    CASE WHEN EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'admin_emails' AND NEW.email = ANY(string_to_array(value, ','))) THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

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
              <p className="text-xs text-slate-500">مسؤول</p>
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
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm ${message.type === "success" ? "bg-emerald-900/20 border border-emerald-800 text-emerald-400" : "bg-red-900/20 border border-red-800 text-red-400"}`}>
              {message.text}
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
              </div>

              <button onClick={handleSaveSettings} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 text-sm">
                {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
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

          {/* SQL Setup Tab */}
          {activeTab === "sql" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">إعداد قاعدة البيانات</h3>
                <p className="text-sm text-slate-500">أنشئ الجداول الناقصة في Supabase SQL Editor</p>
              </div>

              <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-400 mb-2">الخطوات المطلوبة:</h4>
                <ol className="text-sm text-amber-300/80 space-y-1 list-decimal list-inside">
                  <li>اذهب إلى Supabase Dashboard → SQL Editor</li>
                  <li>انسخ السكريبت أدناه والصقه في المحرر</li>
                  <li>اضغط على Run لتنفيذ السكريبت</li>
                  <li>في Authentication → Providers تأكد من تفعيل Email</li>
                  <li>في Authentication → Settings يمكنك إلغاء &ldquo;Confirm email&rdquo; للوصول الفوري</li>
                </ol>
              </div>

              <a href="https://supabase.com/dashboard/project/ucmpclgctjeyoimtmqir/sql"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                فتح Supabase SQL Editor
              </a>

              <div className="relative">
                <button
                  onClick={() => navigator.clipboard.writeText(SQL_INSTRUCTIONS).then(() => { setMessage({ type: "success", text: "تم النسخ!" }); setTimeout(() => setMessage(null), 2000); })}
                  className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors z-10">
                  نسخ
                </button>
                <pre className="bg-slate-900 border border-slate-800 rounded-xl p-5 pt-12 overflow-x-auto text-xs text-emerald-400 font-mono leading-relaxed" dir="ltr">
                  {SQL_INSTRUCTIONS}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
