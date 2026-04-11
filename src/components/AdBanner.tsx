"use client";

import React, { useEffect, useState, useRef } from "react";
import { loadSettings } from "@/lib/supabase";

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
  const adsenseLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function loadAdSettings() {
      const settings = await loadSettings();
      if (mounted) {
        setAdSettings({
          adsense_enabled: settings.adsense_enabled === "true",
          adsense_client_id: settings.adsense_client_id,
          adsense_ad_slot: settings.adsense_ad_slot,
          admob_enabled: settings.admob_enabled === "true",
          admob_app_id: settings.admob_app_id,
          admob_ad_unit_id: settings.admob_ad_unit_id,
        });
      }
    }
    loadAdSettings();
    return () => { mounted = false; };
  }, []);

  // Load AdSense script
  useEffect(() => {
    if (!adSettings.adsense_enabled || !adSettings.adsense_client_id || adsenseLoadedRef.current) return;

    const existingScript = document.querySelector('script[src*="pagead2.googlesyndication.com"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSettings.adsense_client_id}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    adsenseLoadedRef.current = true;
  }, [adSettings.adsense_enabled, adSettings.adsense_client_id]);

  // Push ad
  useEffect(() => {
    if (!adSettings.adsense_enabled || !adSettings.adsense_client_id || !adSettings.adsense_ad_slot) return;
    try {
      const adsbygoogle = (window as unknown as Record<string, unknown[]>).adsbygoogle || [];
      adsbygoogle.push({});
      (window as unknown as Record<string, unknown[]>).adsbygoogle = adsbygoogle;
    } catch {}
  }, [adSettings.adsense_enabled, adSettings.adsense_client_id, adSettings.adsense_ad_slot]);

  if (!adSettings.adsense_enabled && !adSettings.admob_enabled) return null;

  const positionClasses = {
    top: "w-full flex justify-center py-2",
    bottom: "w-full flex justify-center py-2",
    sidebar: "w-full flex justify-center py-3",
  };

  const sizeClass = position === "sidebar"
    ? "w-full h-[250px]"
    : "w-full max-w-[728px] h-[90px]";

  if (adSettings.adsense_enabled && adSettings.adsense_client_id && adSettings.adsense_ad_slot) {
    return (
      <div className={`${positionClasses[position]} bg-slate-50 dark:bg-slate-800/50`}>
        <div className={`${sizeClass} rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center`}>
          <ins className="adsbygoogle" style={{ display: "block", width: "100%", height: "100%" }}
            data-ad-client={adSettings.adsense_client_id} data-ad-slot={adSettings.adsense_ad_slot}
            data-ad-format="auto" data-full-width-responsive="true" />
        </div>
      </div>
    );
  }

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
