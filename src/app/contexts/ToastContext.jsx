"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import "./Toast.css";

const MAX_TOASTS = 4;

const DEFAULT_DURATIONS = {
  success: 2500,
  info: 3000,
  warning: 4000,
  error: 6000,
};

const VALID_TYPES = ["success", "info", "warning", "error"];

const ToastContext = createContext(null);

let nextId = 1;

function iconFor(type) {
  if (type === "success") {
    return "✓";
  }
  if (type === "error") {
    return "✗";
  }
  if (type === "warning") {
    return "!";
  }
  return "i";
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message, type = "info", duration) => {
      const kind = VALID_TYPES.includes(type) ? type : "info";
      const id = nextId++;
      const ms = duration ?? DEFAULT_DURATIONS[kind];

      setToasts((current) => [
        ...current.slice(-(MAX_TOASTS - 1)),
        { id, message, type: kind },
      ]);

      const timer = window.setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((entry) => (
          <div
            key={entry.id}
            className={`toast toast-${entry.type}`}
            role="status"
          >
            <span className="toast-icon" aria-hidden="true">
              {iconFor(entry.type)}
            </span>
            <span className="toast-message">{entry.message}</span>
            <button
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismiss(entry.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}