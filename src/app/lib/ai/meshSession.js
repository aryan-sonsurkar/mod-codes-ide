/**
 * Mesh v1 transport glue (Phase 2) — WebRTC data channel, manual pairing.
 *
 * Signaling is copy/paste text: the host produces an offer, the guest pastes it
 * and produces an answer, the host pastes that back. No relay, no server, no
 * trickle ICE (candidates ride inside the SDP). The data channel then carries
 * chat frames only; nothing leaves the two devices.
 *
 * `createPeerConnection` is injected so this module stays testable and so the
 * caller owns ICE server configuration (v1 uses none).
 */

import {
  CHANNEL_LABEL,
  createRoomCode,
  decodePairingPayload,
  deriveSafetyPhrase,
  encodeChannelMessage,
  encodePairingPayload,
  extractFingerprint,
  parseChannelMessage,
  validateChannelMessage,
} from "./meshProtocol";

export const MESH_STATES = {
  idle: "idle",
  waiting: "waiting",
  connecting: "connecting",
  open: "open",
  failed: "failed",
  closed: "closed",
};

export const ICE_TIMEOUT_MS = 4000;

function createEmitter() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (typeof handler !== "function") return () => {};
      if (!listeners.has(event)) listeners.set(event, new Set());
      const bucket = listeners.get(event);
      bucket.add(handler);
      return () => bucket.delete(handler);
    },
    emit(event, payload) {
      const bucket = listeners.get(event);
      if (!bucket) return;
      for (const handler of [...bucket]) {
        try {
          handler(payload);
        } catch {}
      }
    },
  };
}

function waitForIceGathering(pc, timeoutMs) {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (typeof pc.removeEventListener === "function") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        pc.removeEventListener("icecandidate", onCandidate);
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };

    const onCandidate = (event) => {
      if (!event || !event.candidate) finish();
    };

    if (typeof pc.addEventListener === "function") {
      pc.addEventListener("icegatheringstatechange", onChange);
      pc.addEventListener("icecandidate", onCandidate);
    }

    timer = setTimeout(finish, timeoutMs);
  });
}

function requireFactory(createPeerConnection) {
  if (typeof createPeerConnection !== "function") {
    throw new Error("createPeerConnection is required");
  }
}

function wireChannel(channel, { from, events, setState }) {
  channel.onopen = () => {
    setState(MESH_STATES.open);
    events.emit("open");
  };
  channel.onclose = () => {
    setState(MESH_STATES.closed);
    events.emit("close");
  };
  channel.onerror = () => {
    events.emit("error", new Error("The data channel hit an error"));
  };
  channel.onmessage = (event) => {
    const parsed = parseChannelMessage(event.data, { from });
    if (!parsed.ok) {
      events.emit("invalid", parsed.error);
      return;
    }
    events.emit("message", parsed.message);
  };
}

