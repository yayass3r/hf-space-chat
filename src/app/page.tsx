"use client";

import { useState, useCallback, startTransition } from "react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import LoginPage from "@/components/LoginPage";
import ChatApp from "@/components/ChatApp";
import AdminDashboard from "@/components/AdminDashboard";
import FullStackBuilder from "@/components/FullStackBuilder";
import UserProfile from "@/components/UserProfile";
import DeploymentHub from "@/components/DeploymentHub";
import AppLayout, { HomePage, type AppPage } from "@/components/AppLayout";

function AppContent() {
  const { user, isAdmin, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>("home");

  const handleNavigate = useCallback((page: AppPage) => {
    startTransition(() => { setCurrentPage(page); });
  }, []);

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

  // Render page content based on current page
  const renderPageContent = () => {
    switch (currentPage) {
      case "home":
        return (
          <HomePage
            onNavigate={handleNavigate}
            user={user}
            isAdmin={isAdmin}
          />
        );
      case "chat":
        return (
          <ChatApp
            onAdminClick={() => handleNavigate("admin")}
            onProfileClick={() => handleNavigate("profile")}
            embedded={true}
          />
        );
      case "builder":
        return <FullStackBuilder onBack={() => handleNavigate("home")} />;
      case "deploy":
        return (
          <DeploymentHub
            onClose={() => handleNavigate("home")}
            standalone={true}
          />
        );
      case "profile":
        return <UserProfile onClose={() => handleNavigate("home")} />;
      case "admin":
        if (!isAdmin) {
          handleNavigate("home");
          return null;
        }
        return <AdminDashboard onClose={() => handleNavigate("home")} />;
      default:
        return (
          <HomePage
            onNavigate={handleNavigate}
            user={user}
            isAdmin={isAdmin}
          />
        );
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPageContent()}
    </AppLayout>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
