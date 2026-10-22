/**
 * Mesh signaling protocol (Phase 2) — pure logic, no network.
 *
 * The data path is WebRTC device→device. Signaling carries SDP and ICE only,
 * never prompts or tokens. These helpers exist so the transport, the UI, and
 * the serverless relay can all agree on one grammar.
 */

export const SIGNAL_VERSION = 1;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const SIGNAL_LIMITS = {
  sdp: 32000,
  candidate: 2000,
  room: ROOM_CODE_LENGTH,
};

export const SIGNAL_TYPES = ["offer", "answer", "candidate", "bye"];

/**
 * Manual pairing text. SDP is embedded as a JSON string so a single-line
 * payload survives chat apps, email, and textareas that reflow newlines.
 */
export const PAIRING_PREFIX = "MODCODES1:";
export const PAIRING_TYPES = ["offer", "answer"];

export const CHANNEL_LABEL = "modcodes-mesh";

export const CHANNEL_LIMITS = {
  messages: 24,
  messageChars: 12000,
  totalChars: 24000,
  text: 24000,
  id: 64,
  modelId: 200,
  models: 60,
  errorMessage: 500,
};

export const CHANNEL_TYPES = [
  "models",
  "chat",
  "chunk",
  "done",
  "error",
  "stop",
];

/** Which side may send which message over the data channel. */
export const CHANNEL_DIRECTIONS = {
  models: "host",
  chat: "guest",
  chunk: "host",
  done: "host",
  error: "host",
  stop: "guest",
};

const CHAT_ROLES = ["user", "assistant"];


const SAFETY_WORDS = [
  "amber", "anchor", "atlas", "bamboo", "basalt", "beacon", "birch", "bison",
  "cactus", "canyon", "cedar", "cobalt", "comet", "copper", "coral", "cosmos",
  "delta", "drift", "ember", "falcon", "fern", "flint", "forge", "glacier",
  "granite", "harbor", "hazel", "heron", "indigo", "ivory", "juniper", "kestrel",
  "lantern", "larch", "lichen", "lunar", "maple", "marble", "meadow", "mesa",
  "mica", "mint", "nimbus", "north", "oak", "obsidian", "onyx", "orbit",
  "otter", "pebble", "pine", "quartz", "raven", "reef", "ridge", "river",
  "saffron", "sage", "slate", "solar", "spruce", "summit", "thistle", "tundra",
];

export function normalizeRoomCode(input) {
  const raw = typeof input === "string" ? input : "";
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function isValidRoomCode(input) {
  const code = normalizeRoomCode(input);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ROOM_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * `randomValues` is either a function returning a byte array or an array of
 * bytes. 256 % 32 === 0, so plain modulo introduces no bias.
 */
export function createRoomCode(randomValues = null) {
  let bytes = null;

  if (typeof randomValues === "function") {
    bytes = randomValues(ROOM_CODE_LENGTH);
  } else if (Array.isArray(randomValues) || randomValues instanceof Uint8Array) {
    bytes = randomValues;
  } else if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  }

  if (!bytes || bytes.length < ROOM_CODE_LENGTH) {
    throw new Error("Not enough entropy for a room code");
  }

  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return code;
}

export function validateSignalMessage(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Message must be an object" };
  }
  if (input.v !== SIGNAL_VERSION) {
    return { ok: false, error: `Unsupported signal version: ${input.v}` };
  }
  if (!SIGNAL_TYPES.includes(input.type)) {
    return { ok: false, error: `Unknown signal type: ${input.type}` };
  }
  if (!isValidRoomCode(input.room)) {
    return { ok: false, error: "Invalid room code" };
  }

  if (input.type === "offer" || input.type === "answer") {
    if (typeof input.sdp !== "string" || input.sdp.length === 0) {
      return { ok: false, error: "Missing SDP" };
    }
    if (input.sdp.length > SIGNAL_LIMITS.sdp) {
      return { ok: false, error: "SDP is too large" };
    }
  }

  if (input.type === "candidate") {
    const candidate = input.candidate;
    if (!candidate || typeof candidate !== "object") {
      return { ok: false, error: "Missing candidate" };
    }
    if (
      typeof candidate.candidate !== "string" ||
      candidate.candidate.length === 0
    ) {
      return { ok: false, error: "Invalid candidate payload" };
    }
    if (candidate.candidate.length > SIGNAL_LIMITS.candidate) {
      return { ok: false, error: "Candidate is too large" };
    }
    if (
      candidate.sdpMLineIndex !== undefined &&
      candidate.sdpMLineIndex !== null &&
      typeof candidate.sdpMLineIndex !== "number"
    ) {
      return { ok: false, error: "Invalid sdpMLineIndex" };
    }
  }

  return { ok: true };
}

