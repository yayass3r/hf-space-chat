"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured, loadSettings, checkSupabaseConnection, type SiteSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import AdBanner from "@/components/AdBanner";
import MarkdownMessage from "@/components/MarkdownMessage";
import { UserAvatar } from "@/components/UserProfile";
import type { Message, ChatSession, UserProfile } from "@/lib/types";

export default function ChatApp({ onAdminClick, onProfileClick }: { onAdminClick: () => void; onProfileClick: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_SETTINGS.hf_model);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Load user profile for sidebar avatar
  useEffect(() => {
    if (!supabase || !user) return;
    async function loadProfile() {
      try {
        const { data } = await supabase!.from("profiles").select("*").eq("id", user!.id).single();
        if (data) setUserProfile(data as UserProfile);
      } catch {}
    }
    loadProfile();
  }, [user]);

  // Close model menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load site settings
  useEffect(() => {
    async function load() {
      const s = await loadSettings();
      setSiteSettings(s);
      setSelectedModel(s.hf_model);
    }
    load();
  }, []);

  // Check Supabase connection and load sessions
  useEffect(() => {
    let cancelled = false;
    async function checkConnection() {
      if (!supabase) { if (!cancelled) setDbStatus("disconnected"); return; }
      try {
        // Use site_settings for connection check (has public RLS, no recursion risk)
        const connected = await checkSupabaseConnection();
        if (cancelled) return;
        if (!connected) { setDbStatus("disconnected"); return; }
        
        setDbStatus("connected");
        if (user) {
          try {
            const { data, error: err2 } = await supabase!
              .from("projects")
              .select("id, name, created_at")
              .eq("template", "chat")
              .eq("user_id", user!.id)
              .order("created_at", { ascending: false })
              .limit(50);
            // If projects query fails due to RLS, just skip session loading
            if (!cancelled && !err2 && data) setSessions(data as ChatSession[]);
          } catch {}
        }
      } catch { if (!cancelled) setDbStatus("disconnected"); }
    }
    checkConnection();
    return () => { cancelled = true; };
  }, [user]);

  async function createNewSession(firstMessage: string) {
    if (!supabase || !user) return null;
    try {
      const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
      const { data, error: err } = await supabase!
        .from("projects")
        .insert({ name: title, template: "chat", is_public: false, is_deployed: false, status: "active", user_id: user!.id })
        .select("id, name, created_at")
        .single();
      if (!err && data) {
        setCurrentSessionId(data.id);
        setSessions((prev) => [data as ChatSession, ...prev]);
        return data.id;
      }
    } catch (e) { console.error("Create session exception:", e); }
    return null;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Build conversation history for the API
  const buildChatMessages = (currentMessages: Message[], newUserMsg: string) => {
    const history = currentMessages
      .filter((m) => !m.content.startsWith("\u274C")) // Remove error messages
      .slice(-20) // Last 20 messages for context window
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: newUserMsg });
    return history;
  };

  // FIXED: Extract streaming logic into reusable function
  const fetchStreamingResponse = async (
    chatMessages: { role: string; content: string }[],
    controller: AbortController,
    onChunk: (content: string) => void,
    onComplete: (content: string) => void,
    onError: (error: string) => void
  ) => {
    const spaceUrl = siteSettings.hf_space_url;
    const apiPath = siteSettings.hf_api_path;
    const apiToken = siteSettings.hf_api_token;
    const model = selectedModel;

    try {
      const response = await fetch(`${spaceUrl}${apiPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({
          model: model,
          messages: chatMessages,
          max_tokens: 2048,
          temperature: 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`API error: ${response.status} - ${errText.slice(0, 200)}`);
      }

      let assistantContent = "";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // SSE format: data: {...}\n\n
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data: ")) continue;
              const jsonStr = trimmedLine.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  assistantContent += delta;
                  onChunk(assistantContent);
                }
              } catch {}
            }
          }

          // FIXED: Process remaining buffer content
          if (buffer.trim().startsWith("data: ")) {
            const jsonStr = buffer.trim().slice(6).trim();
            if (jsonStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  assistantContent += delta;
                  onChunk(assistantContent);
                }
              } catch {}
            }
          }
        }
      } else {
        // Regular JSON response (fallback)
        const data = await response.json();
        if (data.choices && Array.isArray(data.choices)) {
          assistantContent = data.choices[0]?.message?.content || data.choices[0]?.text || "";
        } else if (data.data && Array.isArray(data.data)) {
          assistantContent = data.data[0];
        } else if (typeof data.data === "string") {
          assistantContent = data.data;
        } else if (data.output) {
          assistantContent = data.output;
        } else {
          assistantContent = JSON.stringify(data);
        }
        onChunk(assistantContent);
      }

      onComplete(assistantContent);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ غير معروف";
      onError(errorMessage);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: Message = { role: "user", content: trimmed, id: Date.now().toString() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create session if needed
    let sessionId = currentSessionId;
    if (supabase && user && !sessionId) {
      sessionId = await createNewSession(trimmed);
    }
    if (supabase && sessionId) {
      await supabase!.from("ai_chat_messages").insert({ project_id: sessionId, role: "user", content: trimmed });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const assistantId = (Date.now() + 1).toString();

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

    const chatMessages = buildChatMessages(messages, trimmed);

    await fetchStreamingResponse(
      chatMessages,
      controller,
      // onChunk - update streaming content
      (content) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content } : m)
        );
      },
      // onComplete - save to DB
      (content) => {
        if (sessionId && content) {
          supabase?.from("ai_chat_messages").insert({
            project_id: sessionId,
            role: "assistant",
            content: content,
          });
        }
        setIsLoading(false);
        abortControllerRef.current = null;
        inputRef.current?.focus();
      },
      // onError
      (errorMessage) => {
        setError(errorMessage);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `\u274C ${errorMessage}` } : m)
        );
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    );
  };

  // FIXED: retryLastMessage now uses streaming
  const retryLastMessage = async () => {
    const lastUserIdx = [...messages].map((m, i) => m.role === "user" ? i : -1).filter(i => i >= 0).pop();
    if (lastUserIdx === undefined) return;
    const lastUserMsg = messages[lastUserIdx];

    // Remove messages after and including the last user message
    const priorMessages = messages.slice(0, lastUserIdx);
    setMessages(priorMessages);
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const assistantId = (Date.now() + 1).toString();

    // Re-add the user message and empty assistant
    setMessages((prev) => [
      ...prev,
      { role: "user", content: lastUserMsg.content, id: Date.now().toString() },
      { role: "assistant", content: "", id: assistantId },
    ]);

    const chatMessages = buildChatMessages(priorMessages, lastUserMsg.content);

    await fetchStreamingResponse(
      chatMessages,
      controller,
      (content) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content } : m)
        );
      },
      (content) => {
        if (currentSessionId && content) {
          supabase?.from("ai_chat_messages").insert([
            { project_id: currentSessionId, role: "user", content: lastUserMsg.content },
            { project_id: currentSessionId, role: "assistant", content },
          ]);
        }
        setIsLoading(false);
        abortControllerRef.current = null;
      },
      (errorMessage) => {
        setError(errorMessage);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `\u274C ${errorMessage}` } : m)
        );
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); setError(null); setCurrentSessionId(null); };

  const loadSession = async (sessionId: string) => {
    if (!supabase) return;
    try {
      const { data, error: err } = await supabase!.from("ai_chat_messages").select("role, content").eq("project_id", sessionId).order("created_at", { ascending: true });
      if (!err && data) {
        setMessages(data.map((m: { role: string; content: string }, i: number) => ({ role: m.role as "user" | "assistant", content: m.content, id: `${sessionId}-${i}` })));
        setCurrentSessionId(sessionId);
      }
    } catch {}
  };

  const deleteSession = async (sessionId: string) => {
    if (!supabase) return;
    try {
      await supabase!.from("ai_chat_messages").delete().eq("project_id", sessionId);
      await supabase!.from("projects").delete().eq("id", sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) clearChat();
      setDeleteConfirm(null);
    } catch {}
  };

  const exportChat = () => {
    if (messages.length === 0) return;
    const content = messages.map((m) => `**${m.role === "user" ? "أنت" : "AI"}:**\n${m.content}`).join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = searchQuery ? sessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())) : sessions;
  const statusColor = { checking: "bg-yellow-400", connected: "bg-emerald-400", disconnected: "bg-red-400" };
  const statusText = { checking: "جاري الفحص...", connected: "متصل", disconnected: "غير متصل" };

  // FIXED: Helper to check if a message is an error
  const isError = (msg: Message) => msg.role === "assistant" && msg.content.startsWith("\u274C");
  const isLastMessage = (index: number) => index === messages.length - 1;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      {isSupabaseConfigured && dbStatus === "connected" && (
        <aside className={`fixed md:relative z-50 md:z-auto flex flex-col w-72 border-l border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <button onClick={clearChat} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all">
              + محادثة جديدة
            </button>
            {sessions.length > 3 && (
              <div className="relative">
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث في المحادثات..." className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredSessions.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-8 px-4">{searchQuery ? "لا توجد نتائج" : "لا توجد محادثات محفوظة بعد"}</p>}
            {filteredSessions.map((session) => (
              <div key={session.id} className={`group flex items-center gap-1 mb-1 rounded-lg transition-colors ${currentSessionId === session.id ? "bg-orange-50 dark:bg-orange-900/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                <button onClick={() => { loadSession(session.id); setSidebarOpen(false); }} className="flex-1 text-right px-3 py-2.5 text-sm truncate">
                  <span className={`block truncate ${currentSessionId === session.id ? "text-orange-700 dark:text-orange-300" : "text-slate-600 dark:text-slate-400"}`}>{session.name}</span>
                </button>
                {deleteConfirm === session.id ? (
                  <div className="flex items-center gap-1 px-1">
                    <button onClick={() => deleteSession(session.id)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="تأكيد"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></button>
                    <button onClick={() => setDeleteConfirm(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="إلغاء"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(session.id); }} className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="حذف">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className={`w-2 h-2 rounded-full ${statusColor[dbStatus]}`}></span>Supabase: {statusText[dbStatus]}
            </div>
            {user && (
              <button
                onClick={onProfileClick}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group"
              >
                <UserAvatar profile={userProfile} size="sm" />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {userProfile?.display_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" dir="ltr">{user.email}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isAdmin ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                    {isAdmin ? "مسؤول" : "مستخدم"}
                  </span>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        <AdBanner position="top" />

        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {isSupabaseConfigured && dbStatus === "connected" && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 text-white font-bold text-sm shadow-lg shadow-orange-500/20">HF</div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{siteSettings.site_name}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${statusColor[dbStatus]}`}></span>{statusText[dbStatus]}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-orange-500 font-medium">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel.split("/").pop()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {/* FIXED: Model selector dropdown - uses click instead of hover for mobile */}
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="اختيار النموذج"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </button>
              {showModelMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50">
                  <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2">اختر النموذج</p>
                  </div>
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {AVAILABLE_MODELS.map((model) => (
                      <button key={model.id} onClick={() => { setSelectedModel(model.id); setShowModelMenu(false); }} className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedModel === model.id ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                        <div>
                          <p className="font-medium">{model.name}</p>
                          <p className="text-[10px] text-slate-400">{model.desc}</p>
                        </div>
                        {selectedModel === model.id && <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {isAdmin && (
              <button onClick={onAdminClick} className="p-2 rounded-lg text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" title="لوحة التحكم">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </button>
            )}
            <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-lg transition-colors ${showConfig ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`} title="معلومات الاتصال">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button onClick={exportChat} disabled={messages.length === 0} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30" title="تصدير المحادثة">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button onClick={clearChat} className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="مسح المحادثة">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M4 7h16" /></svg>
            </button>
            {/* Profile button */}
            <button onClick={onProfileClick} className="p-2 rounded-lg text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="الملف الشخصي">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </button>
            <button onClick={signOut} className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="تسجيل الخروج">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        {/* Config Panel */}
        {showConfig && (
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">HF API</span>
                <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5" dir="ltr">{siteSettings.hf_space_url}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">النموذج</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5" dir="ltr">{selectedModel}</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-xl shadow-orange-500/20">HF</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">مرحباً بك في {siteSettings.site_name}</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-3">تحدث مع نماذج الذكاء الاصطناعي عبر Hugging Face Inference API بسرعة وسهولة.</p>
              <p className="text-xs text-orange-500 mb-6">النموذج الحالي: {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel.split("/").pop()}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
                {["اشرح لي مفهوم الذكاء الاصطناعي", "اكتب كود Python", "ترجم هذا النص للعربية"].map((suggestion) => (
                  <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus(); }} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-orange-300 dark:hover:border-orange-600 transition-all">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={message.id || index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20" : isError(message) ? "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${message.role === "user" ? "text-orange-100" : isError(message) ? "text-red-500" : "text-orange-500"}`}>{message.role === "user" ? "أنت" : "AI"}</span>
                  {message.role === "assistant" && message.content && (
                    <div className="flex items-center gap-1">
                      {/* FIXED: Copy button shows for all non-error assistant messages */}
                      {!isError(message) && (
                        <button onClick={() => navigator.clipboard.writeText(message.content)} className="p-1 rounded text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" title="نسخ">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      )}
                      {/* FIXED: Retry button now shows for error messages (was inside wrong condition) */}
                      {isError(message) && isLastMessage(index) && (
                        <button onClick={retryLastMessage} className="p-1 rounded text-red-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="إعادة المحاولة">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">يفكر...</span>
                  <button onClick={stopGeneration} className="px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors">إيقاف</button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 sm:mx-6 mb-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={retryLastMessage} className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 transition-colors">إعادة المحاولة</button>
          </div>
        )}

        <AdBanner position="bottom" />

        {/* Input Area */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="اكتب رسالتك..." rows={1} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm leading-relaxed" style={{ maxHeight: "120px" }} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = "auto"; target.style.height = Math.min(target.scrollHeight, 120) + "px"; }} />
            </div>
            {isLoading ? (
              <button onClick={stopGeneration} className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all" title="إيقاف">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button onClick={sendMessage} disabled={!input.trim()} className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-xs text-slate-400 dark:text-slate-500">Enter = إرسال · Shift+Enter = سطر جديد · النموذج: {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "..."}</p>
        </div>
      </div>
    </div>
  );
}

// Theme Toggle Component - FOUC prevented by inline script in layout.tsx
function ThemeToggle() {
  // Initialize dark state from DOM class (set by inline script before paint)
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    // Ensure DOM stays in sync with initial state
    if (dark) {
      document.documentElement.classList.add("dark");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const newDark = !dark;
    setDark(newDark);
    if (newDark) { document.documentElement.classList.add("dark"); localStorage.setItem("hf_theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("hf_theme", "light"); }
  };

  return (
    <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={dark ? "الوضع الفاتح" : "الوضع المظلم"}>
      {dark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
}
