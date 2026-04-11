"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }

    // Reset password mode
    if (isResetMode) {
      if (!supabase) {
        setError("Supabase غير مُعد");
        return;
      }
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (err) {
          setError(err.message);
        } else {
          setSuccess("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
        }
      } catch {
        setError("حدث خطأ غير متوقع");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password.trim()) {
      setError("يرجى إدخال كلمة المرور");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err.includes("already registered")
            ? "هذا البريد الإلكتروني مسجل مسبقاً"
            : err);
        } else {
          setSuccess("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول");
          setIsSignUp(false);
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err.includes("Invalid login credentials")
            ? "بيانات الدخول غير صحيحة"
            : err);
        }
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-xl shadow-orange-500/20">
              HF
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              HF Space Chat
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              خدمة المصادقة غير مُعدّة. تواصل مع المسؤول.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-xl shadow-orange-500/20">
            HF
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            HF Space Chat
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {isResetMode ? "إعادة تعيين كلمة المرور" : isSignUp ? "إنشاء حساب جديد" : "تسجيل الدخول إلى حسابك"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4"
        >
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              required
            />
          </div>

          {!isResetMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                required
              />
            </div>
          )}

          {isSignUp && !isResetMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جاري المعالجة...
              </span>
            ) : isResetMode ? "إرسال رابط إعادة التعيين" : isSignUp ? "إنشاء حساب" : "تسجيل الدخول"}
          </button>

          <div className="flex items-center justify-between pt-2 text-sm">
            {!isResetMode && (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-orange-600 dark:text-orange-400 hover:underline"
              >
                {isSignUp ? "لديك حساب؟ سجل الدخول" : "ليس لديك حساب؟ أنشئ واحدًا"}
              </button>
            )}
            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(!isResetMode);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 hover:underline"
              >
                {isResetMode ? "العودة لتسجيل الدخول" : "نسيت كلمة المرور؟"}
              </button>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          بالتسجيل، أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