export function parseSignalMessage(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Message must be JSON text" };
  }
  if (text.length > SIGNAL_LIMITS.sdp + SIGNAL_LIMITS.candidate + 2000) {
    return { ok: false, error: "Message is too large" };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Message is not valid JSON" };
  }
  return validateSignalMessage(parsed);
}

export function extractFingerprint(sdp) {
  if (typeof sdp !== "string" || sdp.length === 0) return null;
  const match = sdp.match(/^a=fingerprint:sha-256\s+([0-9a-fA-F:]+)\s*$/m);
  if (!match) return null;
  return match[1].toUpperCase();
}

export function encodePairingPayload({ kind, room, sdp }) {
  if (!PAIRING_TYPES.includes(kind)) {
    throw new Error(`Unknown pairing kind: ${kind}`);
  }
  const check = validateSignalMessage({ v: SIGNAL_VERSION, type: kind, room, sdp });
  if (!check.ok) {
    throw new Error(check.error);
  }
  return `${PAIRING_PREFIX}${JSON.stringify({ v: SIGNAL_VERSION, kind, room, sdp })}`;
}

/**
 * `expect` pins the direction: the host only takes an "answer", the guest only
 * an "offer". Returns `{ ok: true, payload: { room, sdp } }` or an error.
 */
export function decodePairingPayload(text, { expect = null } = {}) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, error: "Paste the pairing text from the other device" };
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith(PAIRING_PREFIX)) {
    return { ok: false, error: "Not a MODCODES pairing link" };
  }
  if (trimmed.length > SIGNAL_LIMITS.sdp + 2000) {
    return { ok: false, error: "Pairing text is too large" };
  }
  let payload = null;
  try {
    payload = JSON.parse(trimmed.slice(PAIRING_PREFIX.length));
  } catch {
    return { ok: false, error: "Pairing text is not valid JSON" };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Pairing text is empty" };
  }
  if (expect && payload.kind !== expect) {
    return {
      ok: false,
      error: expect === "answer" ? "That is an offer, not an answer" : "That is an answer, not an offer",
    };
  }
  const check = validateSignalMessage({
    v: payload.v,
    type: payload.kind,
    room: payload.room,
    sdp: payload.sdp,
  });
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  return {
    ok: true,
    payload: { room: normalizeRoomCode(payload.room), sdp: payload.sdp },
  };
}

