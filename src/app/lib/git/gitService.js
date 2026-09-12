import { getBridgeToken } from "../terminal/backends/systemTerminalBackend";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";

async function executeGitCommand(command, bridgeUrl = DEFAULT_BRIDGE_URL) {
  const token = getBridgeToken();
  if (!token) {
    return { ok: false, reason: "Bridge not paired" };
  }

  try {
    const res = await fetch(`${bridgeUrl}/terminals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return { ok: false, reason: `Bridge error ${res.status}` };
    }

    const session = await res.json();
    if (!session.ok || !session.id) {
      return { ok: false, reason: session.error || "Failed to create session" };
    }

    const execRes = await fetch(`${bridgeUrl}/terminals/${session.id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-token": token },
      body: JSON.stringify({ command }),
    });

    if (!execRes.ok) {
      const text = await execRes.text();
      return { ok: false, reason: text || `Bridge error ${execRes.status}` };
    }

    const data = await execRes.json();
    if (data.exitCode !== 0) {
      return { ok: false, reason: data.stderr || "Command failed", exitCode: data.exitCode };
    }

    try {
      await fetch(`${bridgeUrl}/terminals/${session.id}/kill`, {
        method: "POST",
        headers: { "x-bridge-token": token },
      });
    } catch {}

    return { ok: true, stdout: data.stdout || "", stderr: data.stderr || "" };
  } catch (error) {
    return { ok: false, reason: error?.message || "Bridge unreachable" };
  }
}

export async function gitStatus() {
  const result = await executeGitCommand("git status --porcelain=v1");
  if (!result.ok) {
    return { ok: false, reason: result.reason, files: [], branch: null, ahead: 0, behind: 0 };
  }

  const files = result.stdout
    .split("\n")
    .filter((line) => line.length >= 3)
    .map((line) => {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const path = line.slice(3).trim();
      return { path, indexStatus, workTreeStatus };
    });

  const branchResult = await executeGitCommand("git branch --show-current");
  const branch = branchResult.ok ? branchResult.stdout.trim() : null;

  const aheadResult = await executeGitCommand("git rev-list --count @{upstream}..HEAD 2>/dev/null || echo 0");
  const ahead = aheadResult.ok ? parseInt(aheadResult.stdout.trim(), 10) || 0 : 0;

  const behindResult = await executeGitCommand("git rev-list --count HEAD..@{upstream} 2>/dev/null || echo 0");
  const behind = behindResult.ok ? parseInt(behindResult.stdout.trim(), 10) || 0 : 0;

  return { ok: true, files, branch, ahead, behind };
}

export async function gitDiff(path) {
  if (!path) {
    return { ok: false, reason: "No path specified", diff: "" };
  }
  const result = await executeGitCommand(`git diff -- "${path}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason, diff: "" };
  }
  return { ok: true, diff: result.stdout };
}

export async function gitDiffStaged(path) {
  if (!path) {
    return { ok: false, reason: "No path specified", diff: "" };
  }
  const result = await executeGitCommand(`git diff --cached -- "${path}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason, diff: "" };
  }
  return { ok: true, diff: result.stdout };
}

export async function gitDiffHead(path) {
  if (!path) {
    return { ok: false, reason: "No path specified", diff: "" };
  }
  const result = await executeGitCommand(`git diff HEAD -- "${path}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason, diff: "" };
  }
  return { ok: true, diff: result.stdout };
}

export async function gitStage(paths) {
  if (!paths || paths.length === 0) {
    return { ok: false, reason: "No paths specified" };
  }
  const escaped = paths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(" ");
  const result = await executeGitCommand(`git add ${escaped}`);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

export async function gitUnstage(paths) {
  if (!paths || paths.length === 0) {
    return { ok: false, reason: "No paths specified" };
  }
  const escaped = paths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(" ");
  const result = await executeGitCommand(`git reset HEAD -- ${escaped}`);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

export async function gitCommit(message) {
  if (!message || typeof message !== "string" || !message.trim()) {
    return { ok: false, reason: "Commit message is required" };
  }
  const escaped = message.replace(/"/g, '\\"');
  const result = await executeGitCommand(`git commit -m "${escaped}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, output: result.stdout };
}

export async function gitBranches() {
  const result = await executeGitCommand("git branch -a --format='%(refname:short)'");
  if (!result.ok) {
    return { ok: false, reason: result.reason, branches: [] };
  }
  const branches = result.stdout
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return { ok: true, branches };
}

export async function gitCheckout(branch) {
  if (!branch || typeof branch !== "string") {
    return { ok: false, reason: "Branch name is required" };
  }
  const result = await executeGitCommand(`git checkout "${branch.replace(/"/g, '\\"')}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

export async function gitCreateBranch(name) {
  if (!name || typeof name !== "string") {
    return { ok: false, reason: "Branch name is required" };
  }
  const result = await executeGitCommand(`git checkout -b "${name.replace(/"/g, '\\"')}"`);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

export async function gitLog(count = 10) {
  const result = await executeGitCommand(
    `git log --oneline -${count} --format='%h|%s|%an|%ai'`
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason, entries: [] };
  }
  const entries = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, message, author, date] = line.split("|");
      return { hash: hash || "", message: message || "", author: author || "", date: date || "" };
    });
  return { ok: true, entries };
}

export async function gitPush() {
  const result = await executeGitCommand("git push");
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, output: result.stdout };
}

export async function gitPull() {
  const result = await executeGitCommand("git pull");
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, output: result.stdout };
}

export async function gitHasChanges() {
  const result = await executeGitCommand("git status --porcelain");
  if (!result.ok) {
    return { ok: false, reason: result.reason, hasChanges: false };
  }
  return { ok: true, hasChanges: result.stdout.trim().length > 0 };
}
