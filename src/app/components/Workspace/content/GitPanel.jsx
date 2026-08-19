"use client";
import { useEffect, useRef, useState } from "react";
import "./GitPanel.css";
import { GitBranch, Info, ShieldAlert } from "lucide-react";
import { getRootHandle } from "../../../lib/filesystem/filesystem";
import {
  GIT_CAPABILITIES,
  summarizeRepository,
} from "../../../lib/git";

export default function GitPanel({ tree }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const token = ++requestRef.current;
    let active = true;

    window.setTimeout(async () => {
      if (!active || token !== requestRef.current) {
        return;
      }

      setLoading(true);
      setError("");

      const rootHandle = getRootHandle();

      if (!rootHandle) {
        if (active) {
          setSummary({ unsupported: true, repository: false });
          setLoading(false);
        }
        return;
      }

      try {
        const result = await summarizeRepository(rootHandle);
        if (active && token === requestRef.current) {
          setSummary(result);
        }
      } catch {
        if (active && token === requestRef.current) {
          setError("Could not read repository metadata.");
        }
      } finally {
        if (active && token === requestRef.current) {
          setLoading(false);
        }
      }
    }, 0);

    return () => {
      active = false;
    };
  }, [tree]);

  const capabilities = Object.values(GIT_CAPABILITIES);

  return (
    <div className="git-panel">
      {loading ? (
        <p className="git-empty">Reading repository metadata...</p>
      ) : error ? (
        <p className="git-error">{error}</p>
      ) : summary?.unsupported ? (
        <div className="git-state">
          <ShieldAlert size={18} />
          <p className="git-state-title">No directory opened</p>
          <p className="git-state-body">
            Open a project directory to inspect its git metadata.
          </p>
        </div>
      ) : !summary?.repository ? (
        <div className="git-state">
          <Info size={18} />
          <p className="git-state-title">Not a git repository</p>
          <p className="git-state-body">
            No <code>.git</code> directory was found at the project root, so
            version-control metadata is not available.
          </p>
        </div>
      ) : (
        <>
          <div className="git-header">
            <GitBranch size={14} />
            <span className="git-branch">{summary.branch || "detached"}</span>
            {summary.shortCommit && (
              <span className="git-commit">{summary.shortCommit}</span>
            )}
          </div>

          <p className="git-repo-note">
            Git repository detected from <code>.git/HEAD</code>. Full status,
            diffs, staging, and commits need a native git binary, which browsers
            cannot run — this panel reports real metadata only.
          </p>

          <div className="git-section-header">Capabilities</div>
          <div className="git-capabilities">
            {capabilities.map((cap) => (
              <div
                key={cap.label}
                className={`git-capability${
                  cap.available ? "" : " git-capability-disabled"
                }`}
              >
                <span className="git-capability-label">{cap.label}</span>
                <span className="git-capability-detail">{cap.detail}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}