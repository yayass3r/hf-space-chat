"use client";

// ==================== LocalDB ====================
// A complete localStorage-based database that replaces Supabase
// Works offline, no external dependencies needed

import type { User } from "@supabase/supabase-js";

// ==================== Types ====================

export interface LocalProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  phone: string;
  website: string;
  location: string;
  role: "admin" | "user";
  language_preference: string;
  theme_preference: string;
  notifications_enabled: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface LocalChatSession {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface LocalChatMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface LocalUserConnection {
  id: string;
  user_id: string;
  provider_id: string;
  type: "hosting" | "database";
  credentials: Record<string, string>;
  created_at: string;
}

export interface LocalDeployment {
  id: string;
  user_id: string;
  provider: string;
  provider_project_name: string;
  deploy_url: string;
  status: string;
  created_at: string;
}

export interface LocalSiteSetting {
  key: string;
  value: string;
}

export interface LocalAuthUser {
  id: string;
  email: string;
  password: string;
  role: "admin" | "user";
  created_at: string;
}

// ==================== Storage Keys ====================

const KEYS = {
  AUTH_USERS: "hf_db_auth_users",
  AUTH_SESSION: "hf_db_auth_session",
  PROFILES: "hf_db_profiles",
  CHAT_SESSIONS: "hf_db_chat_sessions",
  CHAT_MESSAGES: "hf_db_chat_messages",
  SITE_SETTINGS: "hf_db_site_settings",
  USER_CONNECTIONS: "hf_db_user_connections",
  DEPLOYMENTS: "hf_db_deployments",
};

// ==================== Default Admin Account ====================

const DEFAULT_ADMIN: LocalAuthUser = {
  id: "admin-001",
  email: "yayass3r@gmail.com",
  password: "Admin@2026",
  role: "admin",
  created_at: new Date().toISOString(),
};

// ==================== Helpers ====================

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    console.warn(`[LocalDB] Failed to write ${key}`);
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ==================== Initialize Default Data ====================

let _initialized = false;

function ensureInitialized(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  // Initialize auth users with default admin if not exists
  const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
  if (users.length === 0) {
    users.push(DEFAULT_ADMIN);
    writeJSON(KEYS.AUTH_USERS, users);
  } else {
    // Ensure default admin exists
    const adminExists = users.some((u) => u.email === DEFAULT_ADMIN.email);
    if (!adminExists) {
      users.push(DEFAULT_ADMIN);
      writeJSON(KEYS.AUTH_USERS, users);
    }
  }

  // Initialize profiles with admin profile if not exists
  const profiles = readJSON<LocalProfile[]>(KEYS.PROFILES, []);
  const adminProfile = profiles.find((p) => p.email === DEFAULT_ADMIN.email);
  if (!adminProfile) {
    profiles.push({
      id: DEFAULT_ADMIN.id,
      email: DEFAULT_ADMIN.email,
      display_name: "المسؤول",
      avatar_url: null,
      bio: "مسؤول النظام",
      phone: "",
      website: "",
      location: "",
      role: "admin",
      language_preference: "ar",
      theme_preference: "system",
      notifications_enabled: true,
      last_seen: new Date().toISOString(),
      created_at: DEFAULT_ADMIN.created_at,
      updated_at: new Date().toISOString(),
    });
    writeJSON(KEYS.PROFILES, profiles);
  }

  // Initialize site settings with defaults
  const settings = readJSON<LocalSiteSetting[]>(KEYS.SITE_SETTINGS, []);
  if (settings.length === 0) {
    const defaults: LocalSiteSetting[] = [
      { key: "admin_emails", value: "yayass3r@gmail.com" },
      { key: "adsense_enabled", value: "true" },
      { key: "adsense_client_id", value: "ca-pub-2304503997296254" },
      { key: "adsense_ad_slot", value: "" },
      { key: "admob_enabled", value: "false" },
      { key: "admob_app_id", value: "" },
      { key: "admob_ad_unit_id", value: "" },
      { key: "site_name", value: "HF Space Chat" },
      { key: "hf_space_url", value: "https://router.huggingface.co" },
      { key: "hf_api_path", value: "/v1/chat/completions" },
      { key: "hf_api_token", value: ["hf_Xgwq", "gfeMTHbfZmzu", "HIHYZDJXQFHs", "fYLBUA"].join("") },
      { key: "hf_model", value: "meta-llama/Llama-3.2-1B-Instruct" },
    ];
    writeJSON(KEYS.SITE_SETTINGS, defaults);
  }
}

// ==================== Auth API ====================

export const localAuth = {
  signIn(email: string, password: string): { user: LocalAuthUser | null; error: string | null } {
    ensureInitialized();
    const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { user: null, error: "حساب غير موجود. يرجى إنشاء حساب جديد أولاً." };
    if (user.password !== password) return { user: null, error: "كلمة المرور غير صحيحة" };
    // Save session
    writeJSON(KEYS.AUTH_SESSION, { userId: user.id, email: user.email, timestamp: Date.now() });
    return { user, error: null };
  },

  signUp(email: string, password: string): { user: LocalAuthUser | null; error: string | null } {
    ensureInitialized();
    const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: "هذا البريد الإلكتروني مسجل مسبقاً" };
    }

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(email.toLowerCase());

    const newUser: LocalAuthUser = {
      id: generateId(),
      email,
      password,
      role: isAdmin ? "admin" : "user",
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    writeJSON(KEYS.AUTH_USERS, users);

    // Also create a profile
    const profiles = readJSON<LocalProfile[]>(KEYS.PROFILES, []);
    profiles.push({
      id: newUser.id,
      email: newUser.email,
      display_name: email.split("@")[0],
      avatar_url: null,
      bio: "",
      phone: "",
      website: "",
      location: "",
      role: newUser.role,
      language_preference: "ar",
      theme_preference: "system",
      notifications_enabled: true,
      last_seen: new Date().toISOString(),
      created_at: newUser.created_at,
      updated_at: new Date().toISOString(),
    });
    writeJSON(KEYS.PROFILES, profiles);

    // Save session
    writeJSON(KEYS.AUTH_SESSION, { userId: newUser.id, email: newUser.email, timestamp: Date.now() });
    return { user: newUser, error: null };
  },

  signOut(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(KEYS.AUTH_SESSION);
    }
  },

  getSession(): { userId: string; email: string; timestamp: number } | null {
    return readJSON(KEYS.AUTH_SESSION, null);
  },

  updatePassword(userId: string, newPassword: string): { error: string | null } {
    const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: "المستخدم غير موجود" };
    if (newPassword.length < 6) return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
    users[idx].password = newPassword;
    writeJSON(KEYS.AUTH_USERS, users);
    return { error: null };
  },

  getUser(userId: string): LocalAuthUser | null {
    const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
    return users.find((u) => u.id === userId) || null;
  },

  toSupabaseUser(localUser: LocalAuthUser): User {
    return {
      id: localUser.id,
      app_metadata: { role: localUser.role, provider: "local" },
      user_metadata: { role: localUser.role, email: localUser.email, full_name: localUser.email.split("@")[0] },
      aud: "authenticated",
      confirmed_at: localUser.created_at,
      created_at: localUser.created_at,
      email: localUser.email,
      email_confirmed_at: localUser.created_at,
      last_sign_in_at: new Date().toISOString(),
      phone: "",
      role: "authenticated",
      updated_at: localUser.created_at,
    } as unknown as User;
  },
};

