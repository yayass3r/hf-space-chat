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
        {/* Google AdSense Verification & Auto Ads */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2304503997296254"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
