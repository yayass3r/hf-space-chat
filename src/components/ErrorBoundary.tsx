"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");

      return (
        <div className={`flex items-center justify-center min-h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
          <div className="max-w-md mx-auto p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-3xl shadow-2xl shadow-red-500/20">
              ⚠️
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              حدث خطأ غير متوقع
            </h1>
            <p className={`text-sm mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            </p>
            {this.state.error && (
              <div className={`mt-4 p-3 rounded-lg text-xs text-left ${isDark ? "bg-slate-900 text-red-400 border border-slate-800" : "bg-red-50 text-red-600 border border-red-200"}`} dir="ltr">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all"
              >
                إعادة تحميل الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
