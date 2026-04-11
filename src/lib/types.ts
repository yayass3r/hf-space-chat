export interface Message {
  role: "user" | "assistant";
  content: string;
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
  created_at: string;
}

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

export type SiteSettingKey = keyof SiteSettings;

export const DEFAULT_SETTINGS: SiteSettings = {
  admin_emails: "admin@example.com",
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
