"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./SearchPanel.css";
import { searchWorkspace } from "../../../lib/filesystem/filesystem";

const MAX_VISIBLE_RESULTS = 200;

export default function SearchPanel({
  onSelect,
  onClose,
  onReplaceMatch,
  onReplaceAllWorkspace,
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replacing, setReplacing] = useState(false);
  const requestIdRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const options = useMemo(
    () => ({ matchCase, wholeWord }),
    [matchCase, wholeWord]
  );

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

    const result = await searchWorkspace(trimmed, options);

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
    setSelectedIndex(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matchCase, wholeWord]);

  const visibleMatches = matches.slice(0, MAX_VISIBLE_RESULTS);

  const grouped = useMemo(() => {
    const groups = [];
    const map = new Map();

    for (const match of visibleMatches) {
      if (!map.has(match.path)) {
        const group = { path: match.path, matches: [] };
        map.set(match.path, group);
        groups.push(group);
      }
      map.get(match.path).matches.push(match);
    }

    return groups;
  }, [visibleMatches]);

  async function handleReplaceSelected() {
    const match = matches[selectedIndex];

    if (!match || replacing) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setReplacing(true);
    try {
      await onReplaceMatch?.(
        match,
        trimmed,
        replacement,
        options
      );
      await runSearch(query);
    } finally {
      setReplacing(false);
    }
  }

  async function handleReplaceAll() {
    const trimmed = query.trim();

    if (!trimmed || replacing) {
      return;
    }

    setReplacing(true);
    try {
      await onReplaceAllWorkspace?.(
        trimmed,
        replacement,
        options
      );
      await runSearch(query);
    } finally {
      setReplacing(false);
    }
  }

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

      <div className="search-inputs">
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
        />
        <input
          className="search-input search-input-replace"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          placeholder="Replace with..."
        />
        <div className="search-options">
          <label className="search-option">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(event) => setMatchCase(event.target.checked)}
            />
            Match case
          </label>
          <label className="search-option">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(event) => setWholeWord(event.target.checked)}
            />
            Whole word
          </label>
        </div>
        <div className="search-actions">
          <button
            className="search-action-button"
            onClick={() => runSearch(query)}
            disabled={searching}
          >
            {searching ? "Searching..." : "Search"}
          </button>
          <button
            className="search-action-button"
            onClick={handleReplaceSelected}
            disabled={replacing || matches.length === 0}
          >
            Replace
          </button>
          <button
            className="search-action-button search-action-danger"
            onClick={handleReplaceAll}
            disabled={replacing || matches.length === 0}
          >
            Replace All
          </button>
        </div>
      </div>

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
          {grouped.map((group) => (
            <div className="search-group" key={group.path}>
              <div className="search-group-header">{group.path}</div>
              {group.matches.map((match, index) => {
                const absoluteIndex = visibleMatches.indexOf(match);
                return (
                  <button
                    key={`${match.path}:${match.line}:${match.column}:${absoluteIndex}`}
                    className={`search-result${
                      absoluteIndex === selectedIndex
                        ? " search-result-selected"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedIndex(absoluteIndex);
                      onSelect(match);
                    }}
                  >
                    <span className="search-result-location">
                      <span className="search-result-line">
                        :{match.line}:{match.column}
                      </span>
                    </span>
                    <span className="search-result-text">{match.text}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}