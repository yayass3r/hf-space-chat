"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { useAuth } from "./AuthProvider";
import { supabase, checkSupabaseConnection, loadSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS, type SiteSettings } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { UserAvatar } from "./UserProfile";

// ==================== PAGE TYPES ====================
export type AppPage = "home" | "chat" | "builder" | "deploy" | "profile" | "admin" | "settings";

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  adminOnly?: boolean;
  color: string;
}

// ==================== NAV ITEMS CONFIG ====================
const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "الرئيسية",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    color: "from-orange-500 to-yellow-400",
  },
  {
    id: "chat",
    label: "المحادثة",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: "from-blue-500 to-cyan-400",
  },
  {
    id: "builder",
    label: "بناء المشاريع",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "deploy",
    label: "نشر المشاريع",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: "from-emerald-500 to-teal-400",
  },
  {
    id: "profile",
    label: "الملف الشخصي",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: "from-pink-500 to-rose-400",
  },
  {
    id: "admin",
    label: "لوحة التحكم",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    adminOnly: true,
    color: "from-amber-500 to-orange-400",
  },
];

// ==================== THEME TOGGLE ====================
function ThemeToggle({ isDark }: { isDark: boolean }) {
  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("hf_theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("hf_theme", "dark");
    }
  };

  return (
    <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={isDark ? "الوضع الفاتح" : "الوضع المظلم"}>
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
}

