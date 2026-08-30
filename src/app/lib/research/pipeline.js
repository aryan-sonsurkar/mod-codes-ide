"use client";
import { getSection, setSection } from "../project/modcodes";

function normalizeUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls || []) {
    const n = normalizeUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim().slice(0, 200) : null;
}

function extractTextFromHtml(html) {
  let text = String(html || "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, 8000);
}

async function fetchWithTimeout(url, { timeoutMs = 8000, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  try {
    const res = await fetch(url, { signal: combinedSignal, mode: "cors", headers: { Accept: "text/html, text/plain" } });
    const text = await res.text().catch(() => "");
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, status: res.status, text, headers: res.headers };
    return { ok: true, status: res.status, text, headers: res.headers, finalUrl: res.url };
  } catch (error) {
    clearTimeout(timeout);
    const name = error && error.name ? error.name : "Error";
    const isCors = name === "TypeError" && String(error.message || "").toLowerCase().includes("fetch");
    return { ok: false, error, errorName: name, isCors };
  }
}

async function summarizeWithProvider({ providerSession, query, text }) {
  if (!providerSession || typeof providerSession.sendMessage !== "function") return null;
  try {
    const prompt = `Summarize for research query "${query.slice(0,200)}":\n\n${text.slice(0, 4000)}\n\nProvide 2-3 bullet findings, no chain-of-thought, concise.`;
    const res = await providerSession.sendMessage({ content: prompt, options: { temperature: 0.2 } });
    const summary = typeof res.text === "string" ? res.text.trim().slice(0, 1000) : null;
    return summary;
  } catch {
    return null;
  }
}

function localRelevantFindings({ text, query }) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean).slice(0,5);
  const sentences = String(text || "").split(/(?<=[.!?])\s+/).slice(0, 20);
  const scored = sentences.map((s) => {
    const low = s.toLowerCase();
    let score = 0;
    for (const t of terms) if (low.includes(t)) score += 1;
    return { s: s.trim(), score };
  }).filter((x) => x.s.trim().length > 20).sort((a,b)=>b.score-a.score).slice(0,3);
  return scored.map((x)=>x.s).join(" ") || text.slice(0, 400);
}

