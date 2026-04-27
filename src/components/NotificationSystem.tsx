"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

// ==================== Types ====================

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  autoDismiss?: boolean;
  dismissed?: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    options?: { autoDismiss?: boolean }
  ) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
}

// ==================== Constants ====================

const STORAGE_KEY = "hf_notifications";
const MAX_NOTIFICATIONS = 50;
const TOAST_AUTO_DISMISS_MS = 5000;

const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: React.ReactNode;
    gradient: string;
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    textColor: string;
    label: string;
  }
> = {
  info: {
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    gradient: "from-blue-500 to-cyan-400",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-950/30",
    borderLight: "border-blue-200/60",
    borderDark: "dark:border-blue-800/30",
    textColor: "text-blue-600 dark:text-blue-400",
    label: "معلومات",
  },
  success: {
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    gradient: "from-emerald-500 to-teal-400",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950/30",
    borderLight: "border-emerald-200/60",
    borderDark: "dark:border-emerald-800/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    label: "نجاح",
  },
  warning: {
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
    ),
    gradient: "from-amber-500 to-yellow-400",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950/30",
    borderLight: "border-amber-200/60",
    borderDark: "dark:border-amber-800/30",
    textColor: "text-amber-600 dark:text-amber-400",
    label: "تحذير",
  },
  error: {
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    gradient: "from-red-500 to-rose-400",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-950/30",
    borderLight: "border-red-200/60",
    borderDark: "dark:border-red-800/30",
    textColor: "text-red-600 dark:text-red-400",
    label: "خطأ",
  },
};

// ==================== Helpers ====================

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    // Filter out auto-dismissed toasts (they shouldn't persist)
    return parsed.filter((n) => !n.dismissed).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]): void {
  if (typeof window === "undefined") return;
  try {
    const toSave = notifications
      .filter((n) => !n.dismissed)
      .slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // localStorage might be full or unavailable
  }
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  return new Date(timestamp).toLocaleDateString("ar-SA");
}

// ==================== Context ====================

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ==================== Provider ====================

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    setNotifications(stored);
  }, []);

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      saveToStorage(notifications);
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      options?: { autoDismiss?: boolean }
    ): string => {
      const id = generateId();
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
        autoDismiss: options?.autoDismiss ?? false,
        dismissed: false,
      };

      setNotifications((prev) => {
        const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
        saveToStorage(updated);
        return updated;
      });

      // Show as toast
      setToasts((prev) => [...prev, notification]);

      // Auto-dismiss toast after timeout
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        if (notification.autoDismiss) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
          );
        }
        toastTimersRef.current.delete(id);
      }, TOAST_AUTO_DISMISS_MS);

      toastTimersRef.current.set(id, timer);

      return id;
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
    // Clear all toast timers
    toastTimersRef.current.forEach((timer) => clearTimeout(timer));
    toastTimersRef.current.clear();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveToStorage(updated);
      return updated;
    });
    // Also remove from toasts if present
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification,
      }}
    >
      {children}
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={removeNotification} />
    </NotificationContext.Provider>
  );
}

// ==================== Hook ====================

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return ctx;
}

// ==================== Automatic Notification Generators ====================

export function notifyNewChatSession(
  addNotification: NotificationContextValue["addNotification"],
  sessionName?: string
) {
  addNotification(
    "info",
    "محادثة جديدة",
    `تم إنشاء جلسة محادثة${sessionName ? `: ${sessionName}` : ""} بنجاح`
  );
}

export function notifyDeploymentStatus(
  addNotification: NotificationContextValue["addNotification"],
  status: "started" | "completed" | "failed",
  projectName?: string
) {
  const name = projectName ? `: ${projectName}` : "";
  switch (status) {
    case "started":
      addNotification(
        "info",
        "جاري النشر",
        `بدأ نشر المشروع${name}...`
      );
      break;
    case "completed":
      addNotification(
        "success",
        "تم النشر بنجاح",
        `تم نشر المشروع${name} بنجاح وهو متاح الآن`
      );
      break;
    case "failed":
      addNotification(
        "error",
        "فشل النشر",
        `فشل نشر المشروع${name}. يرجى المحاولة مرة أخرى`
      );
      break;
  }
}

export function notifySystemUpdate(
  addNotification: NotificationContextValue["addNotification"],
  updateMessage: string
) {
  addNotification("warning", "تحديث النظام", updateMessage);
}

export function notifyLoginEvent(
  addNotification: NotificationContextValue["addNotification"],
  userName?: string
) {
  addNotification(
    "success",
    "تسجيل الدخول",
    `مرحباً بعودتك${userName ? `، ${userName}` : ""}! تم تسجيل الدخول بنجاح`
  );
}

