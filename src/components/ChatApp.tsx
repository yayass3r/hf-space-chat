"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { loadSettings, type SiteSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS } from "@/lib/supabase";
import { localProfiles, localChatSessions, localChatMessages } from "@/lib/localdb";
import { unifiedChatSessions, unifiedChatMessages, unifiedProfiles, ensureLocalProfileForAppwriteUser, type UnifiedChatSession, type UnifiedChatMessage } from "@/lib/datasource";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeContext";
import AdBanner from "@/components/AdBanner";
import MarkdownMessage from "@/components/MarkdownMessage";
import { UserAvatar } from "@/components/UserProfile";
import { NotificationCenter } from "@/components/NotificationSystem";
import type { Message, ChatSession, UserProfile } from "@/lib/types";

export default function ChatApp({ onAdminClick, onProfileClick, embedded = false }: { onAdminClick: () => void; onProfileClick: () => void; onDeployClick?: () => void; embedded?: boolean }) {
  const { user, isAdmin, signOut, authSource } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [sessions, setSessions] = useState<UnifiedChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...DEFAULT_SETTINGS });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_SETTINGS.hf_model);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // NEW: Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  // NEW: Custom system prompt
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  // NEW: Chat folders
  const [chatFolder, setChatFolder] = useState<string>("all");
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [sessionFolders, setSessionFolders] = useState<Record<string, string>>({});
  const [folderNames, setFolderNames] = useState<string[]>(["عام", "عمل", "شخصي"]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<unknown>(null);

  // Load user profile for sidebar avatar (uses unified data source)
  useEffect(() => {
    if (!user) return;
    // Ensure Appwrite users have a local profile too
    if (authSource === "appwrite") {
      ensureLocalProfileForAppwriteUser(user.id, user.email || "", user.user_metadata?.full_name as string || "");
    }
    async function loadProfile() {
      const profile = await unifiedProfiles.getById(user!.id, authSource);
      if (profile) setUserProfile(profile);
    }
    loadProfile();
  }, [user, authSource]);

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

  // NEW: Initialize voice recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setVoiceSupported(true);
        const recognition = new (SpeechRecognition as new () => { start: () => void; stop: () => void; onresult: ((e: { results: { transcript: string }[][] }[]) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string })();
        (recognition as Record<string, unknown>).continuous = false;
        (recognition as Record<string, unknown>).interimResults = true;
        (recognition as Record<string, unknown>).lang = "ar-SA";
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // NEW: Load custom system prompt & folders from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedPrompt = localStorage.getItem("hf_system_prompt");
      if (savedPrompt) setSystemPrompt(savedPrompt);
      const savedFolders = localStorage.getItem("hf_session_folders");
      if (savedFolders) setSessionFolders(JSON.parse(savedFolders));
      const savedFolderNames = localStorage.getItem("hf_folder_names");
      if (savedFolderNames) setFolderNames(JSON.parse(savedFolderNames));
    } catch {}
  }, []);

  // Load sessions from unified data source (Appwrite or LocalDB)
  useEffect(() => {
    setDbStatus("connected"); // LocalDB is always available as fallback
    if (user) {
      unifiedChatSessions.getByUserId(user.id, authSource).then(sessions => {
        setSessions(sessions);
      });
    }
  }, [user, authSource]);

  async function createNewSession(firstMessage: string) {
    if (!user) return null;
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    const session = await unifiedChatSessions.create(user.id, title, authSource);
    if (session) {
      setCurrentSessionId(session.id);
      setSessions((prev) => [session, ...prev]);
      return session.id;
    }
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
    const history: { role: "system" | "user" | "assistant"; content: string }[] = [];
    // NEW: Add custom system prompt if set
    if (systemPrompt.trim()) {
      history.push({ role: "system", content: systemPrompt.trim() });
    }
    currentMessages
      .filter((m) => !m.content.startsWith("\u274C")) // Remove error messages
      .slice(-20) // Last 20 messages for context window
      .forEach((m) => history.push({ role: m.role as "user" | "assistant", content: m.content }));
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
    if (user && !sessionId) {
      sessionId = await createNewSession(trimmed);
    }
    if (sessionId) {
      unifiedChatMessages.insert(sessionId, "user", trimmed, authSource);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const assistantId = (Date.now() + 1).toString();

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

    // Use functional state update to avoid stale closure
    const chatMessages = buildChatMessages(
      // Get the current messages including the just-added user message
      [...messages, userMessage],
      trimmed
    );
    // Remove the duplicate last user message since buildChatMessages adds it
    chatMessages.pop(); // Remove the duplicated user message added by buildChatMessages

    await fetchStreamingResponse(
      chatMessages,
      controller,
      // onChunk - update streaming content
      (content) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content } : m)
        );
      },
      // onComplete - save to data source
      (content) => {
        if (sessionId && content) {
          unifiedChatMessages.insert(sessionId, "assistant", content, authSource);
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
          unifiedChatMessages.insertMany([
            { session_id: currentSessionId, role: "user", content: lastUserMsg.content },
            { session_id: currentSessionId, role: "assistant", content },
          ], authSource);
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

  // NEW: Voice input toggle
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    const recognition = recognitionRef.current as Record<string, unknown>;
    if (isListening) {
      (recognition.stop as () => void)();
      setIsListening(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognition.onresult as (e: any) => void) = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        // Use isFinal to avoid duplication - only replace input when interim, append when final
        if (event.results?.[0]?.isFinal) {
          setInput((prev) => prev + transcript);
        } else {
          // For interim results, we could show them but don't add to input yet
          // to avoid duplication when final result arrives
        }
      };
      (recognition.onend as () => void) = () => setIsListening(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognition.onerror as () => void) = () => setIsListening(false);
      (recognition.start as () => void)();
      setIsListening(true);
    }
  };

  // NEW: Save system prompt
  const saveSystemPrompt = (prompt: string) => {
    setSystemPrompt(prompt);
    try { localStorage.setItem("hf_system_prompt", prompt); } catch {}
  };

  // NEW: Assign session to folder
  const assignSessionToFolder = (sessionId: string, folder: string) => {
    const updated = { ...sessionFolders, [sessionId]: folder };
    setSessionFolders(updated);
    try { localStorage.setItem("hf_session_folders", JSON.stringify(updated)); } catch {}
  };

  // NEW: Add custom folder
  const addFolder = (name: string) => {
    if (!name.trim() || folderNames.includes(name.trim())) return;
    const updated = [...folderNames, name.trim()];
    setFolderNames(updated);
    try { localStorage.setItem("hf_folder_names", JSON.stringify(updated)); } catch {}
  };

  const clearChat = () => { setMessages([]); setError(null); setCurrentSessionId(null); };

  const loadSession = async (sessionId: string) => {
    const msgs = await unifiedChatMessages.getBySessionId(sessionId, authSource);
    if (msgs.length > 0) {
      setMessages(msgs.map((m, i) => ({ role: m.role, content: m.content, id: `${sessionId}-${i}` })));
      setCurrentSessionId(sessionId);
    } else {
      setCurrentSessionId(sessionId);
      setMessages([]);
    }
  };

  const deleteSession = async (sessionId: string) => {
    await unifiedChatSessions.delete(sessionId, authSource);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) clearChat();
    setDeleteConfirm(null);
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

  const filteredSessions = searchQuery 
    ? sessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : chatFolder === "all"
      ? sessions
      : sessions.filter((s) => sessionFolders[s.id] === chatFolder);
  const statusColor = { checking: "bg-yellow-400", connected: "bg-emerald-400", disconnected: "bg-red-400" };
  const statusText = { checking: "جاري الفحص...", connected: "متصل", disconnected: "غير متصل" };

  // FIXED: Helper to check if a message is an error
  const isError = (msg: Message) => msg.role === "assistant" && msg.content.startsWith("\u274C");
  const isLastMessage = (index: number) => index === messages.length - 1;

  return (
    <div className={`flex ${embedded ? "h-full" : "h-screen"} bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300`}>
      {/* Session Drawer Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Session Drawer - always slides in (no persistent sidebar when embedded) */}
      <aside className={`fixed top-0 right-0 z-50 flex flex-col h-full w-72 border-l border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-2xl ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">المحادثات</h3>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="إغلاق">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <button onClick={clearChat} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all">
            + محادثة جديدة
          </button>
          {/* Folder filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button onClick={() => setChatFolder("all")} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${chatFolder === "all" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              الكل
            </button>
            {folderNames.map((f) => (
              <button key={f} onClick={() => setChatFolder(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${chatFolder === f ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                {f}
              </button>
            ))}
            <button onClick={() => setShowFolderManager(!showFolderManager)} className="p-1 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="إدارة المجلدات">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          {/* Add folder form */}
          {showFolderManager && (
            <div className="flex items-center gap-1.5">
              <input type="text" placeholder="مجلد جديد..." className="flex-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500" onKeyDown={(e) => { if (e.key === "Enter") { addFolder((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
            </div>
          )}
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
                {sessionFolders[session.id] && <span className="text-[9px] text-orange-400 dark:text-orange-500">{sessionFolders[session.id]}</span>}
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
            <span className={`w-2 h-2 rounded-full ${statusColor[dbStatus]}`}></span>قاعدة البيانات: {statusText[dbStatus]}
          </div>
          {!embedded && user && (
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

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Chat Toolbar - compact when embedded */}
        <header className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm ${embedded ? "" : ""}`}>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="قائمة المحادثات">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
            {!embedded && (
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-400 text-white font-bold text-xs shadow-lg shadow-orange-500/20">HF</div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-orange-500 font-medium truncate max-w-[150px] sm:max-w-none">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel.split("/").pop()}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            {!embedded && <ThemeToggleCompact />}
            <NotificationCenter />
            {/* Model selector dropdown */}
            <div className="relative" ref={modelMenuRef}>
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="اختيار النموذج"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
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
            {isAdmin && !embedded && (
              <button onClick={onAdminClick} className="p-1.5 rounded-lg text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" title="لوحة التحكم">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </button>
            )}
            <button onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)} className={`p-1.5 rounded-lg transition-colors ${showSystemPromptEditor ? "text-violet-500 bg-violet-50 dark:bg-violet-900/20" : "text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`} title="تعليمات مخصصة">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button onClick={exportChat} disabled={messages.length === 0} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30" title="تصدير المحادثة">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button onClick={clearChat} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="مسح المحادثة">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M4 7h16" /></svg>
            </button>
            {!embedded && (
              <>
                <button onClick={onProfileClick} className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="الملف الشخصي">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </button>
                <button onClick={signOut} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="تسجيل الخروج">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </>
            )}
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

        {/* NEW: System Prompt Editor Panel */}
        {showSystemPromptEditor && (
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-violet-50/50 dark:bg-violet-900/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">تعليمات مخصصة للذكاء الاصطناعي</span>
              </div>
              <button onClick={() => setShowSystemPromptEditor(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => saveSystemPrompt(e.target.value)}
              placeholder="مثال: أنت مساعد ذكي متخصص في البرمجة. أجب بالعربية دائماً..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-violet-500 dark:text-violet-400">سيتم إرسال هذه التعليمات مع كل رسالة كسياق للنموذج</p>
              {systemPrompt && (
                <button onClick={() => saveSystemPrompt("")} className="text-[10px] text-red-400 hover:text-red-500 transition-colors">مسح التعليمات</button>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-2xl shadow-orange-500/25 animate-float">HF</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">مرحباً بك في {siteSettings.site_name}</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-3">تحدث مع نماذج الذكاء الاصطناعي عبر Hugging Face Inference API بسرعة وسهولة.</p>
              <p className="text-xs text-orange-500 font-medium mb-6">النموذج الحالي: {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel.split("/").pop()}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
                {["اشرح لي مفهوم الذكاء الاصطناعي", "اكتب كود Python", "ترجم هذا النص للعربية"].map((suggestion) => (
                  <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus(); }} className="card-modern px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={message.id || index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 ${
                message.role === "user"
                  ? "msg-user"
                  : isError(message)
                    ? "msg-error"
                    : "msg-assistant"
              }`}>
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
            <div className="flex justify-start animate-fade-in">
              <div className="msg-assistant px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
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

        {/* Input Area - Enhanced */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200/60 dark:border-slate-800/60 glass-strong">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isListening ? "جاري الاستماع..." : "اكتب رسالتك..."} rows={1} className={`input-modern px-4 py-3 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-orange-500/20 ${isListening ? "ring-2 ring-red-400/30 bg-red-50/50 dark:bg-red-900/10" : ""}`} style={{ maxHeight: "120px" }} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = "auto"; target.style.height = Math.min(target.scrollHeight, 120) + "px"; }} />
            </div>
            {/* NEW: Voice input button */}
            {voiceSupported && (
              <button onClick={toggleVoiceInput} className={`flex items-center justify-center w-10 h-12 rounded-xl transition-all active:scale-95 ${isListening ? "bg-red-500 text-white shadow-lg shadow-red-500/25 animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-orange-500 dark:hover:text-orange-400"}`} title={isListening ? "إيقاف التسجيل" : "إدخال صوتي"}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
            )}
            {isLoading ? (
              <button onClick={stopGeneration} className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all active:scale-95" title="إيقاف">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button onClick={sendMessage} disabled={!input.trim()} className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500">Enter = إرسال · Shift+Enter = سطر جديد{voiceSupported ? " · 🎤 إدخال صوتي" : ""} · النموذج: {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "..."}{systemPrompt ? " · 📋 تعليمات مفعّلة" : ""}</p>
        </div>
      </div>
    </div>
  );
}

// Theme toggle using centralized ThemeContext (replaces 5+ independent MutationObservers)
function ThemeToggleCompact() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={isDark ? "الوضع الفاتح" : "الوضع المظلم"} aria-label={isDark ? "الوضع الفاتح" : "الوضع المظلم"}>
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
}
