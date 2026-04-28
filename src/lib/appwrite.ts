"use client";

import { Client, Account, Databases, Storage, ID, Query, OAuthProvider } from "appwrite";

// ==================== Appwrite Configuration ====================

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69f0f89f003186d816ca";
// Note: API key should NOT be exposed client-side. Use server-side endpoints for admin operations.
// For client-side SDK, only project ID is needed.

// ==================== Database IDs ====================

export const DATABASE_ID = "hf_space_chat";
export const COLLECTIONS = {
  PROFILES: "profiles",
  CHAT_SESSIONS: "chat_sessions",
  CHAT_MESSAGES: "chat_messages",
  SITE_SETTINGS: "site_settings",
  PROJECTS: "projects",
  DEPLOYMENTS: "deployments",
};

// ==================== Client Setup ====================

let _client: Client | null = null;
let _account: Account | null = null;
let _db: Databases | null = null;
let _storage: Storage | null = null;

function initAppwrite(): { client: Client; account: Account; db: Databases; storage: Storage } | null {
  if (typeof window === "undefined") return null;

  try {
    if (!_client) {
      _client = new Client();
      _client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

      _account = new Account(_client);
      _db = new Databases(_client);
      _storage = new Storage(_client);
    }

    return {
      client: _client,
      account: _account!,
      db: _db!,
      storage: _storage!,
    };
  } catch (error) {
    console.warn("[Appwrite] Initialization failed:", error);
    return null;
  }
}

export const getAppwrite = initAppwrite;

// Dynamic check - avoids SSR issues (getAppwrite returns null on server)
export function getIsAppwriteConfigured(): boolean {
  return !!getAppwrite();
}
// Note: isAppwriteConfigured is removed to avoid stale static value.
// Always use getIsAppwriteConfigured() instead.

// ==================== Connection Check ====================

let _appwriteConnected: boolean | null = null;

export async function checkAppwriteConnection(): Promise<boolean> {
  const appwrite = getAppwrite();
  if (!appwrite) return false;

  try {
    // Try to get the current account - if it fails with 401, Appwrite is reachable but user not logged in
    await appwrite.account.get();
    _appwriteConnected = true;
    return true;
  } catch (error: unknown) {
    const appwriteError = error as { code?: number; type?: string };
    // 401 = reachable but not authenticated (that's fine, means Appwrite is up)
    // 0 = network error (not reachable)
    if (appwriteError?.code === 401 || appwriteError?.type === "user_unauthorized") {
      _appwriteConnected = true;
      return true;
    }
    // Try alternative check via database list
    try {
      await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.SITE_SETTINGS, [Query.limit(1)]);
      _appwriteConnected = true;
      return true;
    } catch (dbError: unknown) {
      const dbErr = dbError as { code?: number };
      // If we get a 401/403 from DB, Appwrite is reachable
      if (dbErr?.code === 401 || dbErr?.code === 403) {
        _appwriteConnected = true;
        return true;
      }
      _appwriteConnected = false;
      return false;
    }
  }
}

export function getAppwriteConnectionStatus(): boolean | null {
  return _appwriteConnected;
}

// ==================== Auth API ====================

