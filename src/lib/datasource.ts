"use client";

/**
 * Unified Data Source - Routes data operations to Appwrite or LocalDB
 * based on the current auth source.
 * 
 * CRITICAL FIX: Previously, appwriteDB was exported but never used.
 * ChatApp only used LocalDB (localStorage), meaning Appwrite Cloud
 * database was completely unused despite being set up.
 * 
 * This module provides a single API that:
 * - Uses Appwrite when authSource === "appwrite" and Appwrite is connected
 * - Falls back to LocalDB for offline/local auth
 * - Syncs data between both when possible
 */

import { appwriteDB, getIsAppwriteConfigured, checkAppwriteConnection } from "./appwrite";
import {
  localProfiles,
  localChatSessions,
  localChatMessages,
  localSettings,
  localConnections,
  localDeployments,
  type LocalProfile,
  type LocalChatSession,
  type LocalChatMessage,
} from "./localdb";
import type { UserProfile } from "./types";

// ==================== Types ====================

export type AuthSource = "supabase" | "appwrite" | "local";

export interface UnifiedChatSession {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface UnifiedChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

// ==================== Helper ====================

function shouldUseAppwrite(authSource: AuthSource): boolean {
  return authSource === "appwrite" && getIsAppwriteConfigured();
}

function mapAppwriteDocToSession(doc: Record<string, unknown>): UnifiedChatSession {
  return {
    id: doc.$id as string,
    name: doc.name as string,
    user_id: doc.user_id as string,
    created_at: (doc.$createdAt as string) || new Date().toISOString(),
  };
}

function mapAppwriteDocToMessage(doc: Record<string, unknown>): UnifiedChatMessage {
  return {
    id: doc.$id as string,
    session_id: doc.session_id as string,
    role: doc.role as "user" | "assistant" | "system",
    content: doc.content as string,
    created_at: (doc.$createdAt as string) || new Date().toISOString(),
  };
}

function mapLocalSessionToUnified(s: LocalChatSession): UnifiedChatSession {
  return { id: s.id, name: s.name, user_id: s.user_id, created_at: s.created_at };
}

function mapLocalMessageToUnified(m: LocalChatMessage): UnifiedChatMessage {
  return { id: m.id, session_id: m.project_id, role: m.role, content: m.content, created_at: m.created_at };
}

// ==================== Profiles API ====================

export const unifiedProfiles = {
  async getById(userId: string, authSource: AuthSource): Promise<UserProfile | null> {
    // Try Appwrite first if authenticated via Appwrite
    if (shouldUseAppwrite(authSource)) {
      try {
        const doc = await appwriteDB.getProfile(userId);
        if (doc) {
          // Sync to local for offline access
          const localProfile = localProfiles.getById(userId);
          if (!localProfile) {
            // Create local profile from Appwrite data
            localProfiles.update(userId, {
              email: doc.email as string,
              display_name: doc.display_name as string || "",
              role: (doc.role as "admin" | "user") || "user",
              avatar_url: doc.avatar_url as string || null,
              bio: doc.bio as string || "",
              phone: doc.phone as string || "",
              website: doc.website as string || "",
              location: doc.location as string || "",
              language_preference: doc.language_preference as string || "ar",
              theme_preference: doc.theme_preference as string || "system",
              notifications_enabled: doc.notifications_enabled as boolean ?? true,
            });
          }
          return doc as unknown as UserProfile;
        }
      } catch (error) {
        console.warn("[DataSource] Appwrite profile fetch failed, falling back to local:", error);
      }
    }

    // Fallback to LocalDB
    const local = localProfiles.getById(userId);
    return local as unknown as UserProfile | null;
  },

  async update(userId: string, data: Partial<LocalProfile>, authSource: AuthSource): Promise<boolean> {
    let localOk = false;
    let appwriteOk = false;

    // Always update local for offline access
    const localResult = localProfiles.update(userId, data);
    localOk = !!localResult;

    // Also update Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      try {
        appwriteOk = await appwriteDB.updateProfile(userId, data as Record<string, unknown>);
      } catch {
        console.warn("[DataSource] Appwrite profile update failed");
      }
    }

    return localOk || appwriteOk;
  },
};

// ==================== Chat Sessions API ====================

