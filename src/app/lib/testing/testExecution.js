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

// M159 Scoped Testing
const SUPPORTED_SCOPED_FRAMEWORKS = new Set(["vitest", "jest"]);

export function isScopedSelectorSafe(framework, fileList) {
  if (!framework || !SUPPORTED_SCOPED_FRAMEWORKS.has(String(framework).toLowerCase())) return false;
  if (!Array.isArray(fileList) || fileList.length === 0) return false;
  // integration/e2e files often contain .integration or e2e — treat as unsafe to isolate
  const hasIntegration = fileList.some((f) => /integration|e2e/i.test(String(f)));
  if (hasIntegration) return false;
  return true;
}

function testFileCandidates(allFiles) {
  return (allFiles || []).filter((f) => /\.test\.(js|ts|jsx|tsx)$/.test(f) || /\.spec\.(js|ts|jsx|tsx)$/.test(f));
}

export function mapSourceFilesToTests({ sourceFiles, allFiles, workspaceGraph, fileContents } = {}) {
  const tests = testFileCandidates(allFiles);
  const sourceSet = new Set((sourceFiles || []).map((s) => String(s)));
  const graph = workspaceGraph || null;
  const result = [];

  for (const test of tests) {
    const base = test.replace(/\.test\.(js|ts|jsx|tsx)$/, "").replace(/\.spec\.(js|ts|jsx|tsx)$/, "");
    let reason = null;
    let sourceMatch = null;

    // 1. exact filename match
    for (const src of sourceSet) {
      const srcBase = src.replace(/\.(js|ts|jsx|tsx)$/, "");
      if (srcBase === base) { reason = "Direct test file match"; sourceMatch = src; break; }
    }
    // 2. directory relationship
    if (!reason) {
      for (const src of sourceSet) {
        const srcDir = src.split("/").slice(0, -1).join("/");
        const testDir = test.split("/").slice(0, -1).join("/");
        if (srcDir && srcDir === testDir && test.includes(src.split("/").pop().replace(/\.(js|ts|jsx|tsx)$/,"").slice(0,5))) { reason = "Directory relationship"; sourceMatch = src; break; }
      }
    }
    // 3. imports / graph
    if (!reason && graph && graph.edges) {
      for (const src of sourceSet) {
        const importsTest = graph.edges.some((e) => e.from === test && e.to === src);
        const testImportsSrc = graph.edges.some((e) => e.from === test && e.to === src);
        if (importsTest || testImportsSrc) { reason = "Test imports changed source file"; sourceMatch = src; break; }
      }
    }
    // 4. fileContents import check fallback
    if (!reason && fileContents) {
      const content = fileContents.get ? fileContents.get(test) : null;
      if (typeof content === "string") {
        for (const src of sourceSet) if (content.includes(src.split("/").pop())) { reason = "Test imports changed source file"; sourceMatch = src; break; }
      }
    }
    if (reason) result.push({ testFile: test, sourceFiles: sourceMatch ? [sourceMatch] : [], reason, evidence: [reason] });
  }

  // Filter out weak substring-only matches already handled; if no strong evidence, return empty to force fallback
  return result;
}

function buildScopedCommand(discovered, testFiles) {
  if (!discovered || !discovered.command || !testFiles.length) return discovered ? discovered.command : null;
  const framework = String(discovered.framework || "").toLowerCase();
  if (framework === "vitest") {
    // Use npx vitest run <files> for safe scoped execution
    return `npx vitest run ${testFiles.join(" ")}`;
  }
  if (framework === "jest") {
    return `npx jest ${testFiles.join(" ")}`;
  }
  if (framework === "pytest") {
    return `pytest ${testFiles.join(" ")}`;
  }
  // fallback: npm test -- <files> (supported by vitest/jest via npm)
  if (discovered.rawCommand) {
    return `${discovered.command} -- ${testFiles.join(" ")}`;
  }
  return discovered.command;
}

const testCache = new Map();
function cacheKey(plan) {
  return `${plan.command}|${plan.scope}|${(plan.testFiles||[]).join(",")}|${plan.framework}`;
}

export function createScopedTestPlan({ milestone, projectData, changeset, packageJsonText, fileList, tree, workspaceGraph, fileContents, workingDirectory, timeoutMs } = {}) {
  const sourceFiles = (() => {
    if (!changeset) return [];
    if (Array.isArray(changeset.operations)) return changeset.operations.map((o)=>o.path).filter(Boolean);
    if (Array.isArray(changeset.changes)) return changeset.changes.map((c)=>c.path).filter(Boolean);
    return [];
  })();

  const discovered = discoverTestConfig({ packageJsonText, fileList });
  if (!discovered.command) {
    return { command: null, scope: "unknown", sourceFiles, testFiles: [], reason: discovered.reason, evidence: [], available: false, framework: null, requiresApproval: true };
  }

  const allFiles = fileList || [];
  const mapped = mapSourceFilesToTests({ sourceFiles, allFiles, workspaceGraph, fileContents });

  if (!sourceFiles.length) {
    return { command: discovered.command, scope: "full", sourceFiles, testFiles: [], reason: "No changed files — full suite", evidence: ["no changed files"], framework: discovered.framework, available: true, requiresApproval: true, timeout: timeoutMs || DEFAULT_TIMEOUT_MS, workingDirectory: workingDirectory || null };
  }
  if (mapped.length === 0) {
    return { command: discovered.command, scope: "full", sourceFiles, testFiles: [], reason: "Unable to establish a safe file-scoped test set", evidence: ["no reliable mapping"], framework: discovered.framework, available: true, requiresApproval: true, timeout: timeoutMs || DEFAULT_TIMEOUT_MS, workingDirectory: workingDirectory || null };
  }
  if (!isScopedSelectorSafe(discovered.framework, mapped.map((m)=>m.testFile))) {
    return { command: discovered.command, scope: "full", sourceFiles, testFiles: [], reason: "Framework does not support safe selectors or integration test detected", evidence: ["unsupported selector"], framework: discovered.framework, available: true, requiresApproval: true, timeout: timeoutMs || DEFAULT_TIMEOUT_MS, workingDirectory: workingDirectory || null };
  }

  const testFiles = mapped.map((m)=>m.testFile);
  const command = buildScopedCommand(discovered, testFiles);
  const safe = isCommandSafe(command);
  if (!safe.safe) {
    return { command: discovered.command, scope: "full", sourceFiles, testFiles: [], reason: safe.reason, evidence: ["unsafe scoped command"], framework: discovered.framework, available: true, requiresApproval: true, timeout: timeoutMs || DEFAULT_TIMEOUT_MS, workingDirectory: workingDirectory || null };
  }

  return {
    command,
    rawCommand: discovered.rawCommand,
    scope: testFiles.length === 1 ? "file" : "related",
    sourceFiles,
    testFiles,
    reason: mapped[0]?.reason || "Direct test file match",
    evidence: mapped.flatMap((m)=>m.evidence),
    framework: discovered.framework,
    available: true,
    requiresApproval: true,
    timeout: timeoutMs || DEFAULT_TIMEOUT_MS,
    workingDirectory: workingDirectory || null,
  };
}

export function getCachedTestResult(plan) {
  const key = cacheKey(plan);
  return testCache.get(key) || null;
}

export function setCachedTestResult(plan, result) {
  const key = cacheKey(plan);
  testCache.set(key, result);
}

export function clearTestCache() { testCache.clear(); }
