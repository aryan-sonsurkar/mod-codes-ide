import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "./contexts/SettingsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MODCODES",
  description:
    "MODCODES — a local-first development environment built for the browser. Developed by ARS.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