// ==================== Toast Container ====================

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Notification[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[100] flex flex-col gap-2 pointer-events-none"
      dir="rtl"
    >
      {toasts.map((toast) => {
        const config = NOTIFICATION_TYPE_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-in-down rounded-xl border p-3.5 shadow-xl backdrop-blur-lg ${
              config.bgLight
            } ${config.bgDark} ${config.borderLight} ${config.borderDark}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shrink-0 shadow-md`}
              >
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {toast.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors shrink-0"
                title="إغلاق"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Auto-dismiss progress bar */}
            <div className="mt-2 h-0.5 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${config.gradient} toast-progress`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== Notification Center (Bell Icon + Dropdown) ====================

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [isOpen]);

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  const filterCounts = {
    all: notifications.length,
    info: notifications.filter((n) => n.type === "info").length,
    success: notifications.filter((n) => n.type === "success").length,
    warning: notifications.filter((n) => n.type === "warning").length,
    error: notifications.filter((n) => n.type === "error").length,
  };

  return (
    <div className="relative" ref={dropdownRef} dir="rtl">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
        title="الإشعارات"
        aria-label={`الإشعارات${unreadCount > 0 ? ` (${unreadCount} غير مقروء)` : ""}`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 text-white text-[10px] font-bold shadow-lg shadow-orange-500/30 badge-glow animate-fade-in-scale">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[360px] sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl z-[90] animate-fade-in-scale overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-yellow-500/5 dark:from-orange-500/10 dark:via-amber-500/10 dark:to-yellow-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center text-white shadow-md">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    الإشعارات
                  </h3>
                  {unreadCount > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      {unreadCount} إشعار غير مقروء
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                    title="تحديد الكل كمقروء"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="مسح الكل"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-200/40 dark:border-slate-800/40 flex items-center gap-1 overflow-x-auto">
            {(
              [
                { key: "all" as const, label: "الكل" },
                { key: "info" as const, label: "معلومات" },
                { key: "success" as const, label: "نجاح" },
                { key: "warning" as const, label: "تحذير" },
                { key: "error" as const, label: "خطأ" },
              ] as const
            ).map(({ key, label }) => {
              const isActive = filter === key;
              const count = filterCounts[key];
              if (key !== "all" && count === 0 && !isActive) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-yellow-400 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`mr-1 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-2xl mb-3">
                  🔔
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  لا توجد إشعارات
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  ستظهر الإشعارات هنا عند وصولها
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const config = NOTIFICATION_TYPE_CONFIG[notification.type];
                return (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    config={config}
                    onMarkRead={markAsRead}
                    onRemove={removeNotification}
                  />
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-200/40 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-800/30">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                {notifications.length} إشعار · {unreadCount} غير مقروء
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Notification Item ====================

function NotificationItem({
  notification,
  config,
  onMarkRead,
  onRemove,
}: {
  notification: Notification;
  config: (typeof NOTIFICATION_TYPE_CONFIG)[NotificationType];
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isUnread = !notification.read;

  return (
    <div
      onClick={() => {
        if (isUnread) onMarkRead(notification.id);
      }}
      className={`group relative px-4 py-3 border-b border-slate-100/60 dark:border-slate-800/40 transition-colors cursor-pointer ${
        isUnread
          ? "bg-orange-50/40 dark:bg-orange-950/10 hover:bg-orange-50/60 dark:hover:bg-orange-950/20"
          : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
      }`}
    >
      {/* Unread indicator */}
      {isUnread && (
        <span className="absolute top-4 right-2 w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 shadow-sm shadow-orange-500/30" />
      )}

      <div className="flex items-start gap-3 pr-3">
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shrink-0 shadow-md mt-0.5`}
        >
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`text-sm font-bold truncate ${
                isUnread
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {notification.title}
            </p>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${config.bgLight} ${config.bgDark} ${config.textColor} shrink-0`}
            >
              {config.label}
            </span>
          </div>
          <p
            className={`text-xs mt-0.5 leading-relaxed ${
              isUnread
                ? "text-slate-700 dark:text-slate-300"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {notification.message}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {formatTimeAgo(notification.timestamp)}
          </p>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(notification.id);
          }}
          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
          title="حذف الإشعار"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ==================== CSS Animation for Toast Progress ====================

// This style block is injected once when the module loads
if (typeof document !== "undefined") {
  const styleId = "hf-notification-system-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes toastProgress {
        from { width: 100%; }
        to { width: 0%; }
      }
      .toast-progress {
        animation: toastProgress 5s linear forwards;
      }
      @keyframes fadeInDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-down {
        animation: fadeInDown 0.3s ease-out;
      }
      @keyframes fadeInScale {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-fade-in-scale {
        animation: fadeInScale 0.2s ease-out;
      }
    `;
    document.head.appendChild(style);
  }
}
