import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HF Space Chat - محادثة الذكاء الاصطناعي",
  description: "تحدث مع نماذج الذكاء الاصطناعي عبر Hugging Face Spaces بسهولة وسرعة",
  keywords: ["AI", "Chat", "Hugging Face", "الذكاء الاصطناعي", "محادثة"],
  authors: [{ name: "HF Space Chat" }],
  openGraph: {
    title: "HF Space Chat",
    description: "تحدث مع نماذج الذكاء الاصطناعي عبر Hugging Face Spaces",
    type: "website",
    locale: "ar_SA",
    siteName: "HF Space Chat",
  },
  twitter: {
    card: "summary_large_image",
    title: "HF Space Chat",
    description: "تحدث مع نماذج الذكاء الاصطناعي عبر Hugging Face Spaces",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* FIXED: Inline script to prevent FOUC (Flash of Unstyled Content) for dark mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('hf_theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        {/* Google AdSense - loaded once here, only if enabled in settings (fallback: check localStorage) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var settings = localStorage.getItem('hf_site_settings');
                  if (settings) {
                    var parsed = JSON.parse(settings);
                    if (parsed.adsense_enabled === 'true' && parsed.adsense_client_id) {
                      var s = document.createElement('script');
                      s.async = true;
                      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + parsed.adsense_client_id;
                      s.crossOrigin = 'anonymous';
                      document.head.appendChild(s);
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
