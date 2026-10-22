"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Send,
  ShieldCheck,
  Square,
  Users,
  X,
} from "lucide-react";
import { createOllamaProvider } from "../../../lib/ai/providers/ollama";
import {
  MESH_STATES,
  createGuestSession,
  createHostSession,
} from "../../../lib/ai/meshSession";
import "./MeshPanel.css";

const SYSTEM_PROMPT =
  "You are answering a user on another device through MODCODES Mesh. " +
  "Keep replies concise. You cannot run tools or touch files for them.";

const MAX_CONTEXT_MESSAGES = 20;

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function CopyRow({ text, label = "Copy", testId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mesh-copy-row">
      <textarea
        className="mesh-payload"
        value={text}
        readOnly
        rows={3}
        data-testid={testId}
        onFocus={(event) => event.target.select()}
      />
      <button
        type="button"
        className="mesh-button mesh-button-secondary"
        onClick={handleCopy}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}

function PhraseBanner({ phrase, room }) {
  if (!phrase) return null;
  return (
    <div className="mesh-phrase" data-testid="mesh-phrase">
      <ShieldCheck size={13} />
      <div>
        <span>
          Room <code>{room}</code> · both screens should show:
        </span>
        <strong>{phrase}</strong>
        <span className="mesh-phrase-note">
          Compare out loud before typing anything. If the words differ, stop.
        </span>
      </div>
    </div>
  );
}

function Transcript({ entries, streaming }) {
  if (entries.length === 0 && !streaming) {
    return (
      <p className="mesh-empty">
        Nothing said yet. The host&apos;s Ollama answers; nothing is stored on a
        server.
      </p>
    );
  }
  return (
    <div className="mesh-transcript" data-testid="mesh-transcript">
      {entries.map((entry, index) => (
        <div key={`${entry.role}-${index}`} className={`mesh-line mesh-line-${entry.role}`}>
          <span className="mesh-line-role">{entry.role === "user" ? "You" : entry.role === "assistant" ? "Model" : "Note"}</span>
          <p>{entry.text}</p>
        </div>
      ))}
      {streaming && (
        <div className="mesh-line mesh-line-assistant">
          <span className="mesh-line-role">Model</span>
          <p>{streaming}</p>
        </div>
      )}
    </div>
  );
}

function HostTab({ baseUrl }) {
  const [phase, setPhase] = useState("idle");
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [phrase, setPhrase] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [check, setCheck] = useState("checking");
  const [entries, setEntries] = useState([]);
  const [streaming, setStreaming] = useState("");
  const sessionRef = useRef(null);
  const modelsRef = useRef([]);
  const busyRef = useRef(false);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      sessionRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const provider = createOllamaProvider({ baseUrl });
    provider
      .testConnection()
      .then((result) => {
        if (active) setCheck(result.ok ? "ok" : "error");
      })
      .catch(() => {
        if (active) setCheck("error");
      });
    return () => {
      active = false;
    };
  }, [baseUrl]);

  const publishModels = useCallback(async () => {
    const provider = createOllamaProvider({ baseUrl });
    let ids = [];
    try {
      const list = await provider.getModels();
      ids = list.map((model) => model.id).filter(Boolean);
    } catch {
      ids = [];
    }
    modelsRef.current = ids;
    if (ids.length === 0) {
      sessionRef.current?.send({
        t: "error",
        id: "models",
        message: "The host has no Ollama models installed",
      });
      return;
    }
    sessionRef.current?.send({ t: "models", models: ids });
  }, [baseUrl]);

  const runChat = useCallback(async (message) => {
    if (busyRef.current) {
      sessionRef.current?.send({
        t: "error",
        id: message.id,
        message: "Host is busy with another request. Try again in a moment.",
      });
      return;
    }
    if (!modelsRef.current.includes(message.model)) {
      sessionRef.current?.send({
        t: "error",
        id: message.id,
        message: `Model ${message.model} is not available on the host`,
      });
      return;
    }

    const userText = message.messages[message.messages.length - 1]?.content || "";
    setEntries((prev) => [...prev, { role: "user", text: userText }]);
    busyRef.current = true;
    setStreaming("");
    const controller = new AbortController();
    controllerRef.current = controller;
    let text = "";
    let failed = null;

    const provider = createOllamaProvider({ baseUrl });
    try {
      const stream = await provider.streamChat({
        model: message.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...message.messages.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
        ],
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          text += chunk.text;
          if (mountedRef.current) setStreaming(text);
          sessionRef.current?.send({ t: "chunk", id: message.id, text: chunk.text });
        } else if (chunk.type === "error") {
          failed = chunk.error?.message || "Ollama stopped responding";
          break;
        } else if (chunk.type === "done") {
          break;
        }
      }
    } catch (caught) {
      failed = caught?.message || "The host could not reach Ollama";
    }

    busyRef.current = false;
    controllerRef.current = null;
    if (failed) {
      sessionRef.current?.send({ t: "error", id: message.id, message: failed });
      setEntries((prev) => [...prev, { role: "system", text: failed }]);
    } else {
      sessionRef.current?.send({ t: "done", id: message.id });
      if (text) setEntries((prev) => [...prev, { role: "assistant", text }]);
    }
    if (mountedRef.current) setStreaming("");
  }, [baseUrl]);

  const handleMessage = useCallback(
    (message) => {
      if (message.t === "chat") {
        runChat(message);
      } else if (message.t === "stop") {
        if (controllerRef.current) {
          controllerRef.current.abort();
        }
      }
    },
    [runChat]
  );

  const startHosting = async () => {
    setPhase("creating");
    setError(null);
    const session = createHostSession({
      createPeerConnection: () => new RTCPeerConnection({ iceServers: [] }),
    });
    sessionRef.current = session;
    session.on("open", () => {
      if (mountedRef.current) setPhase("open");
      publishModels();
    });
    session.on("message", handleMessage);
    session.on("invalid", (reason) => {
      if (mountedRef.current) {
        setEntries((prev) => [
          ...prev,
          { role: "system", text: `Ignored an invalid message: ${reason}` },
        ]);
      }
    });
    session.on("close", () => {
      if (mountedRef.current) setPhase("closed");
    });
    try {
      const text = await session.start();
      if (!mountedRef.current) return;
      setOffer(text);
      setRoom(session.getRoom());
      setPhase("offer");
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught?.message || "Could not create an offer");
      setPhase("error");
    }
  };

  const connect = async () => {
    if (!sessionRef.current) return;
    setError(null);
    setPhase("connecting");
    try {
      const nextPhrase = await sessionRef.current.acceptAnswer(answer);
      if (!mountedRef.current) return;
      setPhrase(nextPhrase);
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught?.message || "That answer did not work");
      setPhase("offer");
    }
  };

  const stop = () => {
    controllerRef.current?.abort();
    sessionRef.current?.close();
    sessionRef.current = null;
    setPhase("idle");
    setOffer("");
    setAnswer("");
    setPhrase(null);
    setRoom(null);
    setEntries([]);
    setStreaming("");
  };

  if (check === "error") {
    return (
      <div className="mesh-body" data-testid="mesh-host">
        <p className="mesh-warning">
          <AlertTriangle size={13} /> This tab can&apos;t reach Ollama, so there
          is nothing to share yet. Fix the connection in Local Link first, then
          reopen this dialog.
        </p>
        <p className="mesh-hint">
          Mesh never opens a port by itself — it just moves prompts between two
          browsers you pair.
        </p>
      </div>
    );
  }

  return (
    <div className="mesh-body" data-testid="mesh-host">
      {check === "checking" && (
        <p className="mesh-hint">
          <Loader2 size={12} className="mesh-spin" /> Checking Ollama…
        </p>
      )}

      {phase === "idle" && (
        <>
          <p className="mesh-hint">
            Two browsers connect directly. You keep your Ollama; the other
            device only sends prompts over the encrypted channel.
          </p>
          <button
            type="button"
            className="mesh-button mesh-button-primary"
            onClick={startHosting}
            disabled={check !== "ok"}
            data-testid="mesh-host-start"
          >
            <Users size={12} /> Create a pairing offer
          </button>
        </>
      )}

      {phase === "creating" && (
        <p className="mesh-hint">
          <Loader2 size={12} className="mesh-spin" /> Gathering network addresses…
        </p>
      )}

      {(phase === "offer" || phase === "connecting") && offer && (
        <>
          <p className="mesh-step">1. Host offer — send this to the other device</p>
          <CopyRow text={offer} label="Copy offer" testId="mesh-offer" />
          <p className="mesh-step">2. Paste the answer it gives you</p>
          <textarea
            className="mesh-input"
            rows={3}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="MODCODES1:{…}"
            data-testid="mesh-answer-input"
            aria-label="Answer from the other device"
          />
          <button
            type="button"
            className="mesh-button mesh-button-primary"
            onClick={connect}
            disabled={answer.trim().length === 0 || phase === "connecting"}
            data-testid="mesh-connect"
          >
            {phase === "connecting" ? (
              <Loader2 size={12} className="mesh-spin" />
            ) : (
              <Check size={12} />
            )}
            {phase === "connecting" ? "Waiting for the other device" : "Connect"}
          </button>
        </>
      )}

      {error && (
        <p className="mesh-warning" data-testid="mesh-error">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {(phase === "open" || phase === "closed") && (
        <>
          <PhraseBanner phrase={phrase} room={room} />
          <Transcript entries={entries} streaming={streaming} />
          {phase === "open" && (
            <p className="mesh-hint">
              <Loader2 size={11} className="mesh-spin" /> Connected. This device
              answers as long as the tab stays open.
            </p>
          )}
          {phase === "closed" && (
            <p className="mesh-warning">
              <AlertTriangle size={12} /> The other device disconnected.
            </p>
          )}
          <button
            type="button"
            className="mesh-button mesh-button-secondary"
            onClick={stop}
            data-testid="mesh-stop"
          >
            <Square size={11} /> End session
          </button>
        </>
      )}
    </div>
  );
}

function GuestTab() {
  const [phase, setPhase] = useState("idle");
  const [offerInput, setOfferInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [phrase, setPhrase] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(null);
  const requestRef = useRef(null);
  const streamingRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current?.close();
    };
  }, []);

  const handleMessage = useCallback((message) => {
    if (!mountedRef.current) return;
    if (message.t === "models") {
      setModels(message.models);
      setModel((current) =>
        message.models.includes(current) ? current : message.models[0]
      );
      setError(null);
      return;
    }
    if (message.t === "chunk") {
      streamingRef.current += message.text;
      setStreaming(streamingRef.current);
      return;
    }
    if (message.t === "done") {
      const text = streamingRef.current;
      streamingRef.current = "";
      setStreaming("");
      if (text) {
        setEntries((list) => [...list, { role: "assistant", text }]);
      }
      requestRef.current = null;
      setBusy(false);
      return;
    }
    if (message.t === "error") {
      setError(message.message);
      streamingRef.current = "";
      setStreaming("");
      requestRef.current = null;
      setBusy(false);
    }
  }, []);

  const join = async () => {
    setError(null);
    setPhase("joining");
    const session = createGuestSession({
      createPeerConnection: () => new RTCPeerConnection({ iceServers: [] }),
    });
    sessionRef.current = session;
    session.on("open", () => {
      if (mountedRef.current) setPhase("open");
    });
    session.on("message", handleMessage);
    session.on("invalid", (reason) => {
      if (mountedRef.current) setError(`Ignored an invalid message: ${reason}`);
    });
    session.on("close", () => {
      if (mountedRef.current) setPhase("closed");
    });
    try {
      const result = await session.start(offerInput);
      if (!mountedRef.current) return;
      setAnswer(result.answer);
      setPhrase(result.phrase);
      setRoom(result.room);
      setPhase("answer");
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught?.message || "That offer did not work");
      setPhase("idle");
    }
  };

  const sendChat = () => {
    const text = input.trim();
    if (!text || !sessionRef.current || busy || !model) return;
    const conversation = [
      ...entries
        .filter((entry) => entry.role === "user" || entry.role === "assistant")
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((entry) => ({ role: entry.role, content: entry.text })),
      { role: "user", content: text },
    ];
    const id = createRequestId();
    requestRef.current = id;
    const sent = sessionRef.current.send({
      t: "chat",
      id,
      model,
      messages: conversation,
    });
    if (!sent) {
      setError("The connection is not ready yet");
      return;
    }
    setEntries((prev) => [...prev, { role: "user", text }]);
    setInput("");
    streamingRef.current = "";
    setStreaming("");
    setBusy(true);
  };

  const stop = () => {
    const id = requestRef.current;
    const session = sessionRef.current;
    if (id) session?.send({ t: "stop", id });
    sessionRef.current = null;
    if (session) {
      window.setTimeout(() => session.close(), 150);
    }
    requestRef.current = null;
    setPhase("idle");
    setAnswer("");
    setPhrase(null);
    setRoom(null);
    setModels([]);
    setEntries([]);
    streamingRef.current = "";
    setStreaming("");
    setBusy(false);
  };

  return (
    <div className="mesh-body" data-testid="mesh-guest">
      {phase === "idle" && (
        <>
          <p className="mesh-hint">
            Ask the host to create an offer, then paste it here. You&apos;ll get
            an answer to send back before anything connects.
          </p>
          <textarea
            className="mesh-input"
            rows={3}
            value={offerInput}
            onChange={(event) => setOfferInput(event.target.value)}
            placeholder="MODCODES1:{…}"
            data-testid="mesh-offer-input"
            aria-label="Offer from the host"
          />
          <button
            type="button"
            className="mesh-button mesh-button-primary"
            onClick={join}
            disabled={offerInput.trim().length === 0}
            data-testid="mesh-join-start"
          >
            <Users size={12} /> Create a reply
          </button>
        </>
      )}

      {phase === "joining" && (
        <p className="mesh-hint">
          <Loader2 size={12} className="mesh-spin" /> Preparing the answer…
        </p>
      )}

      {phase === "answer" && answer && (
        <>
          <p className="mesh-step">1. Send this answer back to the host</p>
          <CopyRow text={answer} label="Copy answer" testId="mesh-answer" />
          <p className="mesh-step">2. Wait for the host to paste it in</p>
          <PhraseBanner phrase={phrase} room={room} />
          <p className="mesh-hint">
            <Loader2 size={11} className="mesh-spin" /> Connecting…
          </p>
        </>
      )}

      {(phase === "open" || phase === "closed") && (
        <>
          <PhraseBanner phrase={phrase} room={room} />
          {models.length > 0 ? (
            <label className="mesh-model">
              <span>Model on the host</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={busy}
                data-testid="mesh-model"
              >
                {models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mesh-hint">
              <Loader2 size={11} className="mesh-spin" /> Waiting for the host to
              list its models…
            </p>
          )}

          <Transcript entries={entries} streaming={streaming} />

          {phase === "open" ? (
            <div className="mesh-compose">
              <textarea
                className="mesh-input"
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Ask the host's Ollama…"
                aria-label="Message for the host"
                data-testid="mesh-input"
                disabled={busy}
              />
              <button
                type="button"
                className="mesh-button mesh-button-primary"
                onClick={sendChat}
                disabled={busy || input.trim().length === 0 || !model}
                data-testid="mesh-send"
              >
                {busy ? <Loader2 size={12} className="mesh-spin" /> : <Send size={12} />}
                Send
              </button>
            </div>
          ) : (
            <p className="mesh-warning">
              <AlertTriangle size={12} /> The host disconnected.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mesh-warning" data-testid="mesh-error">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {phase !== "idle" && (
        <button
          type="button"
          className="mesh-button mesh-button-secondary"
          onClick={stop}
          data-testid="mesh-stop"
        >
          <Square size={11} /> Leave session
        </button>
      )}
    </div>
  );
}

export default function MeshPanel({ baseUrl, onClose }) {
  const [tab, setTab] = useState("host");

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mesh-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="mesh-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mesh-title"
        data-testid="mesh-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mesh-header">
          <Users size={14} />
          <h3 id="mesh-title">Mesh</h3>
          <span className="mesh-badge">Chrome · Edge</span>
          <button
            type="button"
            className="mesh-close"
            onClick={onClose}
            aria-label="Close Mesh"
          >
            <X size={14} />
          </button>
        </header>

        <div className="mesh-tabs" role="tablist" aria-label="Mesh role">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "host"}
            className={`mesh-tab${tab === "host" ? " mesh-tab-active" : ""}`}
            onClick={() => setTab("host")}
          >
            This machine has Ollama
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "join"}
            className={`mesh-tab${tab === "join" ? " mesh-tab-active" : ""}`}
            onClick={() => setTab("join")}
          >
            Use the other machine
          </button>
        </div>

        {tab === "host" ? (
          <HostTab baseUrl={baseUrl || "http://127.0.0.1:11434"} />
        ) : (
          <GuestTab />
        )}

        <p className="mesh-foot">
          <ShieldCheck size={11} /> Signaling is copy/paste only. Prompts travel
          over DTLS between the two browsers — no relay, no account, no storage.
        </p>
      </section>
    </div>
  );
}