export function validateChannelMessage(input, { from = null } = {}) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Message must be an object" };
  }
  const type = input.t;
  if (!CHANNEL_TYPES.includes(type)) {
    return { ok: false, error: `Unknown channel message: ${type}` };
  }
  if (from && CHANNEL_DIRECTIONS[type] !== from) {
    return { ok: false, error: `A ${from} cannot send "${type}"` };
  }

  if (type === "chat") {
    if (typeof input.id !== "string" || input.id.length === 0 || input.id.length > CHANNEL_LIMITS.id) {
      return { ok: false, error: "Missing request id" };
    }
    if (typeof input.model !== "string" || input.model.length === 0) {
      return { ok: false, error: "Missing model" };
    }
    if (input.model.length > CHANNEL_LIMITS.modelId) {
      return { ok: false, error: "Model name is too long" };
    }
    const messages = input.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { ok: false, error: "Missing messages" };
    }
    if (messages.length > CHANNEL_LIMITS.messages) {
      return { ok: false, error: "Too many messages" };
    }
    let total = 0;
    for (const message of messages) {
      if (!message || typeof message !== "object") {
        return { ok: false, error: "Malformed message" };
      }
      if (!CHAT_ROLES.includes(message.role)) {
        return { ok: false, error: "Unknown message role" };
      }
      if (typeof message.content !== "string") {
        return { ok: false, error: "Missing message content" };
      }
      if (message.content.length > CHANNEL_LIMITS.messageChars) {
        return { ok: false, error: "A message is too long" };
      }
      total += message.content.length;
    }
    if (total > CHANNEL_LIMITS.totalChars) {
      return { ok: false, error: "Conversation is too long" };
    }
    return { ok: true };
  }

  if (type === "models") {
    if (!Array.isArray(input.models) || input.models.length === 0) {
      return { ok: false, error: "Host shared no models" };
    }
    if (input.models.length > CHANNEL_LIMITS.models) {
      return { ok: false, error: "Too many models" };
    }
    for (const model of input.models) {
      if (typeof model !== "string" || model.length === 0) {
        return { ok: false, error: "Invalid model" };
      }
      if (model.length > CHANNEL_LIMITS.modelId) {
        return { ok: false, error: "Model name is too long" };
      }
    }
    return { ok: true };
  }

  if (type === "chunk") {
    if (typeof input.id !== "string" || input.id.length === 0) {
      return { ok: false, error: "Missing request id" };
    }
    if (typeof input.text !== "string" || input.text.length === 0) {
      return { ok: false, error: "Empty chunk" };
    }
    if (input.text.length > CHANNEL_LIMITS.text) {
      return { ok: false, error: "Chunk is too large" };
    }
    return { ok: true };
  }

  if (type === "error") {
    if (typeof input.id !== "string" || input.id.length === 0) {
      return { ok: false, error: "Missing request id" };
    }
    if (typeof input.message !== "string" || input.message.length === 0) {
      return { ok: false, error: "Missing error message" };
    }
    if (input.message.length > CHANNEL_LIMITS.errorMessage) {
      return { ok: false, error: "Error message is too long" };
    }
    return { ok: true };
  }

  // done / stop
  if (typeof input.id !== "string" || input.id.length === 0) {
    return { ok: false, error: "Missing request id" };
  }
  if (input.id.length > CHANNEL_LIMITS.id) {
    return { ok: false, error: "Request id is too long" };
  }
  return { ok: true };
}

export function encodeChannelMessage(message) {
  return JSON.stringify(message);
}

export function parseChannelMessage(text, { from = null } = {}) {
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: "Empty channel message" };
  }
  if (text.length > CHANNEL_LIMITS.totalChars + 4000) {
    return { ok: false, error: "Channel message is too large" };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Channel message is not JSON" };
  }
  const check = validateChannelMessage(parsed, { from });
  if (!check.ok) return check;
  return { ok: true, message: parsed };
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Both peers derive the same 4-word phrase from the two DTLS fingerprints.
 * Sorting makes it order-independent; neither side can pick a phrase the
 * other will not see.
 */
export function deriveSafetyPhrase(fingerprintA, fingerprintB) {
  const a = typeof fingerprintA === "string" ? fingerprintA.trim() : "";
  const b = typeof fingerprintB === "string" ? fingerprintB.trim() : "";
  if (!a || !b) return null;

  const seed = [a, b].sort().join(":");
  const words = [];

  for (let i = 0; i < 4; i += 1) {
    const hash = fnv1a(`${seed}:${i}`);
    words.push(SAFETY_WORDS[hash % SAFETY_WORDS.length]);
  }

  return words.join(" ");
}