export const appwriteAuth = {
  async signIn(email: string, password: string): Promise<{ user: AppwriteUser | null; error: string | null }> {
    const appwrite = getAppwrite();
    if (!appwrite) return { user: null, error: "Appwrite غير متاح" };

    try {
      await appwrite.account.createEmailPasswordSession(email, password);
      const account = await appwrite.account.get();
      return { user: mapAppwriteUser(account), error: null };
    } catch (error: unknown) {
      const appwriteError = error as { message?: string; code?: number };
      const msg = appwriteError?.message || "فشل تسجيل الدخول";
      if (msg.includes("Invalid credentials") || msg.includes("user_invalid_credentials")) {
        return { user: null, error: "بيانات الدخول غير صحيحة" };
      }
      if (msg.includes("not found") || msg.includes("user_not_found")) {
        return { user: null, error: "الحساب غير موجود. يرجى إنشاء حساب جديد." };
      }
      return { user: null, error: msg };
    }
  },

  async signUp(email: string, password: string, name: string): Promise<{ user: AppwriteUser | null; error: string | null }> {
    const appwrite = getAppwrite();
    if (!appwrite) return { user: null, error: "Appwrite غير متاح" };

    try {
      await appwrite.account.create(ID.unique(), email, password, name);
      // Auto sign in after sign up
      await appwrite.account.createEmailPasswordSession(email, password);
      const account = await appwrite.account.get();
      // Create profile document
      await appwrite.db.createDocument(DATABASE_ID, COLLECTIONS.PROFILES, account.$id, {
        email: account.email,
        display_name: name || account.email.split("@")[0],
        role: "user",
        avatar_url: "",
        bio: "",
        phone: "",
        website: "",
        location: "",
        language_preference: "ar",
        theme_preference: "system",
        notifications_enabled: true,
      });
      return { user: mapAppwriteUser(account), error: null };
    } catch (error: unknown) {
      const appwriteError = error as { message?: string; code?: number };
      const msg = appwriteError?.message || "فشل إنشاء الحساب";
      if (msg.includes("already exists") || msg.includes("user_already_exists")) {
        return { user: null, error: "هذا البريد الإلكتروني مسجل مسبقاً" };
      }
      return { user: null, error: msg };
    }
  },

  async signOut(): Promise<void> {
    const appwrite = getAppwrite();
    if (!appwrite) return;
    try {
      await appwrite.account.deleteSession("current");
    } catch {}
  },

  async getSession(): Promise<AppwriteUser | null> {
    const appwrite = getAppwrite();
    if (!appwrite) return null;
    try {
      const account = await appwrite.account.get();
      return mapAppwriteUser(account);
    } catch {
      return null;
    }
  },

  async updatePassword(oldPassword: string, newPassword: string): Promise<{ error: string | null }> {
    const appwrite = getAppwrite();
    if (!appwrite) return { error: "Appwrite غير متاح" };
    try {
      await appwrite.account.updatePassword(newPassword, oldPassword);
      return { error: null };
    } catch (error: unknown) {
      const appwriteError = error as { message?: string };
      return { error: appwriteError?.message || "فشل تحديث كلمة المرور" };
    }
  },

  async oauthLogin(provider: "google" | "github" | "discord"): Promise<void> {
    const appwrite = getAppwrite();
    if (!appwrite) return;
    const providerMap: Record<string, string> = {
      google: OAuthProvider.Google,
      github: OAuthProvider.Github,
      discord: OAuthProvider.Discord,
    };
    appwrite.account.createOAuth2Session(
      providerMap[provider] as OAuthProvider,
      typeof window !== "undefined" ? window.location.origin : "",
      typeof window !== "undefined" ? window.location.origin : ""
    );
  },
};

// ==================== Database API ====================

