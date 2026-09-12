"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./GitPanel.css";
import { GitBranch, Info, ShieldAlert, Plus, RefreshCw, Send, ArrowUp, ArrowDown } from "lucide-react";
import { getRootHandle } from "../../../lib/filesystem/filesystem";
import {
  GIT_CAPABILITIES,
  summarizeRepository,
  gitStatus,
  gitStage,
  gitUnstage,
  gitCommit,
  gitBranches,
  gitCheckout,
  gitCreateBranch,
  gitLog,
  gitPush,
  gitPull,
} from "../../../lib/git";

function GitFileIcon({ status }) {
  if (status === "A") return <span className="git-file-status git-file-added">A</span>;
  if (status === "M" || status === "m") return <span className="git-file-status git-file-modified">M</span>;
  if (status === "D" || status === "d") return <span className="git-file-status git-file-deleted">D</span>;
  if (status === "R") return <span className="git-file-status git-file-renamed">R</span>;
  if (status === "?") return <span className="git-file-status git-file-untracked">?</span>;
  return <span className="git-file-status">{status}</span>;
}

export default function GitPanel({ tree }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gitFiles, setGitFiles] = useState([]);
  const [branch, setBranch] = useState(null);
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [showBranchList, setShowBranchList] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [operationMessage, setOperationMessage] = useState(null);
  const requestRef = useRef(0);

  const showMessage = useCallback((msg, type = "info") => {
    setOperationMessage({ text: msg, type });
    setTimeout(() => setOperationMessage(null), 4000);
  }, []);

  const refreshStatus = useCallback(async () => {
    const statusResult = await gitStatus();
    if (statusResult.ok) {
      setGitFiles(statusResult.files);
      setBranch(statusResult.branch);
      setAhead(statusResult.ahead);
      setBehind(statusResult.behind);
    }
  }, []);

  useEffect(() => {
    const token = ++requestRef.current;
    let active = true;

    window.setTimeout(async () => {
      if (!active || token !== requestRef.current) return;
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
          if (result.repository) {
            const statusResult = await gitStatus();
            if (active && token === requestRef.current) {
              if (statusResult.ok) {
                setGitFiles(statusResult.files);
                setBranch(statusResult.branch || result.branch);
                setAhead(statusResult.ahead);
                setBehind(statusResult.behind);
              }
            }
          }
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

    return () => { active = false; };
  }, [tree]);

  const handleStage = useCallback(async (paths) => {
    const result = await gitStage(paths);
    if (result.ok) {
      await refreshStatus();
      showMessage(`Staged ${paths.length} file${paths.length === 1 ? "" : "s"}`, "success");
    } else {
      showMessage(`Stage failed: ${result.reason}`, "error");
    }
  }, [refreshStatus, showMessage]);

  const handleUnstage = useCallback(async (paths) => {
    const result = await gitUnstage(paths);
    if (result.ok) {
      await refreshStatus();
      showMessage(`Unstaged ${paths.length} file${paths.length === 1 ? "" : "s"}`, "success");
    } else {
      showMessage(`Unstage failed: ${result.reason}`, "error");
    }
  }, [refreshStatus, showMessage]);

  const handleStageAll = useCallback(async () => {
    const unstaged = gitFiles
      .filter((f) => f.indexStatus === "?" || f.workTreeStatus !== " ")
      .map((f) => f.path);
    if (unstaged.length > 0) {
      await handleStage(unstaged);
    }
  }, [gitFiles, handleStage]);

  const handleUnstageAll = useCallback(async () => {
    const staged = gitFiles
      .filter((f) => f.indexStatus !== " " && f.indexStatus !== "?")
      .map((f) => f.path);
    if (staged.length > 0) {
      await handleUnstage(staged);
    }
  }, [gitFiles, handleUnstage]);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    const result = await gitCommit(commitMsg.trim());
    setCommitting(false);
    if (result.ok) {
      setCommitMsg("");
      await refreshStatus();
      showMessage("Committed successfully", "success");
    } else {
      showMessage(`Commit failed: ${result.reason}`, "error");
    }
  }, [commitMsg, refreshStatus, showMessage]);

  const handleLoadBranches = useCallback(async () => {
    const result = await gitBranches();
    if (result.ok) {
      setBranches(result.branches);
      setShowBranchList(true);
    }
  }, []);

  const handleCheckout = useCallback(async (branchName) => {
    const result = await gitCheckout(branchName);
    if (result.ok) {
      setShowBranchList(false);
      await refreshStatus();
      showMessage(`Switched to ${branchName}`, "success");
    } else {
      showMessage(`Checkout failed: ${result.reason}`, "error");
    }
  }, [refreshStatus, showMessage]);

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    const result = await gitCreateBranch(newBranchName.trim());
    setCreatingBranch(false);
    if (result.ok) {
      setNewBranchName("");
      await refreshStatus();
      showMessage(`Created branch ${newBranchName.trim()}`, "success");
    } else {
      showMessage(`Create branch failed: ${result.reason}`, "error");
    }
  }, [newBranchName, refreshStatus, showMessage]);

  const handleLoadLog = useCallback(async () => {
    const result = await gitLog(15);
    if (result.ok) {
      setLogEntries(result.entries);
      setShowLog(true);
    }
  }, []);

  const handlePush = useCallback(async () => {
    setPushing(true);
    const result = await gitPush();
    setPushing(false);
    if (result.ok) {
      await refreshStatus();
      showMessage("Pushed successfully", "success");
    } else {
      showMessage(`Push failed: ${result.reason}`, "error");
    }
  }, [refreshStatus, showMessage]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    const result = await gitPull();
    setPulling(false);
    if (result.ok) {
      await refreshStatus();
      showMessage("Pulled successfully", "success");
    } else {
      showMessage(`Pull failed: ${result.reason}`, "error");
    }
  }, [refreshStatus, showMessage]);

  const stagedFiles = gitFiles.filter((f) => f.indexStatus !== " " && f.indexStatus !== "?");
  const unstagedFiles = gitFiles.filter((f) => f.workTreeStatus !== " " || f.indexStatus === "?");

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
          <p className="git-state-body">Open a project directory to inspect its git metadata.</p>
        </div>
      ) : !summary?.repository ? (
        <div className="git-state">
          <Info size={18} />
          <p className="git-state-title">Not a git repository</p>
          <p className="git-state-body">No <code>.git</code> directory was found at the project root.</p>
        </div>
      ) : (
        <>
          <div className="git-header">
            <GitBranch size={14} />
            <span className="git-branch">{branch || "detached"}</span>
            {ahead > 0 && <span className="git-ahead" title={`${ahead} commits ahead`}>↑{ahead}</span>}
            {behind > 0 && <span className="git-behind" title={`${behind} commits behind`}>↓{behind}</span>}
            <span className="git-spacer" />
            <button type="button" className="git-action-btn" onClick={refreshStatus} title="Refresh">
              <RefreshCw size={12} />
            </button>
          </div>

          {operationMessage && (
            <div className={`git-operation-message git-operation-${operationMessage.type}`}>
              {operationMessage.text}
            </div>
          )}

          <div className="git-actions-row">
            <button type="button" className="git-action-btn" onClick={handleStageAll} title="Stage All">
              Stage All
            </button>
            <button type="button" className="git-action-btn" onClick={handleUnstageAll} title="Unstage All">
              Unstage All
            </button>
            <button type="button" className="git-action-btn" onClick={handleLoadBranches} title="Branches">
              Branches
            </button>
            <button type="button" className="git-action-btn" onClick={handleLoadLog} title="Log">
              Log
            </button>
            <button type="button" className="git-action-btn" onClick={handlePush} disabled={pushing || ahead === 0} title="Push">
              <ArrowUp size={12} />{pushing ? "..." : "Push"}
            </button>
            <button type="button" className="git-action-btn" onClick={handlePull} disabled={pulling || behind === 0} title="Pull">
              <ArrowDown size={12} />{pulling ? "..." : "Pull"}
            </button>
          </div>

          {stagedFiles.length > 0 && (
            <div className="git-section">
              <div className="git-section-header">Staged Changes ({stagedFiles.length})</div>
              <ul className="git-file-list">
                {stagedFiles.map((file) => (
                  <li key={file.path} className="git-file-item">
                    <GitFileIcon status={file.indexStatus} />
                    <span className="git-file-path">{file.path}</span>
                    <button type="button" className="git-file-action" onClick={() => handleUnstage([file.path])}>-</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {unstagedFiles.length > 0 && (
            <div className="git-section">
              <div className="git-section-header">Changes ({unstagedFiles.length})</div>
              <ul className="git-file-list">
                {unstagedFiles.map((file) => (
                  <li key={file.path} className="git-file-item">
                    <GitFileIcon status={file.indexStatus !== " " ? file.indexStatus : file.workTreeStatus} />
                    <span className="git-file-path">{file.path}</span>
                    {file.indexStatus !== "?" && (
                      <button type="button" className="git-file-action git-file-action-add" onClick={() => handleStage([file.path])}>+</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gitFiles.length === 0 && (
            <p className="git-empty">Working tree clean</p>
          )}

          <div className="git-commit-box">
            <input
              type="text"
              className="git-commit-input"
              placeholder="Commit message..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && commitMsg.trim()) handleCommit(); }}
              disabled={committing || stagedFiles.length === 0}
            />
            <button
              type="button"
              className="git-commit-btn"
              onClick={handleCommit}
              disabled={committing || !commitMsg.trim() || stagedFiles.length === 0}
            >
              {committing ? "..." : "Commit"}
            </button>
          </div>

          {showBranchList && (
            <div className="git-section">
              <div className="git-section-header">Branches</div>
              <ul className="git-branch-list">
                {branches.map((b) => (
                  <li key={b} className={`git-branch-item ${b === branch ? "git-branch-current" : ""}`}>
                    <button type="button" className="git-branch-btn" onClick={() => handleCheckout(b)}>
                      {b}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="git-new-branch">
                <input
                  type="text"
                  className="git-branch-input"
                  placeholder="New branch name..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newBranchName.trim()) handleCreateBranch(); }}
                />
                <button
                  type="button"
                  className="git-action-btn"
                  onClick={handleCreateBranch}
                  disabled={creatingBranch || !newBranchName.trim()}
                >
                  <Plus size={12} />
                </button>
              </div>
              <button type="button" className="git-action-btn git-collapse-btn" onClick={() => setShowBranchList(false)}>
                Close
              </button>
            </div>
          )}

          {showLog && (
            <div className="git-section">
              <div className="git-section-header">Recent Commits</div>
              <ul className="git-log-list">
                {logEntries.map((entry) => (
                  <li key={entry.hash} className="git-log-entry">
                    <span className="git-log-hash">{entry.hash}</span>
                    <span className="git-log-message">{entry.message}</span>
                    <span className="git-log-date">{entry.date}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="git-action-btn git-collapse-btn" onClick={() => setShowLog(false)}>
                Close
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
