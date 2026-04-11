"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import LoginPage from "@/components/LoginPage";
import ChatApp from "@/components/ChatApp";
import AdminDashboard from "@/components/AdminDashboard";
import FullStackBuilder from "@/components/FullStackBuilder";

function AppContent() {
  const { user, isAdmin, loading } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [appMode, setAppMode] = useState<"chat" | "builder">("chat");

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-orange-500/20 animate-pulse">
            HF
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">جاري التحميل...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated → show login
  if (!user) {
    return <LoginPage />;
  }

  // Admin dashboard
  if (showAdmin && isAdmin) {
    return <AdminDashboard onClose={() => setShowAdmin(false)} />;
  }

  // Builder mode
  if (appMode === "builder") {
    return <FullStackBuilder onBack={() => setAppMode("chat")} />;
  }

  // Chat mode with builder tab
  return (
    <div className="relative h-screen">
      {/* Mode toggle floating button */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-2 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg shadow-xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setAppMode("chat")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            appMode === "chat"
              ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          💬 محادثة
        </button>
        <button
          onClick={() => setAppMode("builder")}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          🏗️ بناء
        </button>
      </div>

      <ChatApp onAdminClick={() => setShowAdmin(true)} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
