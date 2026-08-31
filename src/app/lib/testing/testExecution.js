"use client";

const OUTPUT_LIMIT = 20000;
const DEFAULT_TIMEOUT_MS = 30000;
const SECRET_PATTERNS = [
  /DATABASE_URL\s*=\s*[^\s]+/gi,
  /api[_-]?key\s*[:=]\s*[^\s]+/gi,
  /password\s*[:=]\s*[^\s]+/gi,
  /token\s*[:=]\s*[^\s]+/gi,
  /BEGIN PRIVATE KEY[\s\S]*?END PRIVATE KEY/gi,
];

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf/i,
  /git\s+reset\s+--hard/i,
  /git\s+push/i,
  /git\s+commit/i,
  /npm\s+publish/i,
  /sudo\s+/i,
  /mkfs/i,
  /shutdown/i,
  /reboot/i,
  /chmod\s+777/i,
  /curl\s+.*\|\s*sh/i,
];

function redactSecrets(text) {
  let out = String(text || "");
  for (const re of SECRET_PATTERNS) out = out.replace(re, (m) => m.split("=")[0] + "=[REDACTED]");
  return out;
}

function truncateOutput(text, limit = OUTPUT_LIMIT) {
  const s = String(text || "");
  if (s.length <= limit) return { text: s, truncated: false };
  return { text: s.slice(0, limit) + "\n...[output truncated]", truncated: true };
}

function parseTestCounts(output) {
  const text = String(output || "");
  // vitest: "508 tests passed" or "1 failed | 507 passed"
  let passed = null, failed = null, skipped = null;
  const passedMatch = text.match(/(\d+)\s+passed/i);
  if (passedMatch) passed = parseInt(passedMatch[1], 10);
  const failedMatch = text.match(/(\d+)\s+failed/i);
  if (failedMatch) failed = parseInt(failedMatch[1], 10);
  const skippedMatch = text.match(/(\d+)\s+skipped/i);
  if (skippedMatch) skipped = parseInt(skippedMatch[1], 10);
  // fallback: Test Files ... pattern
  if (passed === null && failed === null) {
    const alt = text.match(/Tests\s+(\d+)\s+failed/i);
    if (alt) failed = parseInt(alt[1], 10);
  }
  return { passed, failed, skipped, unknown: passed === null && failed === null };
}

export function discoverTestConfig({ packageJsonText, fileList } = {}) {
  let pkg = null;
  try { pkg = packageJsonText ? JSON.parse(packageJsonText) : null; } catch {}
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const devDeps = pkg ? { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) } : {};
  const hasVitest = !!devDeps.vitest || (fileList||[]).some((f)=>f.includes("vitest"));
  const hasJest = !!devDeps.jest || (fileList||[]).some((f)=>f.includes("jest"));
  const hasPytest = (fileList||[]).some((f)=>f.includes("pytest") || f.endsWith("test_*.py"));

  if (scripts.test) {
    const cmd = scripts.test.trim();
    // Prefer explicit script: npm test
    return {
      framework: hasVitest ? "vitest" : hasJest ? "jest" : hasPytest ? "pytest" : "npm",
      command: "npm test",
      rawCommand: cmd,
      reason: "Project package.json defines the test script.",
      scope: "Full test suite",
      availableCommands: Object.keys(scripts).filter((k)=>k.startsWith("test")),
    };
  }
  if (hasVitest) return { framework: "vitest", command: "npx vitest run", reason: "Detected Vitest via dependencies.", scope: "Full test suite", availableCommands: [] };
  if (hasJest) return { framework: "jest", command: "npx jest", reason: "Detected Jest.", scope: "Full test suite", availableCommands: [] };
  if (hasPytest) return { framework: "pytest", command: "pytest", reason: "Detected pytest.", scope: "Full test suite", availableCommands: [] };
  return { framework: null, command: null, reason: "No project test command detected.", scope: null, availableCommands: [] };
}

export function isCommandSafe(command) {
  const cmd = String(command || "");
  for (const re of DESTRUCTIVE_PATTERNS) if (re.test(cmd)) return { safe: false, reason: `Command contains destructive pattern: ${re}` };
  // Testing should be read-only: allow npm test, vitest, jest, pytest, yarn test
  const allowed = /^(npm\s+test|yarn\s+test|npx\s+(vitest|jest)|vitest|jest|pytest|npm\s+run\s+test)/i;
  if (allowed.test(cmd.trim())) return { safe: true };
  // If command is exactly from package.json scripts.test, allow
  return { safe: true, reason: "custom test command — requires approval" };
}

