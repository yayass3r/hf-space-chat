"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import AdBanner from "@/components/AdBanner";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/types";
import type { Message, ChatSession } from "@/lib/types";

export default function ChatApp({ onAdminClick }: { onAdminClick: () => void }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load site settings
  useEffect(() => {
    if (!supabase) return;
    async function load() {
      try {
        const { data } = await supabase.from("site_settings").select("key, value");
        if (data) {
          const s = { ...DEFAULT_SETTINGS };
          data.forEach((item: { key: string; value: string }) => {
            if (item.key in s) {
              (s as Record<string, string>)[item.key] = item.value;
            }
          });
          setSiteSettings(s);
        }
      } catch { /* use defaults */ }
    }
    load();
  }, []);

  // Check Supabase connection and load sessions
  useEffect(() => {
    async function checkConnection() {
      if (!supabase) {
        setDbStatus("disconnected");
        return;
      }
      try {
        const { error: err } = await supabase.from("ai_chat_messages").select("id").limit(1);
        if (err) {
          setDbStatus("disconnected");
        } else {
          setDbStatus("connected");
          loadSessions();
        }
      } catch {
        setDbStatus("disconnected");
      }
    }
    checkConnection();
  }, []);

  async function loadSessions() {
    if (!supabase || !user) return;
    try {
      const { data, error: err } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("template", "chat")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!err && data) {
        setSessions(data as ChatSession[]);
      }
    } catch { /* silently fail */ }
  }

  async function createNewSession(firstMessage: string) {
    if (!supabase || !user) return null;
    try {
      const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
      const { data, error: err } = await supabase
        .from("projects")
        .insert({
          name: title,
          template: "chat",
          is_public: false,
          is_deployed: false,
          status: "active",
          user_id: user.id,
        })
        .select("id, name, created_at")
        .single();
      if (!err && data) {
        setCurrentSessionId(data.id);
        setSessions((prev) => [data as ChatSession, ...prev]);
        return data.id;
      }
    } catch (e) {
      console.error("Create session exception:", e);
    }
    return null;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const spaceUrl = siteSettings.hf_space_url;
  const apiPath = siteSettings.hf_api_path;

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let sessionId = currentSessionId;
    if (supabase && user && !sessionId) {
      sessionId = await createNewSession(trimmed);
    }
    if (supabase && sessionId) {
      await supabase.from("ai_chat_messages").insert({
        project_id: sessionId,
        role: "user",
        content: trimmed,
      });
    }

    try {
      const response = await fetch(`${spaceUrl}${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [trimmed] }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let assistantContent = "";
      if (data.data && Array.isArray(data.data)) {
        assistantContent = data.data[0];
      } else if (typeof data.data === "string") {
        assistantContent = data.data;
      } else if (data.output) {
        assistantContent = data.output;
      } else {
        assistantContent = JSON.stringify(data);
      }

      const assistantMessage: Message = { role: "assistant", content: assistantContent };
      setMessages((prev) => [...prev, assistantMessage]);

      if (supabase && sessionId) {
        await supabase.from("ai_chat_messages").insert({
          project_id: sessionId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      const assistantMessage: Message = { role: "assistant", content: `Error: ${errorMessage}` };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, spaceUrl, apiPath, currentSessionId, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setCurrentSessionId(null);
  };

  const loadSession = async (sessionId: string) => {
    if (!supabase) return;
    try {
      const { data, error: err } = await supabase
        .from("ai_chat_messages")
        .select("role, content")
        .eq("project_id", sessionId)
        .order("created_at", { ascending: true });
      if (!err && data) {
        setMessages(
          data.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
        setCurrentSessionId(sessionId);
      }
    } catch { /* silently fail */ }
  };

  const statusColor = {
    checking: "bg-yellow-400",
    connected: "bg-emerald-400",
    disconnected: "bg-red-400",
  };
  const statusText = {
    checking: "جاري الفحص...",
    connected: "متصل",
    disconnected: "غير متصل",
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {isSupabaseConfigured && dbStatus === "connected" && (
        <aside
          className={`fixed md:relative z-50 md:z-auto flex flex-col w-72 border-l border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={clearChat}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all"
            >
              + محادثة جديدة
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-8 px-4">
                لا توجد محادثات محفوظة بعد
              </p>
            )}
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  loadSession(session.id);
                  setSidebarOpen(false);
                }}
                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors ${
                  currentSessionId === session.id
                    ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="block truncate">{session.name}</span>
              </button>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className={`w-2 h-2 rounded-full ${statusColor[dbStatus]}`}></span>
              Supabase: {statusText[dbStatus]}
            </div>
            {user && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" dir="ltr">
                    {user.email}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isAdmin ? "مسؤول" : "مستخدم"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Ad Banner */}
        <AdBanner position="top" />

        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            {isSupabaseConfigured && dbStatus === "connected" && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 text-white font-bold text-sm shadow-lg shadow-orange-500/20">
              HF
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {siteSettings.site_name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]}`}></span>
                  {statusText[dbStatus]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                onClick={onAdminClick}
                className="p-2 rounded-lg text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                title="لوحة التحكم"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="الإعدادات"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              onClick={clearChat}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="مسح المحادثة"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
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
        </header>

        {/* Config Panel */}
        {showConfig && (
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">HF Space URL</span>
                <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5" dir="ltr">
                  {spaceUrl}
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">حالة قاعدة البيانات</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                  {statusText[dbStatus]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-xl shadow-orange-500/20">
                HF
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                مرحباً بك في {siteSettings.site_name}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                اتصل بأي واجهة برمجة تطبيقات Hugging Face Space وابدأ المحادثة.
                {isSupabaseConfigured && " محادثاتك محفوظة في Supabase."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
                {[
                  "اسأل سؤالاً",
                  "أنشئ نصاً",
                  "حلّل محتوى",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-300 dark:hover:border-orange-600 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20"
                    : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      message.role === "user"
                        ? "text-orange-100"
                        : "text-orange-500"
                    }`}
                  >
                    {message.role === "user" ? "أنت" : "HF Space"}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    يفكر...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 sm:mx-6 mb-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Bottom Ad Banner */}
        <AdBanner position="bottom" />

        {/* Input Area */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm leading-relaxed"
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-slate-400 dark:text-slate-500">
            Enter = إرسال &middot; Shift+Enter = سطر جديد
          </p>
        </div>
      </div>
    </div>
  );
}
