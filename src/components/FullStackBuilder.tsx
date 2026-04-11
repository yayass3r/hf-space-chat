"use client";

import { useState, useRef, useEffect, useCallback, startTransition } from "react";
import {
  loadSettings,
  type SiteSettings,
} from "@/lib/supabase";
import {
  PROJECT_TEMPLATES,
  CODE_GEN_SYSTEM_PROMPT,
  generateFileId,
  generateProjectId,
  getLanguage,
  parseAIResponseToFiles,
  assemblePreviewHTML,
  type BuilderFile,
  type BuilderProject,
} from "@/lib/builder-templates";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAuth } from "./AuthProvider";
import DeploymentHub from "./DeploymentHub";

// ==================== FILE ICON HELPER ====================
function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    html: "🌐", css: "🎨", js: "📜", jsx: "⚛️", tsx: "🔷", ts: "🔷",
    json: "📋", py: "🐍", md: "📝", sql: "🗃️", sh: "⚡", yml: "⚙️",
    yaml: "⚙️", env: "🔐", gitignore: "🚫", svg: "🖼️", txt: "📄",
  };
  return <span className="text-xs">{iconMap[ext] || "📄"}</span>;
}

// ==================== CODE EDITOR ====================
function CodeEditor({
  file,
  onChange,
  isDark,
}: {
  file: BuilderFile | null;
  onChange: (content: string) => void;
  isDark: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(() => file?.content || "");

  // Sync local content when file changes
  const prevFileId = useRef(file?.id);
  if (file?.id !== prevFileId.current) {
    prevFileId.current = file?.id;
    setLocalContent(file?.content || "");
  }

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm">اختر ملفاً للتعديل</p>
        </div>
      </div>
    );
  }

  const language = getLanguage(file.name);

  return (
    <div className="flex flex-col h-full">
      {/* File tab */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-2">
          <FileIcon name={file.name} />
          <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {file.name}
          </span>
        </div>
        <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {language.toUpperCase()}
        </span>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Syntax highlight layer (read-only display) */}
        <div className="absolute inset-0 overflow-auto pointer-events-none" style={{ paddingLeft: "3rem" }}>
          <SyntaxHighlighter
            style={oneDark}
            language={language === "jsx" ? "jsx" : language === "tsx" ? "tsx" : language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "0.75rem",
              background: "transparent",
              fontSize: "0.8rem",
              lineHeight: "1.5",
              minHeight: "100%",
            }}
            codeTagProps={{
              style: { fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace" },
            }}
          >
            {localContent}
          </SyntaxHighlighter>
        </div>

        {/* Editable textarea (transparent overlay) */}
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => {
            setLocalContent(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-white pl-12 p-3 font-mono text-[0.8rem] leading-[1.5] focus:outline-none"
          style={{ caretColor: isDark ? "#f97316" : "#2563eb", tabSize: 2 }}
          onKeyDown={(e) => {
            // Tab key inserts 2 spaces
            if (e.key === "Tab") {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newVal = localContent.substring(0, start) + "  " + localContent.substring(end);
              setLocalContent(newVal);
              onChange(newVal);
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
              }, 0);
            }
            // Auto-close brackets
            const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]", '"': '"', "'": "'", "`": "`" };
            if (pairs[e.key]) {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newVal = localContent.substring(0, start) + e.key + pairs[e.key] + localContent.substring(end);
              setLocalContent(newVal);
              onChange(newVal);
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 1;
              }, 0);
            }
          }}
        />
      </div>
    </div>
  );
}

