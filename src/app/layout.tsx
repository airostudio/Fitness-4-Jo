import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "@/lib/store/provider";
import { AppShell } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "JoStrong", template: "%s · JoStrong" },
  description: "A little stronger, every day. Your private home strength and wellness companion.",
  manifest: "/manifest.webmanifest",
  applicationName: "JoStrong",
  appleWebApp: { capable: true, title: "JoStrong", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false }, // private app – keep out of search engines
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F9F7F2" }, { media: "(prefers-color-scheme: dark)", color: "#141A16" }],
};

// Applies Jo's saved look (theme, text size, contrast, motion) before first paint to avoid a flash.
const PREF_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("jostrong-prefs")||"{}"),r=document.documentElement;
var t=p.theme==="dark"||(p.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
r.dataset.theme=t;r.dataset.contrast=p.highContrast?"high":"normal";r.dataset.motion=p.reducedMotion==="on"?"reduce":p.reducedMotion==="off"?"full":"system";
if(p.textScale)r.style.setProperty("--text-scale",String(p.textScale/100));}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PREF_SCRIPT }} /></head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-fg">Skip to content</a>
        <AppProvider><AppShell>{children}</AppShell></AppProvider>
      </body>
    </html>
  );
}
