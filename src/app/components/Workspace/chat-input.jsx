"use client";
import "./chat-input.css";
import { useState } from "react";
import { Send, Paperclip } from "lucide-react";

export default function ChatInput({ onSubmit, onAttach, hasProject = false }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSubmit?.(text);
    setValue("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          hasProject
            ? "Ask ModCodes anything about your code..."
            : "Open a project, then ask ModCodes anything..."
        }
        aria-label="Ask ModCodes anything"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="chat-button" aria-label="Send question">
        <Send />
      </button>
      <button type="button" className="chat-button" aria-label="Attach file" onClick={onAttach}>
        <Paperclip />
      </button>
    </form>
  );
}
