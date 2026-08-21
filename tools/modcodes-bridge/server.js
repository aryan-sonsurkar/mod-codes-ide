#!/usr/bin/env node
// MODCODES Local Bridge — localhost-only system terminal bridge.
// Security: binds to 127.0.0.1 only, cryptographically random token,
// explicit user pairing, never 0.0.0.0, never internet-exposed.
// AI has no access — USER-ONLY terminal (AI execute remains disabled).

import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.MODCODES_BRIDGE_PORT || "8787", 10);
const TOKEN = crypto.randomBytes(32).toString("hex");
const SESSIONS = new Map(); // id -> { cwd, process, token }

function isAuthorized(req) {
  const token = req.headers["x-bridge-token"] || req.headers["x-bridge-token".toLowerCase()];
  return typeof token === "string" && token === TOKEN;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bridge-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (url.pathname === "/health" && req.method === "GET") {
    json(res, 200, { ok: true, host: HOST, port: PORT });
    return;
  }

  if (url.pathname === "/pair" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { token } = JSON.parse(body || "{}");
        if (token === TOKEN) {
          json(res, 200, { ok: true, paired: true });
        } else {
          json(res, 401, { ok: false, error: "Invalid token" });
        }
      } catch {
        json(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (!isAuthorized(req)) {
    json(res, 401, { ok: false, error: "Unauthorized — missing or invalid x-bridge-token. Check the bridge console for the pairing token." });
    return;
  }

  if (url.pathname === "/terminals" && req.method === "POST") {
    const id = crypto.randomBytes(8).toString("hex");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let cwd = process.cwd();
      try {
        const parsed = body ? JSON.parse(body) : {};
        if (typeof parsed.cwd === "string" && parsed.cwd.length > 0) {
          cwd = parsed.cwd;
        }
      } catch {}
      SESSIONS.set(id, { cwd, process: null });
      json(res, 200, { ok: true, id, cwd });
    });
    return;
  }

  const terminalMatch = url.pathname.match(/^\/terminals\/([^/]+)\/(input|kill|cwd|resize|execute)$/);
  if (terminalMatch) {
    const [, id, action] = terminalMatch;
    const session = SESSIONS.get(id);
    if (!session) {
      json(res, 404, { ok: false, error: "No such terminal session" });
      return;
    }

    if (action === "cwd" && req.method === "GET") {
      json(res, 200, { ok: true, cwd: session.cwd });
      return;
    }

    if (action === "kill" && req.method === "POST") {
      if (session.process) {
        try {
          session.process.kill();
        } catch {}
        session.process = null;
      }
      json(res, 200, { ok: true });
      return;
    }

    if (action === "execute" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let command = "";
        let cwd = session.cwd;
        try {
          const parsed = body ? JSON.parse(body) : {};
          command = typeof parsed.command === "string" ? parsed.command : "";
          if (typeof parsed.cwd === "string" && parsed.cwd.length > 0) {
            cwd = parsed.cwd;
          }
        } catch {
          json(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        if (!command || typeof command !== "string") {
          json(res, 400, { ok: false, error: "Missing command" });
          return;
        }
        const shell = process.platform === "win32" ? "cmd.exe" : process.env.SHELL || "/bin/bash";
        const args = process.platform === "win32" ? ["/c", command] : ["-c", command];
        const child = spawn(shell, args, { cwd, env: { ...process.env, TERM: "xterm-256color" } });
        session.process = child;
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => {
          json(res, 500, { ok: false, error: err.message });
        });
        child.on("close", (code) => {
          session.process = null;
          json(res, 200, { ok: true, stdout, stderr, exitCode: code ?? 0, cwd });
        });
      });
      return;
    }

    if (action === "input" && req.method === "POST") {
      // stdin streaming stub — for now, report not implemented as streaming input requires persistent pty
      json(res, 200, { ok: true, note: "stdin streaming via persistent pty not yet implemented; use /execute for discrete commands" });
      return;
    }

    if (action === "resize" && req.method === "POST") {
      json(res, 200, { ok: true });
      return;
    }
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`MODCODES Local Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Bridge token (keep private, localhost only): ${TOKEN}`);
  console.log(`Pair by sending POST http://${HOST}:${PORT}/pair with {"token":"<above>"} and then include header x-bridge-token on all requests.`);
  console.log(`This bridge is USER-ONLY. AI execute permission remains disabled.`);
});

server.on("error", (err) => {
  console.error("Bridge failed to start:", err.message);
  process.exit(1);
});
