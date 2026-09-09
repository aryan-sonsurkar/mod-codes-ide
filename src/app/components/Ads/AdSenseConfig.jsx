"use client";

import { useEffect } from "react";

const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || "";

export default function AdSenseConfig() {
  useEffect(() => {
    if (publisherId && typeof window !== "undefined") {
      window.__MODCODES_ADS_CONFIG = {
        ADSENSE_ENABLED: "true",
        ADSENSE_PUBLISHER_ID: publisherId,
        ADSENSE_CONSENT_REQUIRED: "true",
        ADSENSE_TEST_MODE: "false",
        ADSENSE_ADS_TXT_PATH: "/ads.txt",
      };
    }
  }, []);

  return null;
}
