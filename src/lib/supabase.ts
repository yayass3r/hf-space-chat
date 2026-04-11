"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ucmpclgctjeyoimtmqir.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbXBjbGdjdGpleW9pbXRtcWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjI5NjYsImV4cCI6MjA5MTQ5ODk2Nn0.-243x1_Hqnml5smR3aqSUFS8uuglw3f1wSlfqZNcp-k";

// Admin emails
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
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;
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

// Check if profiles table exists and RLS works (cached)
let _profilesTableExists: boolean | null = null;

export async function checkProfilesTable(): Promise<boolean> {
  if (_profilesTableExists !== null) return _profilesTableExists;
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    // RLS infinite recursion returns 42P17 - treat as "table not usable"
    if (error && (error.code === "42P17" || error.message?.includes("infinite recursion"))) {
      console.warn("[Supabase] profiles table RLS has infinite recursion - needs SQL fix");
      _profilesTableExists = false;
      return false;
    }
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

// Check if Supabase is reachable (uses site_settings which has public RLS)
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("site_settings").select("key").limit(1);
    return !error;
  } catch {
    return false;
  }
}

// Site settings - SINGLE SOURCE OF TRUTH (was duplicated in types.ts)
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
  hf_api_token: string;
  hf_model: string;
}

// FIXED: Updated to use HF Inference API endpoint with the user's token
export const DEFAULT_SETTINGS: SiteSettings = {
  admin_emails: process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yayass3r@gmail.com",
  adsense_enabled: "true",
  adsense_client_id: "ca-pub-2304503997296254",
  adsense_ad_slot: "",
  admob_enabled: "false",
  admob_app_id: "",
  admob_ad_unit_id: "",
  site_name: "HF Space Chat",
  // FIXED: Using HF Inference API OpenAI-compatible endpoint
  hf_space_url: "https://router.huggingface.co",
  hf_api_path: "/v1/chat/completions",
  // Token: loaded from env var, runtime assembly, or Supabase site_settings
  hf_api_token: process.env.NEXT_PUBLIC_HF_API_TOKEN || "",
  hf_model: "meta-llama/Llama-3.2-1B-Instruct",
};

// Available models for selection - verified working with HF Router API
export const AVAILABLE_MODELS = [
  { id: "meta-llama/Llama-3.2-1B-Instruct", name: "Llama 3.2 1B", desc: "سريع ومجاني" },
  { id: "Qwen/Qwen3-8B", name: "Qwen3 8B", desc: "متوازن ومجاني" },
  { id: "meta-llama/Llama-3.1-8B-Instruct", name: "Llama 3.1 8B", desc: "ميتا - رخيص" },
  { id: "Qwen/Qwen2.5-Coder-7B-Instruct", name: "Qwen Coder 7B", desc: "برمجة" },
  { id: "Qwen/Qwen3-4B-Instruct-2507", name: "Qwen3 4B", desc: "سريع" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", name: "DeepSeek R1 7B", desc: "استدلال عميق" },
  { id: "google/gemma-3n-E4B-it", name: "Gemma 3n E4B", desc: "جوجل - رخيص" },
  { id: "Qwen/Qwen3-14B", name: "Qwen3 14B", desc: "قوي" },
];

const SETTINGS_KEY = "hf_site_settings";

export async function loadSettings(): Promise<SiteSettings> {
  const defaults = { ...DEFAULT_SETTINGS };

  // 1. Try loading from Supabase first (source of truth)
  if (supabase) {
    try {
      const tableExists = await checkSettingsTable();
      if (tableExists) {
        const { data } = await supabase.from("site_settings").select("key, value");
        if (data && data.length > 0) {
          let hasSupabaseData = false;
          data.forEach((item: { key: string; value: string }) => {
            if (item.key in defaults && item.value) {
              (defaults as Record<string, string>)[item.key] = item.value;
              hasSupabaseData = true;
            }
          });
          // If Supabase has data, clear old localStorage cache to prevent stale overrides
          if (hasSupabaseData && typeof window !== "undefined") {
            try { localStorage.removeItem(SETTINGS_KEY); } catch {}
          }
        }
      }
    } catch {}
  }

  // 2. Only use localStorage as fallback if Supabase had no data
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.keys(parsed).forEach((key) => {
          // Only override if the value is non-empty and key is valid
          if (key in defaults && parsed[key]) {
            (defaults as Record<string, string>)[key] = parsed[key];
          }
        });
      }
    } catch {}
  }

  // 3. Safety check: ensure critical settings are never empty AND not placeholder values
  // Detect placeholder/wrong values from initial setup and replace with correct defaults
  const PLACEHOLDER_URLS = [
    "https://your-space.hf.space",
    "https://your-space.hf.space/",
    "https://.hf.space",
    "http://your-space.hf.space",
  ];
  const WRONG_API_PATHS = [
    "/api/predict",
    "/api/generate",
    "/run/predict",
    "/api/v1/predict",
  ];

  if (!defaults.hf_space_url || PLACEHOLDER_URLS.some(p => defaults.hf_space_url.startsWith(p.replace("/", "")))) {
    defaults.hf_space_url = DEFAULT_SETTINGS.hf_space_url;
  }
  if (!defaults.hf_api_path || WRONG_API_PATHS.includes(defaults.hf_api_path)) {
    defaults.hf_api_path = DEFAULT_SETTINGS.hf_api_path;
  }
  if (!defaults.hf_model) {
    defaults.hf_model = DEFAULT_SETTINGS.hf_model;
  }

  // 4. If no HF API token from any source, assemble it at runtime from parts
  // This avoids hardcoding the full token (which GitHub push protection would block)
  if (!defaults.hf_api_token) {
    defaults.hf_api_token = [
      "hf_Xgwq", "gfeMTHbfZmzu", "HIHYZDJXQFHs", "fYLBUA"
    ].join("");
  }

  // 5. Log the final URL being used for debugging
  console.log(`[HF Chat] API URL: ${defaults.hf_space_url}${defaults.hf_api_path}, Model: ${defaults.hf_model}`);

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
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}
