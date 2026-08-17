"use client";
import { useEffect, useRef, useState } from "react";
import "./CommandPalette.css";

export default function CommandPalette({ commands, onSelect, onClose }) {
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const trimmed = filter.trim().toLowerCase();
  const filtered = trimmed
    ? commands.filter((command) => command.title.toLowerCase().includes(trimmed))
    : commands;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, filtered.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) {
        onSelect(command);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="palette-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="command-palette" role="dialog" aria-modal="true">
        <input
          ref={inputRef}
          className="palette-input"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
        />
        <div className="palette-list" role="listbox">
          {filtered.map((command, index) => (
            <div
              key={command.id}
              className={`palette-item${
                index === activeIndex ? " palette-item-active" : ""
              }`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => onSelect(command)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="palette-item-title">{command.title}</span>
              {command.shortcut && (
                <span className="palette-item-shortcut">
                  {command.shortcut}
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="palette-empty">No matching commands.</p>
          )}
        </div>
      </div>
    </div>
  );
}