// ==================== PREVIEW PANEL ====================
function PreviewPanel({
  files,
  isDark,
  viewMode,
}: {
  files: BuilderFile[];
  isDark: boolean;
  viewMode: "desktop" | "tablet" | "mobile";
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [manualRefresh, setManualRefresh] = useState(0);
  const previewHTML = assemblePreviewHTML(files);

  // Use files content hash + manual refresh as key to force iframe refresh
  const filesHash = files.reduce((acc, f) => acc + f.content.length, 0) + manualRefresh;

  const widthMap = { desktop: "100%", tablet: "768px", mobile: "375px" };

  return (
    <div className="flex flex-col h-full">
      {/* Preview toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>معاينة مباشرة</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode buttons */}
          {(["desktop", "tablet", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {/* viewMode set by parent */}}
              className={`p-1.5 rounded text-xs ${viewMode === mode ? "bg-orange-500/20 text-orange-500" : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}
              title={mode}
            >
              {mode === "desktop" ? "🖥️" : mode === "tablet" ? "📱" : "📲"}
            </button>
          ))}
          <button
            onClick={() => setManualRefresh((k) => k + 1)}
            className={`p-1.5 rounded text-xs ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}
            title="تحديث"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className={`flex-1 flex items-start justify-center overflow-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        <iframe
          ref={iframeRef}
          key={filesHash}
          srcDoc={previewHTML}
          className="border-0 h-full bg-white"
          style={{ width: widthMap[viewMode], maxWidth: "100%" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          title="Preview"
        />
      </div>
    </div>
  );
}

// ==================== AI CHAT PANEL ====================
function AIChatPanel({
  isDark,
  onFilesGenerated,
  siteSettings,
  selectedModel,
}: {
  isDark: boolean;
  onFilesGenerated: (files: Omit<BuilderFile, "id">[], description: string) => void;
  siteSettings: SiteSettings;
  selectedModel: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsLoading(true);

    try {
      const spaceUrl = siteSettings.hf_space_url;
      const apiPath = siteSettings.hf_api_path;
      const apiToken = siteSettings.hf_api_token;

      const chatMessages = [
        { role: "system" as const, content: CODE_GEN_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: trimmed },
      ];

      const response = await fetch(`${spaceUrl}${apiPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatMessages,
          max_tokens: 4096,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`API error: ${response.status} - ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || "لم أتمكن من إنشاء الكود";

      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

      // Parse the response into files
      const parsedFiles = parseAIResponseToFiles(assistantContent);
      if (parsedFiles.length > 0) {
        onFilesGenerated(parsedFiles, trimmed);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ غير معروف";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-4 py-2 border-b ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            مساعد الذكاء الاصطناعي
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🤖</div>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              صِف المشروع الذي تريده
            </p>
            <div className="mt-4 space-y-2">
              {[
                "أنشئ تطبيق قائمة مهام مع React",
                "اصنع صفحة هبوط لمتجر إلكتروني",
                "أنشئ لوحة تحكم مع رسوم بيانية",
                "اكتب API خادم مع Express.js",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className={`block w-full text-right px-3 py-2 rounded-lg text-xs ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} transition`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${
              msg.role === "user"
                ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white"
                : isDark
                  ? "bg-slate-800 text-slate-300 border border-slate-700"
                  : "bg-white text-slate-700 border border-slate-200"
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-xl px-3 py-2 ${isDark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>يولّد الكود...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="صِف ما تريد بناءه..."
            rows={2}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs resize-none ${isDark ? "border-slate-600 bg-slate-800 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"} focus:outline-none focus:ring-2 focus:ring-orange-500`}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 7-7 7 7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN BUILDER COMPONENT ====================
export default function FullStackBuilder({ onBack }: { onBack: () => void }) {
  useAuth(); // Get auth context for future use
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "ai" | "deploy">("editor");
  const [showTemplates, setShowTemplates] = useState(true);
  const [viewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [savedProjects, setSavedProjects] = useState<BuilderProject[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [selectedModel] = useState("Qwen/Qwen3-14B");
  const [rightPanel, setRightPanel] = useState<"preview" | "ai" | "deploy">("preview");
  const [addingFile, setAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Load settings
  useEffect(() => {
    async function load() {
      const s = await loadSettings();
      startTransition(() => { setSiteSettings(s); });
    }
    load();
  }, []);

  // Load saved projects from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("hf_builder_projects");
      if (stored) {
        startTransition(() => { setSavedProjects(JSON.parse(stored)); });
      }
    } catch {}
  }, []);

  // Sync dark mode
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Save project to localStorage
  const saveProject = useCallback(() => {
    if (!project) return;
    const updated = { ...project, updatedAt: new Date().toISOString() };
    setProject(updated);

    const projects = savedProjects.filter((p) => p.id !== updated.id);
    projects.unshift(updated);
    const trimmed = projects.slice(0, 20);
    setSavedProjects(trimmed);

    try {
      localStorage.setItem("hf_builder_projects", JSON.stringify(trimmed));
    } catch {}
  }, [project, savedProjects]);

  // Create project from template
  const createFromTemplate = (templateId: string) => {
    const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const files = template.files.map((f) => ({
      ...f,
      id: generateFileId(),
    }));

    const newProject: BuilderProject = {
      id: generateProjectId(),
      name: template.name,
      template: template.id,
      files,
      activeFileId: files[0].id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProject(newProject);
    setShowTemplates(false);
  };

  // Update file content
  const updateFileContent = useCallback((fileId: string, content: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.map((f) => (f.id === fileId ? { ...f, content } : f)),
      };
    });
  }, []);

  // Add new file
  const addFile = () => {
    if (!project || !newFileName.trim()) return;
    const name = newFileName.trim();
    const newFile: BuilderFile = {
      id: generateFileId(),
      name,
      path: name,
      content: "",
      language: getLanguage(name),
    };
    setProject((prev) => ({
      ...prev!,
      files: [...prev!.files, newFile],
      activeFileId: newFile.id,
    }));
    setNewFileName("");
    setAddingFile(false);
  };

  // Delete file
  const deleteFile = (fileId: string) => {
    if (!project) return;
    const newFiles = project.files.filter((f) => f.id !== fileId);
    setProject({
      ...project,
      files: newFiles,
      activeFileId: newFiles.length > 0 ? newFiles[0].id : "",
    });
  };

  // Handle AI-generated files
  const handleAIFiles = (files: Omit<BuilderFile, "id">[], description: string) => {
    const newFiles = files.map((f) => ({ ...f, id: generateFileId() }));

    if (project) {
      // Merge with existing project - replace files with same name or add new
      const existingNames = new Set(project.files.map((f) => f.name));
      const merged = [...project.files];
      for (const f of newFiles) {
        if (existingNames.has(f.name)) {
          const idx = merged.findIndex((ef) => ef.name === f.name);
          merged[idx] = f;
        } else {
          merged.push(f);
        }
      }
      setProject({
        ...project,
        files: merged,
        activeFileId: newFiles[0].id,
        name: description.slice(0, 50),
      });
    } else {
      // Create new project
      const newProject: BuilderProject = {
        id: generateProjectId(),
        name: description.slice(0, 50),
        template: "ai-generated",
        files: newFiles,
        activeFileId: newFiles[0].id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProject(newProject);
      setShowTemplates(false);
    }
  };

  // Export project as downloadable files
  const exportProject = () => {
    if (!project) return;
    // Simple download: create a zip-like structure by downloading the main HTML
    const htmlFile = project.files.find((f) => f.name.endsWith(".html"));
    if (htmlFile) {
      const blob = new Blob([assemblePreviewHTML(project.files)], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.html";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Download the active file
      const activeFile = project.files.find((f) => f.id === project.activeFileId);
      if (activeFile) {
        const blob = new Blob([activeFile.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = activeFile.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  // Download all files as individual downloads
  const downloadAllFiles = () => {
    if (!project) return;
    for (const file of project.files) {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const activeFile = project?.files.find((f) => f.id === project.activeFileId) || null;

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("hf_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("hf_theme", "light");
    }
  };

  // ==================== TEMPLATE GALLERY ====================
  if (showTemplates && !project) {
    return (
      <div className={`h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`} dir="rtl">
        {/* Header */}
        <header className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white/80"} backdrop-blur-sm`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
              FS
            </div>
            <div>
              <h1 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Full-Stack Builder
              </h1>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                أنشئ تطبيقاتك بالذكاء الاصطناعي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}>
              {isDark ? "☀️" : "🌙"}
            </button>
            <button onClick={onBack} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
              ← المحادثة
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* AI Quick Start */}
          <div className={`rounded-2xl border p-6 mb-8 ${isDark ? "bg-gradient-to-br from-violet-900/30 to-purple-900/20 border-violet-800/50" : "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200"}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">🤖</div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  أنشئ بالذكاء الاصطناعي
                </h2>
                <p className={`text-sm ${isDark ? "text-violet-300" : "text-violet-600"}`}>
                  صِف مشروعك وسيتم إنشاؤه تلقائياً
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "تطبيق إدارة مهام",
                "صفحة متجر إلكتروني",
                "لوحة تحكم إدارية",
                "لعبة بسيطة",
                "موقع شخصي",
                "API خادم REST",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    const tempProject: BuilderProject = {
                      id: generateProjectId(),
                      name: prompt,
                      template: "ai-generated",
                      files: [],
                      activeFileId: "",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setProject(tempProject);
                    setShowTemplates(false);
                    setRightPanel("ai");
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? "bg-violet-800/40 text-violet-300 hover:bg-violet-800/60 border border-violet-700/50" : "bg-white text-violet-700 hover:bg-violet-100 border border-violet-200"} hover:shadow-lg`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Template Grid */}
          <h2 className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
            قوالب جاهزة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => createFromTemplate(template.id)}
                className={`text-right p-5 rounded-2xl border-2 transition-all hover:shadow-lg ${isDark ? "bg-slate-900 border-slate-800 hover:border-violet-600" : "bg-white border-slate-200 hover:border-violet-400"}`}
              >
                <div className="text-3xl mb-3">{template.icon}</div>
                <h3 className={`font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
                  {template.name}
                </h3>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {template.description}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}>
                    {template.category === "frontend" ? "واجهة أمامية" :
                     template.category === "fullstack" ? "كامل" :
                     template.category === "api" ? "خادم API" : "ثابت"}
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    {template.files.length} ملفات
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Saved Projects */}
          {savedProjects.length > 0 && (
            <>
              <h2 className={`text-lg font-bold mt-8 mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                مشاريع محفوظة
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedProjects.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => { setProject(sp); setShowTemplates(false); }}
                    className={`text-right p-4 rounded-xl border transition-all ${isDark ? "bg-slate-900 border-slate-800 hover:border-orange-500" : "bg-white border-slate-200 hover:border-orange-400"}`}
                  >
                    <h3 className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{sp.name}</h3>
                    <p className={`text-[10px] mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      {sp.files.length} ملفات · {new Date(sp.updatedAt).toLocaleDateString("ar-SA")}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ==================== MAIN BUILDER UI ====================
  return (
    <div className={`flex h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      {/* Left Sidebar - File Tree */}
      <aside className={`w-56 flex flex-col border-l ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        {/* Sidebar Header */}
        <div className={`p-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                FS
              </div>
              <span className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                Builder
              </span>
            </div>
            <button onClick={onBack} className={`text-xs ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTemplates(true)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} transition`}
            >
              + مشروع جديد
            </button>
            <button
              onClick={saveProject}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-violet-600/20 text-violet-400 hover:bg-violet-600/30" : "bg-violet-100 text-violet-600 hover:bg-violet-200"} transition`}
              title="حفظ"
            >
              💾
            </button>
          </div>
        </div>

        {/* Project name */}
        {project && (
          <div className={`px-3 py-2 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <input
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              className={`w-full text-sm font-medium bg-transparent border-0 focus:outline-none ${isDark ? "text-white" : "text-gray-900"}`}
            />
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2">
          {project?.files.map((file) => (
            <div
              key={file.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                file.id === project.activeFileId
                  ? isDark ? "bg-violet-600/20 text-violet-300" : "bg-violet-50 text-violet-700"
                  : isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-gray-900"
              }`}
              onClick={() => setProject({ ...project, activeFileId: file.id })}
            >
              <FileIcon name={file.name} />
              <span className="text-xs flex-1 truncate">{file.name}</span>
              {project.files.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 text-[10px] transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add file */}
          {addingFile ? (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addFile(); if (e.key === "Escape") { setAddingFile(false); setNewFileName(""); } }}
                placeholder="filename.ext"
                autoFocus
                className={`flex-1 text-xs px-2 py-1 rounded border ${isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-violet-500`}
              />
              <button onClick={addFile} className="text-xs text-green-500 hover:text-green-400">✓</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingFile(true)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"} transition`}
            >
              + ملف جديد
            </button>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"} space-y-2`}>
          <div className="flex items-center gap-1">
            <button
              onClick={exportProject}
              disabled={!project}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-orange-600/20 text-orange-400 hover:bg-orange-600/30" : "bg-orange-100 text-orange-600 hover:bg-orange-200"} transition disabled:opacity-30`}
            >
              📥 تحميل HTML
            </button>
            <button
              onClick={downloadAllFiles}
              disabled={!project}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"} transition disabled:opacity-30`}
            >
              📦 كل الملفات
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {project?.files.length || 0} ملفات
            </span>
            <button
              onClick={toggleTheme}
              className={`p-1 rounded text-xs ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"} backdrop-blur-sm`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === "editor" ? (isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-100 text-violet-600") : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-gray-900")}`}
            >
              📝 محرر
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === "preview" ? (isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-100 text-violet-600") : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-gray-900")}`}
            >
              👁️ معاينة
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === "ai" ? (isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-100 text-violet-600") : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-gray-900")}`}
            >
              🤖 AI
            </button>
            <button
              onClick={() => setActiveTab("deploy")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === "deploy" ? (isDark ? "bg-emerald-600/20 text-emerald-400" : "bg-emerald-100 text-emerald-600") : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-gray-900")}`}
            >
              🚀 نشر
            </button>
          </div>

          {/* Right panel toggle (for desktop split view) */}
          <div className="hidden md:flex items-center gap-2">
            <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>اللوحة اليمنى:</span>
            <button
              onClick={() => setRightPanel("preview")}
              className={`px-2 py-1 rounded text-[10px] ${rightPanel === "preview" ? (isDark ? "bg-emerald-600/20 text-emerald-400" : "bg-emerald-100 text-emerald-600") : (isDark ? "text-slate-500" : "text-slate-400")}`}
            >
              معاينة
            </button>
            <button
              onClick={() => setRightPanel("ai")}
              className={`px-2 py-1 rounded text-[10px] ${rightPanel === "ai" ? (isDark ? "bg-orange-600/20 text-orange-400" : "bg-orange-100 text-orange-600") : (isDark ? "text-slate-500" : "text-slate-400")}`}
            >
              AI
            </button>
            <button
              onClick={() => setRightPanel("deploy")}
              className={`px-2 py-1 rounded text-[10px] ${rightPanel === "deploy" ? (isDark ? "bg-emerald-600/20 text-emerald-400" : "bg-emerald-100 text-emerald-600") : (isDark ? "text-slate-500" : "text-slate-400")}`}
            >
              نشر
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Mobile: show active tab */}
          <div className={`${activeTab === "editor" ? "flex-1" : "hidden md:flex-1"} flex flex-col ${isDark ? "bg-[#1e1e2e]" : "bg-white"}`}>
            <CodeEditor
              file={activeFile}
              onChange={(content) => {
                if (activeFile) {
                  updateFileContent(activeFile.id, content);
                }
              }}
              isDark={isDark}
            />
          </div>

          {/* Right panel (desktop: always visible, mobile: tab-based) */}
          <div className={`${activeTab === "editor" ? "hidden md:flex" : "flex-1"} ${isDark ? "border-slate-800" : "border-slate-200"} border-r flex flex-col w-full md:w-[45%]`}>
            {activeTab === "deploy" || rightPanel === "deploy" ? (
              <DeploymentHub
                project={project}
                isDark={isDark}
                onClose={() => { setRightPanel("preview"); setActiveTab("editor"); }}
              />
            ) : rightPanel === "preview" ? (
              <PreviewPanel
                files={project?.files || []}
                isDark={isDark}
                viewMode={viewMode}
              />
            ) : (
              <AIChatPanel
                isDark={isDark}
                onFilesGenerated={handleAIFiles}
                siteSettings={siteSettings || { hf_space_url: "https://router.huggingface.co", hf_api_path: "/v1/chat/completions", hf_api_token: "", hf_model: "Qwen/Qwen3-14B" } as SiteSettings}
                selectedModel={selectedModel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