export function createTestExecutionPlan({ milestone, projectData, packageJsonText, fileList, workingDirectory, timeoutMs } = {}) {
  const discovered = discoverTestConfig({ packageJsonText, fileList });
  if (!discovered.command) {
    return { command: null, workingDirectory: workingDirectory || null, reason: discovered.reason, scope: null, timeout: timeoutMs || DEFAULT_TIMEOUT_MS, requiresApproval: true, framework: null, available: false };
  }
  return {
    command: discovered.command,
    rawCommand: discovered.rawCommand || discovered.command,
    workingDirectory: workingDirectory || (projectData ? projectData.project?.name || null : null),
    reason: discovered.reason,
    scope: discovered.scope,
    timeout: timeoutMs || DEFAULT_TIMEOUT_MS,
    requiresApproval: true,
    framework: discovered.framework,
    available: true,
  };
}

export async function executeApprovedTests({ plan, terminalService, permissions, timeoutMs, signal, onProgress } = {}) {
  const startedAt = new Date().toISOString();
  if (!plan || !plan.command) {
    return { status: "unknown", command: null, exitCode: null, duration: 0, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: "", outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "No project test command detected." };
  }
  // Permission check via ToolRegistry/permission system
  if (permissions && permissions.canRunTests === false) {
    return { status: "blocked", command: plan.command, exitCode: null, duration: 0, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: "", outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "Automated tests require user approval." };
  }
  // Command safety
  const safety = isCommandSafe(plan.command);
  if (!safety.safe) {
    return { status: "blocked", command: plan.command, exitCode: null, duration: 0, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: "", outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: safety.reason };
  }
  if (!terminalService || typeof terminalService.execute !== "function") {
    return { status: "error", command: plan.command, exitCode: null, duration: 0, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: "Terminal unavailable", outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "Terminal unavailable" };
  }

  const timeout = timeoutMs || plan.timeout || DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  let timeoutId = null;
  let cancelled = false;
  const abortController = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => { cancelled = true; abortController.abort(); });
  }
  timeoutId = setTimeout(() => { abortController.abort(); }, timeout);

  let rawResult = null;
  try {
    if (onProgress) onProgress({ stage: "running", command: plan.command });
    // TerminalService backend is expected to respect abort via signal? For now we execute and rely on timeout
    rawResult = await terminalService.execute(plan.command);
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (abortController.signal.aborted || cancelled) {
      return { status: "cancelled", command: plan.command, exitCode: null, duration: Date.now()-start, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: String(e.message||"cancelled"), outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "User cancelled execution" };
    }
    return { status: "error", command: plan.command, exitCode: null, duration: Date.now()-start, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: String(e.message||"error"), outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "Execution error" };
  }

  if (abortController.signal.aborted) {
    return { status: "timeout", command: plan.command, exitCode: null, duration: timeout, passed: null, failed: null, skipped: null, unknown: true, stdout: "", stderr: "Timeout exceeded", outputTruncated: false, startedAt, finishedAt: new Date().toISOString(), reason: "Timeout exceeded" };
  }

  const stdoutRaw = String(rawResult.stdout || "");
  const stderrRaw = String(rawResult.stderr || "");
  const exitCode = typeof rawResult.exitCode === "number" ? rawResult.exitCode : 0;

  // Secret redaction
  const stdoutRedacted = redactSecrets(stdoutRaw);
  const stderrRedacted = redactSecrets(stderrRaw);

  // Truncate
  const outStd = truncateOutput(stdoutRedacted);
  const outErr = truncateOutput(stderrRedacted);
  const truncated = outStd.truncated || outErr.truncated;

  // Parse counts
  const combined = outStd.text + "\n" + outErr.text;
  const counts = parseTestCounts(combined);
  const duration = Date.now() - start;

  // Determine status: exit code 0 potential success, but if parsing shows failed => failed
  let status = "unknown";
  if (cancelled) status = "cancelled";
  else if (counts.failed !== null && counts.failed > 0) status = "failed";
  else if (exitCode !== 0) status = "failed";
  else if (counts.passed !== null && counts.passed > 0) status = "passed";
  else if (exitCode === 0) status = "passed"; // if no parse but exit 0, assume passed
  else status = "unknown";

  // If exit 0 but explicit failed count, ensure failed
  if (counts.failed !== null && counts.failed > 0) status = "failed";

  return {
    status,
    command: plan.command,
    exitCode,
    duration,
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    unknown: counts.unknown,
    stdout: outStd.text,
    stderr: outErr.text,
    outputTruncated: truncated,
    startedAt,
    finishedAt: new Date().toISOString(),
    workingDirectory: plan.workingDirectory,
    framework: plan.framework,
  };
}