export const unifiedChatSessions = {
  async getByUserId(userId: string, authSource: AuthSource): Promise<UnifiedChatSession[]> {
    if (shouldUseAppwrite(authSource)) {
      try {
        const docs = await appwriteDB.getChatSessions(userId);
        if (docs && docs.length >= 0) {
          return (docs as Record<string, unknown>[]).map(mapAppwriteDocToSession);
        }
      } catch (error) {
        console.warn("[DataSource] Appwrite sessions fetch failed, falling back to local:", error);
      }
    }

    // Fallback to LocalDB
    return localChatSessions.getByUserId(userId).map(mapLocalSessionToUnified);
  },

  async create(userId: string, name: string, authSource: AuthSource): Promise<UnifiedChatSession | null> {
    // Always create locally
    const localSession = localChatSessions.create(userId, name);

    // Also create in Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      try {
        const appwriteSession = await appwriteDB.createChatSession(userId, name);
        if (appwriteSession) {
          return mapAppwriteDocToSession(appwriteSession as Record<string, unknown>);
        }
      } catch (error) {
        console.warn("[DataSource] Appwrite session create failed, using local:", error);
      }
    }

    return mapLocalSessionToUnified(localSession);
  },

  async delete(sessionId: string, authSource: AuthSource): Promise<boolean> {
    // Always delete locally
    localChatSessions.delete(sessionId);

    // Also delete from Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      try {
        await appwriteDB.deleteChatSession(sessionId);
      } catch {
        console.warn("[DataSource] Appwrite session delete failed");
      }
    }

    return true;
  },
};

// ==================== Chat Messages API ====================

export const unifiedChatMessages = {
  async getBySessionId(sessionId: string, authSource: AuthSource): Promise<UnifiedChatMessage[]> {
    if (shouldUseAppwrite(authSource)) {
      try {
        const docs = await appwriteDB.getChatMessages(sessionId);
        if (docs && docs.length >= 0) {
          // Sync to local for offline access
          return (docs as Record<string, unknown>[]).map(mapAppwriteDocToMessage);
        }
      } catch (error) {
        console.warn("[DataSource] Appwrite messages fetch failed, falling back to local:", error);
      }
    }

    // Fallback to LocalDB
    return localChatMessages.getBySessionId(sessionId).map(mapLocalMessageToUnified);
  },

  async insert(sessionId: string, role: "user" | "assistant" | "system", content: string, authSource: AuthSource): Promise<UnifiedChatMessage | null> {
    // Always insert locally
    const localMsg = localChatMessages.insert(sessionId, role, content);

    // Also insert to Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      try {
        await appwriteDB.addChatMessage(sessionId, role, content);
      } catch {
        console.warn("[DataSource] Appwrite message insert failed");
      }
    }

    return mapLocalMessageToUnified(localMsg);
  },

  async insertMany(items: { session_id: string; role: "user" | "assistant" | "system"; content: string }[], authSource: AuthSource): Promise<void> {
    // Always insert locally
    localChatMessages.insertMany(items.map(i => ({ project_id: i.session_id, role: i.role, content: i.content })));

    // Also insert to Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      for (const item of items) {
        try {
          await appwriteDB.addChatMessage(item.session_id, item.role, item.content);
        } catch {
          console.warn("[DataSource] Appwrite batch message insert failed for one item");
        }
      }
    }
  },
};

// ==================== Site Settings API ====================

export const unifiedSettings = {
  async get(authSource: AuthSource): Promise<Record<string, string>> {
    if (shouldUseAppwrite(authSource)) {
      try {
        const settings = await appwriteDB.getSettings();
        if (Object.keys(settings).length > 0) {
          return settings;
        }
      } catch {
        console.warn("[DataSource] Appwrite settings fetch failed, falling back to local");
      }
    }

    return localSettings.getAll();
  },

  async save(key: string, value: string, authSource: AuthSource): Promise<boolean> {
    // Always save locally
    localSettings.set(key, value);

    // Also save to Appwrite if connected
    if (shouldUseAppwrite(authSource)) {
      try {
        return await appwriteDB.saveSetting(key, value);
      } catch {
        console.warn("[DataSource] Appwrite setting save failed");
      }
    }

    return true;
  },
};

// ==================== Stats API ====================

export const unifiedStats = {
  getForUser(userId: string, authSource: AuthSource): { sessions: number; messages: number; messagesToday: number } {
    // Use LocalDB for stats (most reliable, always available)
    const sessions = localChatSessions.getByUserId(userId);
    const sessionIds = new Set(sessions.map(s => s.id));
    const allMessages = typeof window !== "undefined" 
      ? (() => { try { return JSON.parse(localStorage.getItem("hf_db_chat_messages") || "[]"); } catch { return []; } })() 
      : [];
    const userMessages = allMessages.filter((m: LocalChatMessage) => sessionIds.has(m.project_id));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const messagesToday = userMessages.filter((m: LocalChatMessage) => new Date(m.created_at) >= today).length;

    return {
      sessions: sessions.length,
      messages: userMessages.length,
      messagesToday,
    };
  },
};

// ==================== Ensure Appwrite User Has Local Profile ====================

export function ensureLocalProfileForAppwriteUser(userId: string, email: string, name: string): void {
  const existing = localProfiles.getById(userId);
  if (!existing) {
    // Create a local profile so sidebar/avatar works
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
      .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(email.toLowerCase());

    localProfiles.update(userId, {
      email,
      display_name: name || email.split("@")[0],
      role: isAdmin ? "admin" : "user",
      avatar_url: null,
      bio: "",
      phone: "",
      website: "",
      location: "",
      language_preference: "ar",
      theme_preference: "system",
      notifications_enabled: true,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    // Update last seen
    localProfiles.updateLastSeen(userId);
  }
}