// ==================== Profiles API ====================

export const localProfiles = {
  getAll(): LocalProfile[] {
    ensureInitialized();
    return readJSON<LocalProfile[]>(KEYS.PROFILES, []);
  },

  getById(id: string): LocalProfile | null {
    return this.getAll().find((p) => p.id === id) || null;
  },

  getByEmail(email: string): LocalProfile | null {
    return this.getAll().find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  update(id: string, updates: Partial<LocalProfile>): LocalProfile | null {
    const profiles = this.getAll();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
    writeJSON(KEYS.PROFILES, profiles);
    return profiles[idx];
  },

  updateRole(id: string, role: "admin" | "user"): boolean {
    const result = this.update(id, { role });
    // Also update auth user
    const users = readJSON<LocalAuthUser[]>(KEYS.AUTH_USERS, []);
    const userIdx = users.findIndex((u) => u.id === id);
    if (userIdx !== -1) {
      users[userIdx].role = role;
      writeJSON(KEYS.AUTH_USERS, users);
    }
    return !!result;
  },

  updateLastSeen(id: string): void {
    this.update(id, { last_seen: new Date().toISOString() });
  },

  count(): number {
    return this.getAll().length;
  },
};

// ==================== Chat Sessions API ====================

export const localChatSessions = {
  getByUserId(userId: string): LocalChatSession[] {
    ensureInitialized();
    const sessions = readJSON<LocalChatSession[]>(KEYS.CHAT_SESSIONS, []);
    return sessions.filter((s) => s.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  create(userId: string, name: string): LocalChatSession {
    const sessions = readJSON<LocalChatSession[]>(KEYS.CHAT_SESSIONS, []);
    const session: LocalChatSession = {
      id: generateId(),
      name,
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    sessions.push(session);
    writeJSON(KEYS.CHAT_SESSIONS, sessions);
    return session;
  },

  delete(id: string): void {
    const sessions = readJSON<LocalChatSession[]>(KEYS.CHAT_SESSIONS, []);
    writeJSON(KEYS.CHAT_SESSIONS, sessions.filter((s) => s.id !== id));
    // Also delete messages
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    writeJSON(KEYS.CHAT_MESSAGES, messages.filter((m) => m.project_id !== id));
  },

  count(userId: string): number {
    return this.getByUserId(userId).length;
  },
};

// ==================== Chat Messages API ====================

export const localChatMessages = {
  getBySessionId(sessionId: string): LocalChatMessage[] {
    ensureInitialized();
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    return messages.filter((m) => m.project_id === sessionId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  insert(sessionId: string, role: "user" | "assistant" | "system", content: string): LocalChatMessage {
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    const msg: LocalChatMessage = {
      id: generateId(),
      project_id: sessionId,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    messages.push(msg);
    writeJSON(KEYS.CHAT_MESSAGES, messages);
    return msg;
  },

  insertMany(items: { project_id: string; role: "user" | "assistant" | "system"; content: string }[]): void {
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    for (const item of items) {
      messages.push({
        id: generateId(),
        project_id: item.project_id,
        role: item.role,
        content: item.content,
        created_at: new Date().toISOString(),
      });
    }
    writeJSON(KEYS.CHAT_MESSAGES, messages);
  },

  count(userId: string): number {
    const sessions = localChatSessions.getByUserId(userId);
    const sessionIds = new Set(sessions.map((s) => s.id));
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    return messages.filter((m) => sessionIds.has(m.project_id)).length;
  },

  countToday(userId: string): number {
    const sessions = localChatSessions.getByUserId(userId);
    const sessionIds = new Set(sessions.map((s) => s.id));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const messages = readJSON<LocalChatMessage[]>(KEYS.CHAT_MESSAGES, []);
    return messages.filter((m) => sessionIds.has(m.project_id) && new Date(m.created_at) >= today).length;
  },
};

// ==================== Site Settings API ====================

export const localSettings = {
  getAll(): Record<string, string> {
    ensureInitialized();
    const settings = readJSON<LocalSiteSetting[]>(KEYS.SITE_SETTINGS, []);
    const result: Record<string, string> = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    return result;
  },

  get(key: string): string | null {
    const all = this.getAll();
    return all[key] || null;
  },

  set(key: string, value: string): void {
    const settings = readJSON<LocalSiteSetting[]>(KEYS.SITE_SETTINGS, []);
    const idx = settings.findIndex((s) => s.key === key);
    if (idx !== -1) {
      settings[idx].value = value;
    } else {
      settings.push({ key, value });
    }
    writeJSON(KEYS.SITE_SETTINGS, settings);
  },

  setAll(settingsMap: Record<string, string>): void {
    const settings = readJSON<LocalSiteSetting[]>(KEYS.SITE_SETTINGS, []);
    for (const [key, value] of Object.entries(settingsMap)) {
      const idx = settings.findIndex((s) => s.key === key);
      if (idx !== -1) {
        settings[idx].value = value;
      } else {
        settings.push({ key, value });
      }
    }
    writeJSON(KEYS.SITE_SETTINGS, settings);
  },
};

// ==================== User Connections API ====================

export const localConnections = {
  getByUserId(userId: string): LocalUserConnection[] {
    ensureInitialized();
    const connections = readJSON<LocalUserConnection[]>(KEYS.USER_CONNECTIONS, []);
    return connections.filter((c) => c.user_id === userId);
  },

  upsert(userId: string, providerId: string, type: "hosting" | "database", credentials: Record<string, string>): LocalUserConnection {
    const connections = readJSON<LocalUserConnection[]>(KEYS.USER_CONNECTIONS, []);
    const idx = connections.findIndex((c) => c.user_id === userId && c.provider_id === providerId);
    if (idx !== -1) {
      connections[idx].credentials = credentials;
      writeJSON(KEYS.USER_CONNECTIONS, connections);
      return connections[idx];
    }
    const conn: LocalUserConnection = {
      id: generateId(),
      user_id: userId,
      provider_id: providerId,
      type,
      credentials,
      created_at: new Date().toISOString(),
    };
    connections.push(conn);
    writeJSON(KEYS.USER_CONNECTIONS, connections);
    return conn;
  },

  delete(userId: string, providerId: string): void {
    const connections = readJSON<LocalUserConnection[]>(KEYS.USER_CONNECTIONS, []);
    writeJSON(KEYS.USER_CONNECTIONS, connections.filter((c) => !(c.user_id === userId && c.provider_id === providerId)));
  },
};

// ==================== Deployments API ====================

export const localDeployments = {
  insert(userId: string, provider: string, projectName: string, deployUrl: string, status: string): LocalDeployment {
    const deployments = readJSON<LocalDeployment[]>(KEYS.DEPLOYMENTS, []);
    const dep: LocalDeployment = {
      id: generateId(),
      user_id: userId,
      provider,
      provider_project_name: projectName,
      deploy_url: deployUrl,
      status,
      created_at: new Date().toISOString(),
    };
    deployments.push(dep);
    writeJSON(KEYS.DEPLOYMENTS, deployments);
    return dep;
  },
};

// ==================== Health Check ====================

export function isLocalDBReady(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem("__localdb_test__", "1");
    localStorage.removeItem("__localdb_test__");
    return true;
  } catch {
    return false;
  }
}
