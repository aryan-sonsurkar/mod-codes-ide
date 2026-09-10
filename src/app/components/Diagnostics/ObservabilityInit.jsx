"use client";
import { useEffect } from "react";
import { initGlobalErrorHandlers } from "../../lib/observability/globalHandlers.js";

export default function ObservabilityInit() {
  useEffect(() => {
    initGlobalErrorHandlers();
  }, []);
  return null;
}