export function createHostSession({
  createPeerConnection,
  iceTimeoutMs = ICE_TIMEOUT_MS,
  room = createRoomCode(),
} = {}) {
  requireFactory(createPeerConnection);

  const events = createEmitter();
  let pc = null;
  let channel = null;
  let state = MESH_STATES.idle;
  let localFingerprint = null;
  let remoteFingerprint = null;
  let safetyPhrase = null;

  const setState = (next) => {
    if (state === next) return;
    state = next;
    events.emit("state", next);
  };

  async function start() {
    if (pc) throw new Error("This session has already started");
    pc = createPeerConnection();
    channel = pc.createDataChannel(CHANNEL_LABEL, { ordered: true });
    wireChannel(channel, { from: "guest", events, setState });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc, iceTimeoutMs);
      const sdp = pc.localDescription.sdp;
      localFingerprint = extractFingerprint(sdp);
      setState(MESH_STATES.waiting);
      return encodePairingPayload({ kind: "offer", room, sdp });
    } catch (error) {
      setState(MESH_STATES.failed);
      throw error;
    }
  }

  async function acceptAnswer(text) {
    if (!pc) throw new Error("Start the session before adding an answer");
    const decoded = decodePairingPayload(text, { expect: "answer" });
    if (!decoded.ok) throw new Error(decoded.error);
    if (decoded.payload.room !== room) {
      throw new Error("That answer belongs to a different room");
    }

    const peerFingerprint = extractFingerprint(decoded.payload.sdp);
    try {
      await pc.setRemoteDescription({ type: "answer", sdp: decoded.payload.sdp });
    } catch (error) {
      setState(MESH_STATES.failed);
      throw error;
    }
    remoteFingerprint = peerFingerprint;
    safetyPhrase = deriveSafetyPhrase(localFingerprint, remoteFingerprint);
    setState(MESH_STATES.connecting);
    return safetyPhrase;
  }

  function send(message) {
    if (!channel || channel.readyState !== "open") return false;
    const check = validateChannelMessage(message, { from: "host" });
    if (!check.ok) throw new Error(check.error);
    channel.send(encodeChannelMessage(message));
    return true;
  }

  function close() {
    if (state === MESH_STATES.closed) return;
    try {
      channel?.close();
    } catch {}
    try {
      pc?.close();
    } catch {}
    setState(MESH_STATES.closed);
  }

  return {
    role: "host",
    getRoom: () => room,
    getState: () => state,
    getSafetyPhrase: () => safetyPhrase,
    getLocalFingerprint: () => localFingerprint,
    start,
    acceptAnswer,
    send,
    close,
    on: events.on,
  };
}

export function createGuestSession({
  createPeerConnection,
  iceTimeoutMs = ICE_TIMEOUT_MS,
} = {}) {
  requireFactory(createPeerConnection);

  const events = createEmitter();
  let pc = null;
  let channel = null;
  let state = MESH_STATES.idle;
  let room = null;
  let localFingerprint = null;
  let remoteFingerprint = null;
  let safetyPhrase = null;

  const setState = (next) => {
    if (state === next) return;
    state = next;
    events.emit("state", next);
  };

  async function start(offerText) {
    if (pc) throw new Error("This session has already started");
    const decoded = decodePairingPayload(offerText, { expect: "offer" });
    if (!decoded.ok) throw new Error(decoded.error);

    room = decoded.payload.room;
    remoteFingerprint = extractFingerprint(decoded.payload.sdp);
    pc = createPeerConnection();

    pc.ondatachannel = (event) => {
      channel = event.channel;
      wireChannel(channel, { from: "host", events, setState });
    };

    try {
      await pc.setRemoteDescription({ type: "offer", sdp: decoded.payload.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc, iceTimeoutMs);
      const sdp = pc.localDescription.sdp;
      localFingerprint = extractFingerprint(sdp);
      safetyPhrase = deriveSafetyPhrase(remoteFingerprint, localFingerprint);
      setState(MESH_STATES.connecting);
      return {
        room,
        answer: encodePairingPayload({ kind: "answer", room, sdp }),
        phrase: safetyPhrase,
      };
    } catch (error) {
      setState(MESH_STATES.failed);
      throw error;
    }
  }

  function send(message) {
    if (!channel || channel.readyState !== "open") return false;
    const check = validateChannelMessage(message, { from: "guest" });
    if (!check.ok) throw new Error(check.error);
    channel.send(encodeChannelMessage(message));
    return true;
  }

  function close() {
    if (state === MESH_STATES.closed) return;
    try {
      channel?.close();
    } catch {}
    try {
      pc?.close();
    } catch {}
    setState(MESH_STATES.closed);
  }

  return {
    role: "guest",
    getRoom: () => room,
    getState: () => state,
    getSafetyPhrase: () => safetyPhrase,
    getLocalFingerprint: () => localFingerprint,
    start,
    send,
    close,
    on: events.on,
  };
}
