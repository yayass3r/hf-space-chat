"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, startTransition } from "react";

export type AppPage = "home" | "chat" | "builder" | "deploy" | "profile" | "admin" | "settings";

interface RouterContextType {
  currentPage: AppPage;
  navigate: (page: AppPage) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const RouterContext = createContext<RouterContextType>({
  currentPage: "home",
  navigate: () => {},
  goBack: () => {},
  goForward: () => {},
  canGoBack: false,
  canGoForward: false,
});

export function useRouter() {
  return useContext(RouterContext);
}

const PAGE_TITLES: Record<AppPage, string> = {
  home: "الرئيسية",
  chat: "المحادثة",
  builder: "بناء المشاريع",
  deploy: "نشر المشاريع",
  profile: "الملف الشخصي",
  admin: "لوحة التحكم",
  settings: "الإعدادات",
};

const VALID_PAGES: AppPage[] = ["home", "chat", "builder", "deploy", "profile", "admin", "settings"];

function isValidPage(hash: string): hash is AppPage {
  return VALID_PAGES.includes(hash as AppPage);
}

export function HashRouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (typeof window === "undefined") return "home";
    const hash = window.location.hash.replace("#", "");
    return isValidPage(hash) ? hash : "home";
  });

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const historyRef = useRef<AppPage[]>([
    (() => {
      if (typeof window === "undefined") return "home";
      const hash = window.location.hash.replace("#", "");
      return isValidPage(hash) ? hash : "home";
    })()
  ]);
  const historyIndexRef = useRef(0);
  const isNavigatingRef = useRef(false);

  const updateCanNavigate = useCallback(() => {
    startTransition(() => {
      setCanGoBack(historyIndexRef.current > 0);
      setCanGoForward(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  // Listen to popstate for browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace("#", "");
      const page = isValidPage(hash) ? hash : "home";

      isNavigatingRef.current = true;

      // Determine direction: check if the page is back or forward in our history
      // For browser back/forward, we try to find the page in history
      const currentIdx = historyIndexRef.current;
      if (currentIdx > 0 && historyRef.current[currentIdx - 1] === page) {
        // Going back
        historyIndexRef.current = currentIdx - 1;
      } else if (currentIdx < historyRef.current.length - 1 && historyRef.current[currentIdx + 1] === page) {
        // Going forward
        historyIndexRef.current = currentIdx + 1;
      } else {
        // Unknown navigation - treat as new entry
        historyRef.current = historyRef.current.slice(0, currentIdx + 1);
        historyRef.current.push(page);
        historyIndexRef.current = historyRef.current.length - 1;
      }

      startTransition(() => { setCurrentPage(page); });
      updateCanNavigate();
      isNavigatingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [updateCanNavigate]);

  // Update document title
  useEffect(() => {
    document.title = `${PAGE_TITLES[currentPage]} | HF Space Chat`;
  }, [currentPage]);

  // Set initial hash if not set
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !isValidPage(hash)) {
      window.location.replace("#home");
    }
  }, []);

  const navigate = useCallback((page: AppPage) => {
    if (isNavigatingRef.current) return;
    if (page === currentPage) return; // Already on this page

    isNavigatingRef.current = true;

    // Update hash (this will trigger popstate on browser back/forward, but not on programmatic change)
    window.location.hash = page;

    // Update history: truncate forward entries and push new page
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(page);
    historyIndexRef.current = historyRef.current.length - 1;

    startTransition(() => { setCurrentPage(page); });
    updateCanNavigate();

    isNavigatingRef.current = false;

    // Scroll to top on page change
    window.scrollTo(0, 0);
  }, [currentPage, updateCanNavigate]);

  const goBack = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    isNavigatingRef.current = true;

    historyIndexRef.current -= 1;
    const targetPage = historyRef.current[historyIndexRef.current];
    window.location.hash = targetPage;

    startTransition(() => { setCurrentPage(targetPage); });
    updateCanNavigate();

    isNavigatingRef.current = false;
    window.scrollTo(0, 0);
  }, [updateCanNavigate]);

  const goForward = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isNavigatingRef.current = true;

    historyIndexRef.current += 1;
    const targetPage = historyRef.current[historyIndexRef.current];
    window.location.hash = targetPage;

    startTransition(() => { setCurrentPage(targetPage); });
    updateCanNavigate();

    isNavigatingRef.current = false;
    window.scrollTo(0, 0);
  }, [updateCanNavigate]);

  return (
    <RouterContext.Provider value={{ currentPage, navigate, goBack, goForward, canGoBack, canGoForward }}>
      {children}
    </RouterContext.Provider>
  );
}