// ==================== HOME PAGE ====================
function HomePage({ onNavigate, user, isAdmin }: { onNavigate: (page: AppPage) => void; user: { email?: string; id?: string; created_at?: string } | null; isAdmin: boolean; }) {
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
  const [stats, setStats] = useState({ sessions: 0, messages: 0, projects: 0 });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });

  useEffect(() => {
    async function load() {
      const s = await loadSettings();
      startTransition(() => { setSiteSettings(s); });
    }
    load();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    async function loadStats() {
      try {
        const [sessionsRes, messagesRes, projectsRes] = await Promise.all([
          supabase!.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
          supabase!.from("ai_chat_messages").select("id", { count: "exact", head: true }),
          supabase!.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user!.id).neq("template", "chat"),
        ]);
        startTransition(() => {
          setStats({
            sessions: sessionsRes.count || 0,
            messages: messagesRes.count || 0,
            projects: projectsRes.count || 0,
          });
        });
      } catch {}
    }
    loadStats();
  }, [user]);

  const quickActions = [
    { page: "chat" as AppPage, icon: "💬", label: "محادثة جديدة", desc: "تحدث مع الذكاء الاصطناعي", color: "from-blue-500 to-cyan-400" },
    { page: "builder" as AppPage, icon: "🏗️", label: "بناء مشروع", desc: "أنشئ تطبيق Full-Stack", color: "from-violet-500 to-purple-500" },
    { page: "deploy" as AppPage, icon: "🚀", label: "نشر مشروع", desc: "انشر على استضافة مجانية", color: "from-emerald-500 to-teal-400" },
    { page: "profile" as AppPage, icon: "👤", label: "الملف الشخصي", desc: "إعدادات حسابك", color: "from-pink-500 to-rose-400" },
  ];

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome Banner */}
        <div className={`rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0tNCA0aC0ydi0yaDJ2MnptMCA0aC0ydi0yaDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-xl">
                HF
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  مرحباً، {user?.email?.split("@")[0] || "مستخدم"}!
                </h1>
                <p className="text-white/80 text-sm mt-1">مرحباً بك في {siteSettings.site_name}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => onNavigate("admin")}
                className="sm:mr-auto px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/30 transition-colors"
              >
                🛡️ لوحة التحكم
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "المحادثات", value: stats.sessions, icon: "💬", color: "from-blue-500/10 to-blue-600/5 border-blue-500/20" },
            { label: "الرسائل", value: stats.messages, icon: "📝", color: "from-violet-500/10 to-violet-600/5 border-violet-500/20" },
            { label: "المشاريع", value: stats.projects, icon: "🏗️", color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" },
            { label: "النماذج المتاحة", value: AVAILABLE_MODELS.length, icon: "🤖", color: "from-orange-500/10 to-orange-600/5 border-orange-500/20" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border p-4 bg-gradient-to-br ${stat.color}`}>
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">إجراءات سريعة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.page}
                onClick={() => onNavigate(action.page)}
                className={`group p-4 rounded-2xl border-2 transition-all text-right hover:shadow-lg ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white text-lg shadow-lg mb-3 group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{action.label}</h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Available Models */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">النماذج المتاحة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_MODELS.map((model) => (
              <div key={model.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{model.name}</p>
                  <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{model.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <div className={`rounded-2xl border p-6 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"}`}>
          <h2 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-slate-900"}`}>النشاط الأخير</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>ابدأ محادثة أو أنشئ مشروعاً لمشاهدة نشاطك هنا</p>
            <button
              onClick={() => onNavigate("chat")}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all"
            >
              ابدأ محادثة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP LAYOUT ====================
export default function AppLayout({ children, currentPage, onNavigate }: {
  children: React.ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}) {
  const { user, isAdmin, signOut } = useAuth();
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });

  // Sync dark mode
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Load user profile
  useEffect(() => {
    if (!supabase || !user) return;
    async function loadProfile() {
      try {
        const { data } = await supabase!.from("profiles").select("*").eq("id", user!.id).single();
        if (data) startTransition(() => { setUserProfile(data as UserProfile); });
      } catch {}
    }
    loadProfile();
  }, [user]);

  // Check DB connection
  useEffect(() => {
    async function check() {
      const connected = await checkSupabaseConnection();
      startTransition(() => { setDbStatus(connected ? "connected" : "disconnected"); });
    }
    check();
  }, []);

  // Load site settings
  useEffect(() => {
    async function load() {
      const s = await loadSettings();
      startTransition(() => { setSiteSettings(s); });
    }
    load();
  }, []);

  // Handle URL hash navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && NAV_ITEMS.some(item => item.id === hash)) {
        onNavigate(hash as AppPage);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [onNavigate]);

  const handleNavigate = useCallback((page: AppPage) => {
    onNavigate(page);
    window.location.hash = page;
    setMobileMenuOpen(false);
  }, [onNavigate]);

  // Get page title
  const currentPageItem = NAV_ITEMS.find(item => item.id === currentPage);
  const pageTitle = currentPageItem?.label || "الرئيسية";

  // Filter nav items based on admin status
  const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const statusColor = { checking: "bg-yellow-400", connected: "bg-emerald-400", disconnected: "bg-red-400" };
  const statusText = { checking: "جاري الفحص...", connected: "متصل", disconnected: "غير متصل" };

  // Check if current page is fullscreen (builder, admin, profile)
  const isFullscreenPage = currentPage === "builder" || currentPage === "profile";

  // For fullscreen pages, render without layout
  if (isFullscreenPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300" dir="rtl">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-50 lg:z-auto flex flex-col h-full border-l transition-all duration-300 ${
        sidebarCollapsed ? "w-16" : "w-64"
      } ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800`}>

        {/* Sidebar Header */}
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/20 shrink-0">
              HF
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{siteSettings.site_name}</h1>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]}`}></span>
                  {statusText[dbStatus]}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                sidebarCollapsed ? "px-2 py-3 justify-center" : "px-3 py-2.5"
              } ${
                currentPage === item.id
                  ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                  : isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className={`shrink-0 ${currentPage === item.id ? "text-white" : ""}`}>
                {item.icon}
              </span>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {!sidebarCollapsed && item.badge && (
                <span className="mr-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className={`border-t border-slate-200 dark:border-slate-800 ${sidebarCollapsed ? "p-2" : "p-3"} space-y-2`}>
          {/* User profile section */}
          {user && (
            <button
              onClick={() => handleNavigate("profile")}
              className={`w-full flex items-center gap-2.5 rounded-xl transition-colors ${
                sidebarCollapsed ? "px-1 py-2 justify-center" : "px-2.5 py-2"
              } ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}
              title={sidebarCollapsed ? "الملف الشخصي" : undefined}
            >
              <UserAvatar profile={userProfile} size="sm" />
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {userProfile?.display_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" dir="ltr">{user.email}</p>
                </div>
              )}
              {!sidebarCollapsed && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  isAdmin ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                }`}>
                  {isAdmin ? "مسؤول" : "مستخدم"}
                </span>
              )}
            </button>
          )}

          {/* Theme & Collapse Controls */}
          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-2" : "gap-2"}`}>
            <ThemeToggle isDark={isDark} />
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden lg:block"
              title={sidebarCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            >
              <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="تسجيل الخروج"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{pageTitle}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]}`}></span>
                  {statusText[dbStatus]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick navigation for mobile */}
            <div className="flex items-center gap-1 lg:hidden">
              {(["home", "chat", "builder", "deploy"] as AppPage[]).map((page) => {
                const item = NAV_ITEMS.find(i => i.id === page);
                if (!item) return null;
                return (
                  <button
                    key={page}
                    onClick={() => handleNavigate(page)}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === page
                        ? "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    title={item.label}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export { HomePage };