export const appwriteDB = {
  // Profiles
  async getProfile(userId: string): Promise<Record<string, unknown> | null> {
    const appwrite = getAppwrite();
    if (!appwrite) return null;
    try {
      return await appwrite.db.getDocument(DATABASE_ID, COLLECTIONS.PROFILES, userId);
    } catch {
      return null;
    }
  },

  async updateProfile(userId: string, data: Record<string, unknown>): Promise<boolean> {
    const appwrite = getAppwrite();
    if (!appwrite) return false;
    try {
      await appwrite.db.updateDocument(DATABASE_ID, COLLECTIONS.PROFILES, userId, data);
      return true;
    } catch {
      return false;
    }
  },

  // Site Settings
  async getSettings(): Promise<Record<string, string>> {
    const appwrite = getAppwrite();
    if (!appwrite) return {};
    try {
      const result = await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.SITE_SETTINGS, [Query.limit(100)]);
      const settings: Record<string, string> = {};
      result.documents.forEach((doc: Record<string, unknown>) => {
        if (doc.key && doc.value) {
          settings[doc.key as string] = doc.value as string;
        }
      });
      return settings;
    } catch {
      return {};
    }
  },

  async saveSetting(key: string, value: string): Promise<boolean> {
    const appwrite = getAppwrite();
    if (!appwrite) return false;
    try {
      // Try to find existing setting
      const result = await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.SITE_SETTINGS, [
        Query.equal("key", key),
        Query.limit(1),
      ]);
      if (result.documents.length > 0) {
        await appwrite.db.updateDocument(DATABASE_ID, COLLECTIONS.SITE_SETTINGS, result.documents[0].$id, { value });
      } else {
        await appwrite.db.createDocument(DATABASE_ID, COLLECTIONS.SITE_SETTINGS, ID.unique(), { key, value });
      }
      return true;
    } catch {
      return false;
    }
  },

  // Chat Sessions
  async getChatSessions(userId: string): Promise<unknown[]> {
    const appwrite = getAppwrite();
    if (!appwrite) return [];
    try {
      const result = await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, [
        Query.equal("user_id", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
      return result.documents;
    } catch {
      return [];
    }
  },

  async createChatSession(userId: string, name: string): Promise<unknown | null> {
    const appwrite = getAppwrite();
    if (!appwrite) return null;
    try {
      return await appwrite.db.createDocument(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, ID.unique(), {
        user_id: userId,
        name,
      });
    } catch {
      return null;
    }
  },

  async deleteChatSession(sessionId: string): Promise<boolean> {
    const appwrite = getAppwrite();
    if (!appwrite) return false;
    try {
      await appwrite.db.deleteDocument(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, sessionId);
      return true;
    } catch {
      return false;
    }
  },

  // Chat Messages
  async getChatMessages(sessionId: string): Promise<unknown[]> {
    const appwrite = getAppwrite();
    if (!appwrite) return [];
    try {
      const result = await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
        Query.equal("session_id", sessionId),
        Query.orderAsc("$createdAt"),
        Query.limit(500),
      ]);
      return result.documents;
    } catch {
      return [];
    }
  },

  async addChatMessage(sessionId: string, role: string, content: string): Promise<unknown | null> {
    const appwrite = getAppwrite();
    if (!appwrite) return null;
    try {
      return await appwrite.db.createDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, ID.unique(), {
        session_id: sessionId,
        role,
        content,
      });
    } catch {
      return null;
    }
  },

  // Storage
  async uploadFile(bucketId: string, file: File): Promise<string | null> {
    const appwrite = getAppwrite();
    if (!appwrite) return null;
    try {
      const result = await appwrite.storage.createFile(bucketId, ID.unique(), file);
      return result.$id;
    } catch {
      return null;
    }
  },

  getFilePreview(bucketId: string, fileId: string): string {
    const appwrite = getAppwrite();
    if (!appwrite) return "";
    try {
      return appwrite.storage.getFilePreview(bucketId, fileId);
    } catch {
      return "";
    }
  },
};

// ==================== Types ====================

export interface AppwriteUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  provider: string;
  email_verified: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAppwriteUser(account: any): AppwriteUser {
  return {
    id: account.$id || "",
    email: account.email || "",
    name: account.name || "",
    role: "user",
    created_at: account.registration || account.$createdAt || new Date().toISOString(),
    provider: account.provider || account.prefs?.provider || "email",
    email_verified: account.emailVerification ?? account.email_verified ?? false,
  };
}

// ==================== Setup Database ====================

export async function setupAppwriteDatabase(): Promise<{ success: boolean; error: string | null }> {
  // This would normally be done server-side or via Appwrite Console
  // Here we just verify the database and collections exist
  const appwrite = getAppwrite();
  if (!appwrite) return { success: false, error: "Appwrite غير متاح" };

  try {
    await appwrite.db.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [Query.limit(1)]);
    return { success: true, error: null };
  } catch (error: unknown) {
    const appwriteError = error as { message?: string; code?: number };
    return {
      success: false,
      error: `قاعدة البيانات غير متاحة: ${appwriteError?.message || "خطأ غير معروف"}. يرجى إنشاء قاعدة البيانات والمجموعات من لوحة تحكم Appwrite.`,
    };
  }
}
