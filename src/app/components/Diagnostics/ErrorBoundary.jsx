"use client";
import { Component } from "react";
import "./DiagnosticsCenter.css";

function classifyError(error) {
  if (!error) return { title: "Something went wrong", message: "An unexpected error occurred.", actions: ["retry"] };
  const msg = String(error.message || error || "").toLowerCase();
  const stack = String(error.stack || "").toLowerCase();

  if (msg.includes("settings") || msg.includes("usettings")) {
    return {
      title: "Settings load error",
      message: "Unable to load project settings. Your files on disk are safe.",
      detail: "Settings data may be corrupted.",
      actions: ["retry", "reset-settings"],
    };
  }
  if (msg.includes("hydration")) {
    return {
      title: "Page refresh needed",
      message: "The page needs to reload to display correctly.",
      detail: "This is a one-time refresh, not a data loss.",
      actions: ["reload"],
    };
  }
  if (msg.includes("filesystem") || msg.includes("file system") || msg.includes("not supported")) {
    return {
      title: "File system unavailable",
      message: "MODCODES cannot access the file system.",
      detail: "Use a Chromium-based browser (Chrome or Edge) for full functionality.",
      actions: ["retry"],
    };
  }
  if (msg.includes("permission") || msg.includes("denied")) {
    return {
      title: "Permission denied",
      message: "MODCODES does not have permission to access this resource.",
      detail: "Check your browser permissions and try again.",
      actions: ["retry"],
    };
  }
  if (msg.includes("ollama") || msg.includes("provider") || msg.includes("connection")) {
    return {
      title: "AI provider unavailable",
      message: "Cannot connect to the AI provider.",
      detail: "Ensure Ollama is running locally, or switch to Browser AI in settings.",
      actions: ["retry"],
    };
  }
  if (msg.includes("terminal") || msg.includes("bridge")) {
    return {
      title: "Terminal unavailable",
      message: "The terminal bridge is not running.",
      detail: "Start the bridge server: node tools/modcodes-bridge/server.js",
      actions: ["retry"],
    };
  }
  if (msg.includes("monaco") || msg.includes("editor")) {
    return {
      title: "Editor failed to load",
      message: "The code editor could not initialize.",
      detail: "Try refreshing the page. If this persists, check the console.",
      actions: ["retry", "reload"],
    };
  }

  return {
    title: "Something went wrong",
    message: "An unexpected error occurred. Your files on disk are safe.",
    detail: "Try refreshing the page or reopening the project.",
    actions: ["retry"],
  };
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined" && console.error) {
      console.error("MODCODES error boundary:", error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onRetry === "function") {
      this.props.onRetry();
    }
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleResetSettings = () => {
    try {
      localStorage.removeItem("modcodes-settings");
    } catch {}
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const { title, message, detail, actions } = classifyError(this.state.error);
      return (
        <div className="error-boundary" role="alert">
          <h2>{title}</h2>
          <p>{message}</p>
          {detail && <p className="error-boundary-detail">{detail}</p>}
          <div className="error-boundary-actions">
            {actions.includes("retry") && (
              <button type="button" className="error-boundary-retry" onClick={this.handleRetry}>
                Retry
              </button>
            )}
            {actions.includes("reload") && (
              <button type="button" className="error-boundary-retry" onClick={this.handleReload}>
                Reload Page
              </button>
            )}
            {actions.includes("reset-settings") && (
              <button type="button" className="error-boundary-retry error-boundary-reset" onClick={this.handleResetSettings}>
                Reset Settings
              </button>
            )}
          </div>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}
