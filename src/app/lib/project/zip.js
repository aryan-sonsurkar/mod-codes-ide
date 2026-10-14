const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function u16(value) {
  const out = new Uint8Array(2);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  out[2] = (value >>> 16) & 0xff;
  out[3] = (value >>> 24) & 0xff;
  return out;
}

function concat(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, status: "empty" };
  }

  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = String(entry?.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name || name.endsWith("/")) {
      continue;
    }
    const content = typeof entry.content === "string"
      ? textEncoder.encode(entry.content)
      : entry.content instanceof Uint8Array
        ? entry.content
        : textEncoder.encode(String(entry.content ?? ""));
    const checksum = crc32(content);
    const nameBytes = textEncoder.encode(name);

    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(content.length),
      u32(content.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localChunks.push(localHeader, content);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(content.length),
      u32(content.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(localOffset),
      nameBytes,
    ]);
    centralChunks.push(centralHeader);

    localOffset += localHeader.length + content.length;
  }

  if (localChunks.length === 0) {
    return { ok: false, status: "empty" };
  }

  const centralDirectory = concat(centralChunks);
  const endRecord = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centralChunks.length),
    u16(centralChunks.length),
    u32(centralDirectory.length),
    u32(localOffset),
    u16(0),
  ]);

  return { ok: true, bytes: concat([...localChunks, centralDirectory, endRecord]) };
}

function findEndOfCentralDirectory(bytes) {
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    return null;
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function parseZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) {
    return { ok: false, status: "not-zip" };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  const entries = [];
  let cursor = centralOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!name || name.endsWith("/")) {
      continue;
    }

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      return { ok: false, status: "corrupt" };
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const rawData = bytes.subarray(dataStart, dataStart + compressedSize);

    let content;
    if (method === 0) {
      content = rawData;
    } else if (method === 8) {
      const inflated = await inflateRaw(rawData);
      if (!inflated) {
        return { ok: false, status: "deflate-unsupported", entry: name };
      }
      content = inflated;
    } else {
      return { ok: false, status: "unsupported-method", method, entry: name };
    }

    if (uncompressedSize > 0 && content.length !== uncompressedSize) {
      return { ok: false, status: "corrupt", entry: name };
    }

    entries.push({
      name: name.replace(/\\/g, "/"),
      content,
      text: () => textDecoder.decode(content),
    });
  }

  if (entries.length === 0) {
    return { ok: false, status: "empty" };
  }

  return { ok: true, entries };
}

export function zipEntryToText(entry) {
  if (!entry) return null;
  if (typeof entry.text === "function") return entry.text();
  return textDecoder.decode(entry.content);
}
