"use client";
import { useEffect } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";
import { parseJoinTarget } from "../../lib/ai/localLink";

/**
 * Applies `?ollama=http://<private-host>:11434` from a Local Link QR.
 * Only private/loopback/mDNS targets pass validation, and the parameter is
 * removed from the URL so a refresh cannot silently re-apply an old address.
 */
export default function JoinLinkHandler() {
  const { updateSetting } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    const target = parseJoinTarget(window.location.search);
    if (!target.ok) return undefined;

    const id = window.setTimeout(() => {
      updateSetting("ai", "provider", "ollama");
      updateSetting("ai", "baseUrl", target.url);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.hash}`
      );
      toast(`Local Link: using ${target.url}`, "info");
    }, 0);

    return () => window.clearTimeout(id);
  }, [updateSetting, toast]);

  return null;
}
