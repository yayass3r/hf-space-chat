"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ucmpclgctjeyoimtmqir.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbXBjbGdjdGpleW9pbXRtcWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjI5NjYsImV4cCI6MjA5MTQ5ODk2Nn0.-243x1_Hqnml5smR3aqSUFS8uuglw3f1wSlfqZNcp-k";

// Admin emails - can be configured via env var or localStorage
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = !!supabase;

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  
  // Check env var list
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  
  // Check localStorage override
  if (typeof window !== "undefined") {
    try {
      const storedAdminEmails = localStorage.getItem("hf_admin_emails");
      if (storedAdminEmails) {
        const emails = storedAdminEmails.split(",").map((e) => e.trim().toLowerCase());
        if (emails.includes(email.toLowerCase())) return true;
      }
    } catch {}
  }
  
  return false;
}

// Check if profiles table exists (cached)
let _profilesTableExists: boolean | null = null;

export async function checkProfilesTable(): Promise<boolean> {
  if (_profilesTableExists !== null) return _profilesTableExists;
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    _profilesTableExists = !error;
    return _profilesTableExists;
  } catch {
    _profilesTableExists = false;
    return false;
  }
}

// Check if site_settings table exists (cached)
let _settingsTableExists: boolean | null = null;

export async function checkSettingsTable(): Promise<boolean> {
  if (_settingsTableExists !== null) return _settingsTableExists;
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("site_settings").select("key").limit(1);
    _settingsTableExists = !error;
    return _settingsTableExists;
  } catch {
    _settingsTableExists = false;
    return false;
  }
}

// Site settings with localStorage fallback
export interface SiteSettings {
  admin_emails: string;
  adsense_enabled: string;
  adsense_client_id: string;
  adsense_ad_slot: string;
  admob_enabled: string;
  admob_app_id: string;
  admob_ad_unit_id: string;
  site_name: string;
  hf_space_url: string;
  hf_api_path: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  admin_emails: process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com",
  adsense_enabled: "false",
  adsense_client_id: "",
  adsense_ad_slot: "",
  admob_enabled: "false",
  admob_app_id: "",
  admob_ad_unit_id: "",
  site_name: "HF Space Chat",
  hf_space_url: "https://your-space.hf.space",
  hf_api_path: "/api/predict",
};

const SETTINGS_KEY = "hf_site_settings";

export async function loadSettings(): Promise<SiteSettings> {
  const defaults = { ...DEFAULT_SETTINGS };

  // Try loading from Supabase first
  if (supabase) {
    try {
      const tableExists = await checkSettingsTable();
      if (tableExists) {
        const { data } = await supabase.from("site_settings").select("key, value");
        if (data && data.length > 0) {
          data.forEach((item: { key: string; value: string }) => {
            if (item.key in defaults) {
              (defaults as Record<string, string>)[item.key] = item.value;
            }
          });
        }
      }
    } catch {}
  }

  // Override with localStorage (takes priority for admin changes)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.keys(parsed).forEach((key) => {
          if (key in defaults) {
            (defaults as Record<string, string>)[key] = parsed[key];
          }
        });
      }
    } catch {}
  }

  return defaults;
}

export async function saveSettings(settings: SiteSettings): Promise<boolean> {
  // Save to localStorage immediately
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }

  // Also try to save to Supabase if table exists
  if (supabase) {
    try {
      const tableExists = await checkSettingsTable();
      if (tableExists) {
        const entries = Object.entries(settings) as [string, string][];
        for (const [key, value] of entries) {
          await supabase
            .from("site_settings")
            .upsert({ key, value }, { onConflict: "key" });
        }
      }
    } catch {}
  }

  return true;
}

// Sanitize text to prevent XSS
export function sanitizeText(text: string): string {
  // Remove potential script tags and event handlers
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}
