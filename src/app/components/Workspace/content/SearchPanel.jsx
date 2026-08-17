"use client";
import { useEffect, useRef, useState } from "react";
import "./SearchPanel.css";
import { searchWorkspace } from "../../../lib/filesystem/filesystem";

const MAX_VISIBLE_RESULTS = 200;

export default function SearchPanel({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function runSearch(rawQuery) {
    const requestId = ++requestIdRef.current;
    const trimmed = typeof rawQuery === "string" ? rawQuery.trim() : "";

    if (!trimmed) {
      setMatches([]);
      setSearched(false);
      setError("");
      return;
    }

    setSearching(true);
    setError("");

    const result = await searchWorkspace(trimmed);

    if (requestId !== requestIdRef.current) {
      return;
    }

    setSearching(false);

    if (!result.ok) {
      setError("Could not search the workspace.");
      setMatches([]);
      setSearched(true);
      return;
    }

    setMatches(result.matches);
    setSearched(true);
  }

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      runSearch(query);
    }, 400);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  const visibleMatches = matches.slice(0, MAX_VISIBLE_RESULTS);

  return (
    <aside className="search-panel">
      <header className="search-header">
        <span className="search-title">SEARCH</span>
        <button
          className="search-close-button"
          title="Close Search"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            runSearch(query);
          }
          if (event.key === "Escape") {
            onClose();
          }
        }}
        placeholder="Search workspace..."
        autoFocus
      />

      <div className="search-body">
        {error && <p className="search-status search-error">{error}</p>}
        {searching && <p className="search-status">Searching...</p>}
        {!searching && searched && !error && matches.length === 0 && (
          <p className="search-status">No results.</p>
        )}
        {!searching && matches.length > MAX_VISIBLE_RESULTS && (
          <p className="search-status">
            Showing first {MAX_VISIBLE_RESULTS} of {matches.length} results.
          </p>
        )}
        <div className="search-results">
          {visibleMatches.map((match, index) => (
            <button
              key={`${match.path}:${match.line}:${index}`}
              className="search-result"
              onClick={() => onSelect(match)}
            >
              <span className="search-result-location">
                <span className="search-result-path">{match.path}</span>
                <span className="search-result-line">:{match.line}</span>
              </span>
              <span className="search-result-text">{match.text}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}