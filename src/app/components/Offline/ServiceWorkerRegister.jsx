"use client";
import { useEffect, useState } from "react";
import "./OfflineBanner.css";

const SW_URL = "/sw.js";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV === "test") {
      return;
    }
    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: "/" })
        .catch(() => {
          /* offline support is best effort */
        });
    };
    if (document.readyState === "complete") {
      register();
      return undefined;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner-dot" aria-hidden="true" />
      <span>
        You are offline. Your files, downloaded AI models and the Python
        runtime keep working — everything stays on this device.
      </span>
    </div>
  );
}

export default ServiceWorkerRegister;
