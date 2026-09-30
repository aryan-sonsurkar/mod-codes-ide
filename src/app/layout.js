import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import ErrorBoundary from "./components/Diagnostics/ErrorBoundary";
import AdsProvider from "./components/Ads/AdsProvider";
import AdSenseConfig from "./components/Ads/AdSenseConfig";
import ObservabilityInit from "./components/Diagnostics/ObservabilityInit";
import ServiceWorkerRegister, {
  OfflineBanner,
} from "./components/Offline/ServiceWorkerRegister";

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || "";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://modcodes.dev"),
  title: {
    default: "MODCODES — Browser IDE with Local AI",
    template: "%s · MODCODES",
  },
  description:
    "A fast, private, browser-based development environment with local AI (Ollama + Bonsai). Code in the browser, files stay on your machine. No cloud proxy, no account.",
  applicationName: "MODCODES",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  other: {
    ...(ADSENSE_ID ? { "google-adsense-account": ADSENSE_ID } : {}),
  },
  openGraph: {
    title: "MODCODES — Browser IDE with Local AI",
    description:
      "A fast, private, browser-based development environment with local AI. Local filesystem, Monaco, terminal, and privacy-first AI.",
    url: "https://modcodes.dev",
    siteName: "MODCODES",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MODCODES — Browser IDE with Local AI",
    description:
      "A fast, private, browser-based development environment with local AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#8B5CF6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ObservabilityInit />
        <ServiceWorkerRegister />
        {ADSENSE_ID && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        <ErrorBoundary>
          <SettingsProvider>
            <ToastProvider>
              <AdSenseConfig />
              <AdsProvider>{children}</AdsProvider>
              <OfflineBanner />
            </ToastProvider>
          </SettingsProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
