export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "user";
  display_name: string;
  avatar_url: string;
  bio: string;
  phone: string;
  website: string;
  location: string;
  language_preference: string;
  theme_preference: string;
  notifications_enabled: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

// SiteSettings is now defined ONLY in supabase.ts to avoid duplication
export type SiteSettingKey =
  | "admin_emails"
  | "adsense_enabled"
  | "adsense_client_id"
  | "adsense_ad_slot"
  | "admob_enabled"
  | "admob_app_id"
  | "admob_ad_unit_id"
  | "site_name"
  | "hf_space_url"
  | "hf_api_path"
  | "hf_api_token"
  | "hf_model";

export interface DashboardStats {
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  todayMessages: number;
  activeUsers: number;
}

export interface UserActivityStats {
  totalSessions: number;
  totalMessages: number;
  todayMessages: number;
  streak: number;
  joinedDaysAgo: number;
  lastActive: string;
}
