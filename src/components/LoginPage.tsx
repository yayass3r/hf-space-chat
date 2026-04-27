"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured, supabase, checkSupabaseConnection } from "@/lib/supabase";

export default function LoginPage() {
  const { signIn, signUp, isLocalAuth } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingLocalAuth, setUsingLocalAuth] = useState(false);

  // Check if Supabase is reachable
  useEffect(() => {
    if (isLocalAuth) {
      setUsingLocalAuth(true);
      return;
    }
    checkSupabaseConnection().then((reachable) => {
      setUsingLocalAuth(!reachable);
    });
  }, [isLocalAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }

    if (isResetMode) {
      if (usingLocalAuth) {
        setError("إعادة تعيين كلمة المرور غير متاحة في الوضع المحلي. تواصل مع المسؤول.");
        return;
      }
      if (!supabase) {
        setError("خدمة المصادقة غير متاحة");
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
          setError(err.includes("already registered") || err.includes("مسجل مسبقا")
            ? "هذا البريد الإلكتروني مسجل مسبقاً"
            : err);
        } else {
          setSuccess("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول");
          setIsSignUp(false);
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err.includes("Invalid login credentials") || err.includes("غير صحيحة")
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

  return (
    <div className="login-bg flex min-h-screen items-center justify-center p-4" dir="rtl">
      {/* Floating orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-5 shadow-2xl shadow-orange-500/30 animate-float">
            HF
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="gradient-text">HF Space Chat</span>
          </h1>
          <p className="text-slate-400 text-sm">
            {isResetMode ? "إعادة تعيين كلمة المرور" : isSignUp ? "إنشاء حساب جديد" : "مرحباً بك، سجل دخولك للمتابعة"}
          </p>
          {/* Auth mode indicator */}
          {usingLocalAuth && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-400 font-medium">وضع المصادقة المحلي</span>
            </div>
          )}
        </div>

        {/* Login Card */}
        <div className="login-card p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
                className="login-input"
                required
              />
            </div>

            {/* Password */}
            {!isResetMode && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="login-input"
                  required
                />
              </div>
            )}

            {/* Confirm Password */}
            {isSignUp && !isResetMode && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تأكيد كلمة المرور
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="login-input"
                  required
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري المعالجة...
                </>
              ) : isResetMode ? "إرسال رابط إعادة التعيين" : isSignUp ? "إنشاء حساب" : "تسجيل الدخول"}
            </button>
          </form>

          {/* Links */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/5 text-sm">
            {!isResetMode && (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-orange-400 hover:text-orange-300 transition-colors"
              >
                {isSignUp ? "لديك حساب؟ سجل الدخول" : "ليس لديك حساب؟ أنشئ واحدًا"}
              </button>
            )}
            {!isSignUp && !usingLocalAuth && (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(!isResetMode);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                {isResetMode ? "العودة لتسجيل الدخول" : "نسيت كلمة المرور؟"}
              </button>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          {[
            { icon: "🤖", label: "نماذج AI متعددة" },
            { icon: "🚀", label: "نشر مجاني" },
            { icon: "🔒", label: "آمن ومحمي" },
          ].map((feature) => (
            <div key={feature.label} className="text-center py-3 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-lg mb-1">{feature.icon}</div>
              <p className="text-[10px] text-slate-500">{feature.label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          بالتسجيل، أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
