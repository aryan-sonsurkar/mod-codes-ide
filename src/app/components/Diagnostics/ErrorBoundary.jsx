"use client";
import { Component } from "react";
import "./DiagnosticsCenter.css";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Developer diagnostics in console only; no stack in UI
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Your files on disk are safe.</p>
          <p className="error-boundary-hint">Try refreshing the page or reopening the project. If this persists, check the console for developer details.</p>
          <button type="button" className="error-boundary-retry" onClick={this.handleRetry}>
            Retry
          </button>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}
