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
