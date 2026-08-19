"use client";
import { useEffect, useRef, useState } from "react";
import "./GoToLineDialog.css";

export default function GoToLineDialog({ onGo, onClose }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const line = parseInt(value, 10);
    if (Number.isFinite(line) && line > 0) {
      onGo(line);
    } else {
      onClose();
    }
  }

  return (
    <div className="goto-overlay" onClick={onClose}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="goto-label" htmlFor="goto-line-input">
          Go to line
        </label>
        <input
          id="goto-line-input"
          ref={inputRef}
          className="goto-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="Line number"
        />
      </div>
    </div>
  );
}