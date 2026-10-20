import { describe, expect, it } from "vitest";
import {
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  SIGNAL_LIMITS,
  SIGNAL_VERSION,
  createRoomCode,
  deriveSafetyPhrase,
  isValidRoomCode,
  normalizeRoomCode,
  parseSignalMessage,
  validateSignalMessage,
} from "./meshProtocol";

const ROOM = "AB23CD";

function offer(overrides = {}) {
  return {
    v: SIGNAL_VERSION,
    type: "offer",
    room: ROOM,
    sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
    ...overrides,
  };
}

describe("room codes", () => {
  it("normalizes case and separators", () => {
    expect(normalizeRoomCode(" ab-23 cd ")).toBe("AB23CD");
    expect(normalizeRoomCode(null)).toBe("");
    expect(isValidRoomCode("ab 23-cd")).toBe(true);
  });

  it("rejects ambiguous or malformed codes", () => {
    expect(isValidRoomCode("AB23C")).toBe(false);
    expect(isValidRoomCode("AB23CDE")).toBe(false);
    expect(isValidRoomCode("AB23C0")).toBe(false);
    expect(isValidRoomCode("AB23CI")).toBe(false);
    expect(isValidRoomCode("AB23CO")).toBe(false);
  });

  it("produces codes from the unambiguous alphabet", () => {
    expect(ROOM_ALPHABET).not.toMatch(/[01IO]/);
    expect(ROOM_CODE_LENGTH).toBe(6);

    const code = createRoomCode([0, 1, 2, 3, 4, 5]);
    expect(code).toHaveLength(6);
    for (const char of code) expect(ROOM_ALPHABET).toContain(char);
    expect(createRoomCode([0, 1, 2, 3, 4, 5])).toBe(code);
  });

  it("uses the injected random function", () => {
    const seen = [];
    const code = createRoomCode((length) => {
      seen.push(length);
      return new Uint8Array([255, 255, 0, 0, 31, 31]);
    });
    expect(seen).toEqual([ROOM_CODE_LENGTH]);
    expect(code.length).toBe(6);
  });

  it("fails loudly without entropy", () => {
    expect(() => createRoomCode([])).toThrow(/entropy/i);
  });
});

describe("signal messages", () => {
  it("accepts an offer within the limits", () => {
    expect(validateSignalMessage(offer())).toEqual({ ok: true });
  });

  it("rejects the wrong version, type, or room", () => {
    expect(validateSignalMessage(offer({ v: 2 })).error).toMatch(/version/i);
    expect(validateSignalMessage(offer({ type: "prompt" })).error).toMatch(
      /type/i
    );
    expect(validateSignalMessage(offer({ room: "NOPE" })).error).toMatch(
      /room/i
    );
    expect(validateSignalMessage(null)).toEqual({
      ok: false,
      error: "Message must be an object",
    });
  });

  it("caps SDP and candidate sizes", () => {
    const hugeSdp = offer({ sdp: "x".repeat(SIGNAL_LIMITS.sdp + 1) });
    expect(validateSignalMessage(hugeSdp).error).toMatch(/too large/i);

    const candidate = {
      v: SIGNAL_VERSION,
      type: "candidate",
      room: ROOM,
      candidate: {
        candidate: "candidate:1 1 UDP 1 192.168.1.2 5000 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    };
    expect(validateSignalMessage(candidate)).toEqual({ ok: true });
    expect(
      validateSignalMessage({
        ...candidate,
        candidate: { candidate: "x".repeat(SIGNAL_LIMITS.candidate + 1) },
      }).error
    ).toMatch(/too large/i);
    expect(
      validateSignalMessage({ ...candidate, candidate: { candidate: "" } })
        .error
    ).toMatch(/candidate/i);
    expect(
      validateSignalMessage({
        ...candidate,
        candidate: { candidate: "candidate:1", sdpMLineIndex: "0" },
      }).error
    ).toMatch(/sdpMLineIndex/i);
  });

  it("accepts bye without SDP", () => {
    expect(
      validateSignalMessage({ v: SIGNAL_VERSION, type: "bye", room: ROOM })
    ).toEqual({ ok: true });
  });

  it("parses JSON and refuses junk", () => {
    expect(parseSignalMessage(JSON.stringify(offer()))).toEqual({ ok: true });
    expect(parseSignalMessage("{not json").error).toMatch(/valid JSON/i);
    expect(parseSignalMessage(null).error).toMatch(/JSON text/i);
    expect(
      parseSignalMessage("x".repeat(SIGNAL_LIMITS.sdp + 5000)).error
    ).toMatch(/too large/i);
  });
});

describe("safety phrase", () => {
  const host = "sha-256 AA:BB:CC";
  const guest = "sha-256 DD:EE:FF";

  it("is deterministic and order-independent", () => {
    const a = deriveSafetyPhrase(host, guest);
    const b = deriveSafetyPhrase(guest, host);
    expect(a).toBe(b);
    expect(a.split(" ")).toHaveLength(4);
    expect(a).toBe(deriveSafetyPhrase(host, guest));
  });

  it("changes when a fingerprint changes", () => {
    expect(deriveSafetyPhrase(host, guest)).not.toBe(
      deriveSafetyPhrase(host, "sha-256 00:11:22")
    );
  });

  it("returns null when a fingerprint is missing", () => {
    expect(deriveSafetyPhrase("", guest)).toBeNull();
    expect(deriveSafetyPhrase(host, null)).toBeNull();
    expect(deriveSafetyPhrase(undefined, undefined)).toBeNull();
  });
});
