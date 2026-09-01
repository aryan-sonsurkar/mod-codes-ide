"use client";
import { AdSenseProvider } from "../../contexts/AdSenseContext";
import ConsentBanner from "./ConsentBanner";

export default function AdsProvider({ children }) {
  return (
    <AdSenseProvider>
      {children}
      <ConsentBanner />
    </AdSenseProvider>
  );
}