export function createResearchPipeline({ providerSession } = {}) {
  async function retrieveSources({ urls, query, timeoutMs, signal, onProgress }) {
    const deduped = dedupeUrls(urls);
    const results = [];
    for (let i = 0; i < deduped.length; i++) {
      const url = deduped[i];
      if (signal && signal.aborted) break;
      if (onProgress) onProgress({ stage: "fetching", url, index: i, total: deduped.length });
      const fetched = await fetchWithTimeout(url, { timeoutMs: timeoutMs || 8000, signal });
      const accessedAt = new Date().toISOString();
      if (!fetched.ok) {
        const status = fetched.isCors ? "inaccessible" : fetched.errorName === "TimeoutError" ? "inaccessible" : fetched.status ? "inaccessible" : "inaccessible";
        const reason = fetched.isCors ? "CORS blocked or network error" : fetched.errorName === "TimeoutError" ? "timeout" : fetched.status ? `HTTP ${fetched.status}` : String(fetched.error?.message || "fetch failed");
        results.push({
          url,
          title: null,
          accessedAt,
          status,
          summary: null,
          relevantFindings: null,
          error: reason,
          rawText: "",
        });
        continue;
      }
      const ct = fetched.headers ? String(fetched.headers.get("content-type") || "") : "";
      const isHtml = ct.includes("html") || fetched.text.trim().startsWith("<");
      const rawText = isHtml ? extractTextFromHtml(fetched.text) : String(fetched.text || "").slice(0,8000);
      const title = isHtml ? extractTitle(fetched.text) : url;
      if (!rawText || rawText.length < 80) {
        results.push({
          url: fetched.finalUrl || url,
          title: title || url,
          accessedAt,
          status: "partially_retrieved",
          summary: rawText ? rawText.slice(0, 400) : null,
          relevantFindings: rawText ? localRelevantFindings({ text: rawText, query }) : null,
          error: rawText ? "content too short" : "empty result",
          rawText,
        });
        continue;
      }
      // try AI summarization if provider available
      let summary = await summarizeWithProvider({ providerSession, query, text: rawText });
      if (!summary) summary = localRelevantFindings({ text: rawText, query });
      const relevantFindings = summary;
      results.push({
        url: fetched.finalUrl || url,
        title: title || url,
        accessedAt,
        status: "retrieved",
        summary,
        relevantFindings,
        error: null,
        rawText,
      });
    }
    return results;
  }

  async function runResearch({ modcodesData, depth = "quick", query, urls, timeoutMs, signal, onProgress } = {}) {
    if (!modcodesData) throw new Error("modcodesData required");
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    const idea = String(query || modcodesData.sections?.Project || modcodesData.project?.name || "project").trim();
    const effectiveQuery = idea.slice(0, 200);
    const desiredDepth = depth === "deep" ? "deep" : "quick";
    const discoveredUrls = Array.isArray(urls) && urls.length ? dedupeUrls(urls) : [];
    // If no URLs and deep, attempt to suggest sources via local heuristic (no fabrication — mark as ai-generated)
    const sources = discoveredUrls.length ? await retrieveSources({ urls: discoveredUrls, query: effectiveQuery, timeoutMs, signal, onProgress }) : [];

    // Handle empty results
    let findings;
    if (sources.length === 0) {
      findings = desiredDepth === "deep"
        ? `Research (deep, local): No external sources retrieved (urls: none provided or all blocked). Findings derived from project context only — provide URLs for verified evidence.\n- Idea: ${effectiveQuery.slice(0,120)}\n- Note: Add source URLs to enable verified evidence.`
        : `Research (quick, local): ${effectiveQuery.slice(0,120)} — concise findings from project context. Provide URLs to enrich with verified sources.`;
      // mark as ai-generated interpretation (no source)
      sources.push({
        url: null,
        title: "Local project context",
        accessedAt: new Date().toISOString(),
        status: "ai-generated",
        summary: findings,
        relevantFindings: findings,
        error: null,
        rawText: findings,
      });
    } else {
      const retrieved = sources.filter((s)=>s.status==="retrieved");
      const partial = sources.filter((s)=>s.status==="partially_retrieved");
      const inaccessible = sources.filter((s)=>s.status==="inaccessible");
      const bullet = retrieved.map((s)=>`- ${s.title || s.url}: ${s.relevantFindings?.slice(0,180) || s.summary?.slice(0,180)} [${s.url}]`).join("\n");
      const notePartial = partial.length ? `\nPartially retrieved: ${partial.length} source(s) with limited content.` : "";
      const noteInacc = inaccessible.length ? `\nInaccessible: ${inaccessible.length} source(s) — ${inaccessible.map((s)=>s.url + " ("+s.error+")").join(", ")}` : "";
      findings = `${desiredDepth === "deep" ? "Deep" : "Quick"} research for "${effectiveQuery.slice(0,80)}":\n${bullet || "(no retrieved content)"}${notePartial}${noteInacc}`;
      if (desiredDepth === "deep" && retrieved.length < 2) {
        findings += `\n- Note: deep research expected ≥2 verified sources; got ${retrieved.length}. Provide more URLs or retry.`;
      }
    }

    // Persist findings into .modcodes — append to existing Research (incremental), not overwrite
    const existingResearch = String(modcodesData.sections?.Research || "");
    const sessionId = `R${Date.now().toString(36).toUpperCase()}`;
    const appendedResearch = existingResearch
      ? `${existingResearch}\n\n---\n\n## Session ${sessionId} (${desiredDepth}, ${new Date().toISOString()})\nQuery: ${effectiveQuery}\n\n${findings}`
      : `## Session ${sessionId} (${desiredDepth}, ${new Date().toISOString()})\nQuery: ${effectiveQuery}\n\n${findings}`;

    // Sources metadata — dedupe by URL, preserve provenance
    const existingSourcesText = String(modcodesData.sections?.Sources || "");
    const newSourcesBlock = sources.map((s, i) => {
      if (!s.url) return `• [${s.status}] ${s.title} — ${s.summary?.slice(0,180) || ""} (${s.accessedAt})`;
      return `${existingSourcesText ? "" : ""}${s.url} | ${s.title || "—"} | ${s.status} | ${s.accessedAt} | ${s.summary ? s.summary.slice(0,160).replace(/\n/g," ") : s.error || ""}`;
    }).join("\n");
    const mergedSources = existingSourcesText
      ? `${existingSourcesText.trim()}\n${newSourcesBlock}`
      : newSourcesBlock;

    const historyEntry = `\n- ${new Date().toISOString()} ${sessionId} ${desiredDepth} query="${effectiveQuery.slice(0,80)}" sources=${sources.length} retrieved=${sources.filter(s=>s.status==="retrieved").length}`;
    const existingHistory = String(modcodesData.sections?.["Research History"] || "");

    let next = setSection(modcodesData, "Research", appendedResearch);
    next = setSection(next, "Sources", mergedSources);
    next = setSection(next, "Research History", `${existingHistory}${historyEntry}`);

    if (onProgress) onProgress({ stage: "done", findings, sources, sessionId });

    return { data: next, findings, sources, sessionId, depth: desiredDepth, query: effectiveQuery };
  }

  async function researchDeeper({ modcodesData, query, urls, signal, onProgress }) {
    // continues from existing state — does not restart
    return runResearch({ modcodesData, depth: "deep", query, urls, signal, onProgress });
  }

  return { runResearch, researchDeeper, _helpers: { normalizeUrl, dedupeUrls, extractTextFromHtml, fetchWithTimeout } };
}
