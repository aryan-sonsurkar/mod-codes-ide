import { describe, expect, it, vi } from "vitest";
import {
  decodePairingPayload,
  deriveSafetyPhrase,
  encodePairingPayload,
  extractFingerprint,
} from "./meshProtocol";
import {
  MESH_STATES,
  createGuestSession,
  createHostSession,
} from "./meshSession";

const ROOM = "AB23CD";
const HOST_FP = "AA:AA:AA:AA";
const GUEST_FP = "BB:BB:BB:BB";

function sdpWith(fingerprint) {
  return [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    `a=fingerprint:sha-256 ${fingerprint}`,
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "",
  ].join("\r\n");
}

function createFakePeerConnection(fingerprint) {
  const channel = {
    label: "modcodes-mesh",
    readyState: "connecting",
    sent: [],
    send(message) {
      channel.sent.push(message);
    },
    close() {
      channel.readyState = "closed";
    },
  };
  const pc = {
    iceGatheringState: "complete",
    localDescription: null,
    remoteDescription: null,
    ondatachannel: null,
    closed: false,
    channel,
    createDataChannel(label) {
      channel.label = label;
      return channel;
    },
    async createOffer() {
      return { type: "offer", sdp: "placeholder" };
    },
    async createAnswer() {
      return { type: "answer", sdp: "placeholder" };
    },
    async setLocalDescription(description) {
      pc.localDescription = {
        type: description.type,
        sdp: sdpWith(fingerprint),
      };
    },
    async setRemoteDescription(description) {
      pc.remoteDescription = description;
    },
    close() {
      pc.closed = true;
    },
  };
  return pc;
}

describe("host session", () => {
  it("builds an offer payload with the room and its fingerprint", async () => {
    const pc = createFakePeerConnection(HOST_FP);
    const session = createHostSession({
      createPeerConnection: () => pc,
      room: ROOM,
    });

    const offerText = await session.start();
    expect(session.getState()).toBe(MESH_STATES.waiting);

    const decoded = decodePairingPayload(offerText, { expect: "offer" });
    expect(decoded.ok).toBe(true);
    expect(decoded.payload.room).toBe(ROOM);
    expect(extractFingerprint(decoded.payload.sdp)).toBe(HOST_FP);
    expect(session.getLocalFingerprint()).toBe(HOST_FP);
  });

  it("applies an answer and derives the same phrase as the guest", async () => {
    const pc = createFakePeerConnection(HOST_FP);
    const session = createHostSession({
      createPeerConnection: () => pc,
      room: ROOM,
    });
    await session.start();

    const answer = encodePairingPayload({
      kind: "answer",
      room: ROOM,
      sdp: sdpWith(GUEST_FP),
    });

    const phrase = await session.acceptAnswer(answer);
    expect(phrase).toBe(deriveSafetyPhrase(HOST_FP, GUEST_FP));
    expect(phrase.split(" ")).toHaveLength(4);
    expect(session.getState()).toBe(MESH_STATES.connecting);
    expect(pc.remoteDescription).toEqual({
      type: "answer",
      sdp: sdpWith(GUEST_FP),
    });
  });

  it("refuses answers for another room or the wrong direction", async () => {
    const session = createHostSession({
      createPeerConnection: () => createFakePeerConnection(HOST_FP),
      room: ROOM,
    });
    await session.start();

    await expect(
      session.acceptAnswer(
        encodePairingPayload({ kind: "answer", room: "CD34EF", sdp: sdpWith(GUEST_FP) })
      )
    ).rejects.toThrow(/different room/i);

    await expect(
      session.acceptAnswer(
        encodePairingPayload({ kind: "offer", room: ROOM, sdp: sdpWith(GUEST_FP) })
      )
    ).rejects.toThrow(/not an answer/i);

    await expect(session.acceptAnswer("hello")).rejects.toThrow(
      /pairing link/i
    );
  });

  it("opens, receives guest messages, and sends host frames", async () => {
    const pc = createFakePeerConnection(HOST_FP);
    const session = createHostSession({
      createPeerConnection: () => pc,
      room: ROOM,
    });
    await session.start();

    const onMessage = vi.fn();
    const onInvalid = vi.fn();
    session.on("message", onMessage);
    session.on("invalid", onInvalid);

    expect(session.send({ t: "models", models: ["gemma3:4b"] })).toBe(false);

    pc.channel.readyState = "open";
    pc.channel.onopen();
    expect(session.getState()).toBe(MESH_STATES.open);

    expect(session.send({ t: "models", models: ["gemma3:4b"] })).toBe(true);
    expect(JSON.parse(pc.channel.sent[0])).toEqual({
      t: "models",
      models: ["gemma3:4b"],
    });

    pc.channel.onmessage({
      data: JSON.stringify({
        t: "chat",
        id: "r1",
        model: "gemma3:4b",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "chat", id: "r1" })
    );

    pc.channel.onmessage({
      data: JSON.stringify({
        t: "chunk",
        id: "r1",
        text: "not allowed from guest",
      }),
    });
    expect(onInvalid).toHaveBeenCalled();

    session.close();
    expect(pc.closed).toBe(true);
    expect(session.getState()).toBe(MESH_STATES.closed);
  });
});

describe("guest session", () => {
  it("turns an offer into an answer with the matching room and phrase", async () => {
    const pc = createFakePeerConnection(GUEST_FP);
    const session = createGuestSession({
      createPeerConnection: () => pc,
    });

    const offerText = encodePairingPayload({
      kind: "offer",
      room: ROOM,
      sdp: sdpWith(HOST_FP),
    });
    const result = await session.start(offerText);

    expect(result.room).toBe(ROOM);
    const decoded = decodePairingPayload(result.answer, { expect: "answer" });
    expect(decoded.ok).toBe(true);
    expect(decoded.payload.room).toBe(ROOM);
    expect(extractFingerprint(decoded.payload.sdp)).toBe(GUEST_FP);
    expect(result.phrase).toBe(deriveSafetyPhrase(HOST_FP, GUEST_FP));
    expect(session.getState()).toBe(MESH_STATES.connecting);
  });

  it("rejects a non-offer and leaves the session idle", async () => {
    const session = createGuestSession({
      createPeerConnection: () => createFakePeerConnection(GUEST_FP),
    });

    await expect(
      session.start(
        encodePairingPayload({ kind: "answer", room: ROOM, sdp: sdpWith(HOST_FP) })
      )
    ).rejects.toThrow(/not an offer/i);
    expect(session.getState()).toBe(MESH_STATES.idle);
  });

  it("sends guest frames once the channel opens", async () => {
    const pc = createFakePeerConnection(GUEST_FP);
    const session = createGuestSession({
      createPeerConnection: () => pc,
    });
    await session.start(
      encodePairingPayload({ kind: "offer", room: ROOM, sdp: sdpWith(HOST_FP) })
    );

    const guestChannel = createFakePeerConnection("ignored").channel;
    guestChannel.readyState = "open";
    pc.ondatachannel({ channel: guestChannel });
    guestChannel.onopen();

    expect(session.getState()).toBe(MESH_STATES.open);
    expect(
      session.send({
        t: "chat",
        id: "r1",
        model: "gemma3:4b",
        messages: [{ role: "user", content: "hi" }],
      })
    ).toBe(true);
    expect(JSON.parse(guestChannel.sent[0]).t).toBe("chat");
  });
});
