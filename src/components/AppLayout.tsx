"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { useAuth } from "./AuthProvider";
import { useRouter, type AppPage } from "./HashRouter";
import { supabase, checkSupabaseConnection, loadSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS, type SiteSettings } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { UserAvatar } from "./UserProfile";

// ==================== NAV ITEMS CONFIG ====================
interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  adminOnly?: boolean;
  color: string;
}

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
function HomePage({ user, isAdmin }: { user: { email?: string; id?: string; created_at?: string } | null; isAdmin: boolean; }) {
  const { navigate } = useRouter();
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
    { page: "chat" as AppPage, icon: "💬", label: "محادثة جديدة", desc: "تحدث مع الذكاء الاصطناعي", color: "from-blue-500 to-cyan-400", bg: "bg-blue-500/10 dark:bg-blue-500/5" },
    { page: "builder" as AppPage, icon: "🏗️", label: "بناء مشروع", desc: "أنشئ تطبيق Full-Stack", color: "from-violet-500 to-purple-500", bg: "bg-violet-500/10 dark:bg-violet-500/5" },
    { page: "deploy" as AppPage, icon: "🚀", label: "نشر مشروع", desc: "انشر على استضافة مجانية", color: "from-emerald-500 to-teal-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/5" },
    { page: "profile" as AppPage, icon: "👤", label: "الملف الشخصي", desc: "إعدادات حسابك", color: "from-pink-500 to-rose-400", bg: "bg-pink-500/10 dark:bg-pink-500/5" },
  ];

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome Banner - Enhanced */}
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 relative overflow-hidden banner-shimmer animate-fade-in-up">
          {/* Decorative circles */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-yellow-300/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-2xl shadow-orange-600/30 border border-white/10">
                HF
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  مرحباً، {user?.email?.split("@")[0] || "مستخدم"}!
                </h1>
                <p className="text-white/80 text-sm mt-1">مرحباً بك في {siteSettings.site_name} — منصتك الذكية</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:mr-auto">
              {isAdmin && (
                <button
                  onClick={() => navigate("admin")}
                  className="px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/25 transition-all border border-white/10 hover:border-white/20"
                >
                  🛡️ لوحة التحكم
                </button>
              )}
              <button
                onClick={() => navigate("chat")}
                className="px-4 py-2.5 rounded-xl bg-white text-orange-600 text-sm font-bold hover:bg-white/90 transition-all shadow-lg shadow-orange-700/20"
              >
                ابدأ محادثة ←
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "المحادثات", value: stats.sessions, icon: "💬", gradient: "from-blue-500 to-cyan-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200/60 dark:border-blue-800/30" },
            { label: "الرسائل", value: stats.messages, icon: "📝", gradient: "from-violet-500 to-purple-400", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200/60 dark:border-violet-800/30" },
            { label: "المشاريع", value: stats.projects, icon: "🏗️", gradient: "from-emerald-500 to-teal-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200/60 dark:border-emerald-800/30" },
            { label: "النماذج", value: AVAILABLE_MODELS.length, icon: "🤖", gradient: "from-orange-500 to-amber-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200/60 dark:border-orange-800/30" },
          ].map((stat, idx) => (
            <div key={stat.label} className={`stat-card rounded-2xl border p-4 ${stat.bg} ${stat.border} animate-fade-in-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white text-base shadow-lg mb-3`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions - Enhanced */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400" />
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map((action, idx) => (
              <button
                key={action.page}
                onClick={() => navigate(action.page)}
                className={`quick-action-card group p-5 rounded-2xl border text-right animate-fade-in-up ${
                  isDark
                    ? "bg-slate-800/40 border-slate-700/60 hover:border-slate-500/80"
                    : "bg-white/80 border-slate-200/80 hover:border-slate-300"
                } backdrop-blur-sm`}
                style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white text-xl shadow-lg mb-3 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                  {action.icon}
                </div>
                <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{action.label}</h3>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Available Models - Enhanced */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
            النماذج المتاحة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {AVAILABLE_MODELS.map((model, idx) => (
              <div key={model.id} className={`card-modern flex items-center gap-3 p-3.5 animate-fade-in-up`} style={{ animationDelay: `${0.2 + idx * 0.03}s` }}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-md">
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

        {/* Recent Activity - Enhanced */}
        <div className="card-modern p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-400" />
            النشاط الأخير
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-3xl mb-4">
              📊
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>لا يوجد نشاط بعد</p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>ابدأ محادثة أو أنشئ مشروعاً لمشاهدة نشاطك هنا</p>
            <button
              onClick={() => navigate("chat")}
              className="btn-primary mt-5 px-8 py-3 text-sm"
            >
              ابدأ محادثة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MOBILE BOTTOM NAV ====================
function MobileBottomNav({ currentPage, navigate }: { currentPage: AppPage; navigate: (page: AppPage) => void }) {
  const mobileNavItems: { id: AppPage; label: string; icon: React.ReactNode }[] = [
    {
      id: "home",
      label: "الرئيسية",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: "chat",
      label: "المحادثة",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: "builder",
      label: "بناء",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
    {
      id: "deploy",
      label: "نشر",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: "profile",
      label: "الملف",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="mobile-bottom-nav lg:hidden" dir="rtl">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400" />
              )}
              <span className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${isActive ? "font-bold" : ""}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ==================== MAIN APP LAYOUT ====================
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const { currentPage, navigate } = useRouter();
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

  const handleNavigate = useCallback((page: AppPage) => {
    navigate(page);
    setMobileMenuOpen(false);
  }, [navigate]);

  // Get page title and breadcrumb
  const currentPageItem = NAV_ITEMS.find(item => item.id === currentPage);
  const pageTitle = currentPageItem?.label || "الرئيسية";

  // Filter nav items based on admin status
  const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const statusColor = { checking: "bg-yellow-400", connected: "bg-emerald-400", disconnected: "bg-red-400" };
  const statusText = { checking: "جاري الفحص...", connected: "متصل", disconnected: "غير متصل" };

  // Check if current page is fullscreen (builder, profile)
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

      {/* Sidebar - Enhanced with glass effect */}
      <aside className={`fixed lg:relative z-50 lg:z-auto flex flex-col h-full border-l transition-all duration-300 ${
        sidebarCollapsed ? "w-16" : "w-64"
      } ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } sidebar-glass border-slate-200/80 dark:border-slate-800/80`}>

        {/* Sidebar Header */}
        <div className={`p-4 border-b border-slate-200/60 dark:border-slate-800/60 ${sidebarCollapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/25 shrink-0">
              HF
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{siteSettings.site_name}</h1>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]} ${dbStatus === "connected" ? "animate-pulse" : ""}`}></span>
                  {statusText[dbStatus]}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 ${
                  sidebarCollapsed ? "px-2 py-3 justify-center" : "px-3 py-2.5"
                } ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg nav-active-glow`
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className={`shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span className="mr-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white badge-glow">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`border-t border-slate-200/60 dark:border-slate-800/60 ${sidebarCollapsed ? "p-2" : "p-3"} space-y-2`}>
          {/* User profile section */}
          {user && (
            <button
              onClick={() => handleNavigate("profile")}
              className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 ${
                sidebarCollapsed ? "px-1 py-2 justify-center" : "px-2.5 py-2"
              } ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60" : "bg-slate-100/80 hover:bg-slate-200/80"} hover:shadow-md`}
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
              <svg className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
      <div className="flex-1 flex flex-col min-w-0 pb-14 lg:pb-0">
        {/* Top Header Bar - Enhanced */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/60 dark:border-slate-800/60 glass-strong">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              {/* Breadcrumb-style page title */}
              <div className="flex items-center gap-2">
                {currentPage !== "home" && (
                  <>
                    <button
                      onClick={() => navigate("home")}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                    >
                      الرئيسية
                    </button>
                    <svg className="w-3 h-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </>
                )}
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{pageTitle}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]} ${dbStatus === "connected" ? "animate-pulse" : ""}`}></span>
                  {statusText[dbStatus]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick navigation for mobile (hidden since we have bottom nav now) */}
            <div className="hidden items-center gap-1 lg:hidden">
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

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav currentPage={currentPage} navigate={navigate} />
    </div>
  );
}

export { HomePage };
