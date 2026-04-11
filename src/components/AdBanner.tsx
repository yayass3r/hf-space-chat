"use client";

import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

interface AdSettings {
  adsense_enabled: boolean;
  adsense_client_id: string;
  adsense_ad_slot: string;
  admob_enabled: boolean;
  admob_app_id: string;
  admob_ad_unit_id: string;
}

export default function AdBanner({ position }: { position: "top" | "bottom" | "sidebar" }) {
  const [adSettings, setAdSettings] = useState<AdSettings>({
    adsense_enabled: false,
    adsense_client_id: "",
    adsense_ad_slot: "",
    admob_enabled: false,
    admob_app_id: "",
    admob_ad_unit_id: "",
  });
  const [adsenseLoaded, setAdsenseLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadAdSettings() {
      try {
        const { data } = await supabase!.from("site_settings").select("key, value");

        if (data) {
          const settingsMap: Record<string, string> = {};
          data.forEach((item: { key: string; value: string }) => {
            settingsMap[item.key] = item.value;
          });

          setAdSettings({
            adsense_enabled: (settingsMap.adsense_enabled || DEFAULT_SETTINGS.adsense_enabled) === "true",
            adsense_client_id: settingsMap.adsense_client_id || DEFAULT_SETTINGS.adsense_client_id,
            adsense_ad_slot: settingsMap.adsense_ad_slot || DEFAULT_SETTINGS.adsense_ad_slot,
            admob_enabled: (settingsMap.admob_enabled || DEFAULT_SETTINGS.admob_enabled) === "true",
            admob_app_id: settingsMap.admob_app_id || DEFAULT_SETTINGS.admob_app_id,
            admob_ad_unit_id: settingsMap.admob_ad_unit_id || DEFAULT_SETTINGS.admob_ad_unit_id,
          });
        }
      } catch {
        // Silently fail
      }
    }

    loadAdSettings();
  }, []);

  // Load AdSense script
  useEffect(() => {
    if (!adSettings.adsense_enabled || !adSettings.adsense_client_id || adsenseLoaded) return;

    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSettings.adsense_client_id}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    setAdsenseLoaded(true);
  }, [adSettings.adsense_enabled, adSettings.adsense_client_id, adsenseLoaded]);

  // Push ad after component mounts
  useEffect(() => {
    if (!adSettings.adsense_enabled || !adSettings.adsense_client_id || !adSettings.adsense_ad_slot) return;

    try {
      const adsbygoogle = (window as unknown as Record<string, unknown[]>).adsbygoogle || [];
      adsbygoogle.push({});
      (window as unknown as Record<string, unknown[]>).adsbygoogle = adsbygoogle;
    } catch {
      // Silently fail
    }
  }, [adSettings.adsense_enabled, adSettings.adsense_client_id, adSettings.adsense_ad_slot, adsenseLoaded]);

  if (!adSettings.adsense_enabled && !adSettings.admob_enabled) return null;

  const positionClasses = {
    top: "w-full flex justify-center py-2",
    bottom: "w-full flex justify-center py-2",
    sidebar: "w-full flex justify-center py-3",
  };

  const sizeClass = position === "sidebar"
    ? "w-full h-[250px]"
    : position === "top"
    ? "w-full max-w-[728px] h-[90px]"
    : "w-full max-w-[728px] h-[90px]";

  // AdSense banner
  if (adSettings.adsense_enabled && adSettings.adsense_client_id && adSettings.adsense_ad_slot) {
    return (
      <div className={`${positionClasses[position]} bg-slate-50 dark:bg-slate-800/50`}>
        <div className={`${sizeClass} rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center`}>
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", height: "100%" }}
            data-ad-client={adSettings.adsense_client_id}
            data-ad-slot={adSettings.adsense_ad_slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  // AdMob placeholder (for mobile web)
  if (adSettings.admob_enabled && adSettings.admob_ad_unit_id) {
    return (
      <div className={`${positionClasses[position]} bg-slate-50 dark:bg-slate-800/50`}>
        <div className={`${sizeClass} rounded-lg overflow-hidden border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center`}>
          <span className="text-xs text-slate-400 dark:text-slate-500">AdMob Ad Unit</span>
        </div>
      </div>
    );
  }

  return null;
}
