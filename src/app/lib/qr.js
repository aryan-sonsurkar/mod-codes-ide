import qrcode from "qrcode-generator";

export const QR_MAX_PAYLOAD = 1200;

/**
 * Build a QR matrix from text. Runs entirely in the browser; the payload is
 * never sent anywhere (important: LAN addresses are local information).
 * Returns rows of "0"/"1" so it can be rendered as SVG or inspected in tests.
 */
export function buildQrMatrix(text, { errorCorrection = "M" } = {}) {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) throw new Error("QR payload is empty");
  if (value.length > QR_MAX_PAYLOAD) throw new Error("QR payload is too long");

  const qr = qrcode(0, errorCorrection);
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const matrix = [];
  for (let row = 0; row < count; row++) {
    let line = "";
    for (let col = 0; col < count; col++) {
      line += qr.isDark(row, col) ? "1" : "0";
    }
    matrix.push(line);
  }
  return matrix;
}

/**
 * Convert a matrix into one SVG path, merging horizontal runs so the markup
 * stays small. The viewBox is `size x size` including the quiet zone.
 */
export function qrSvgPath(matrix, { margin = 2 } = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error("QR matrix is empty");
  }

  const moduleCount = matrix.length;
  let path = "";

  for (let row = 0; row < moduleCount; row++) {
    const line = matrix[row];
    let col = 0;
    while (col < moduleCount) {
      if (line[col] !== "1") {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < moduleCount && line[col + run] === "1") run += 1;
      path += `M${col + margin} ${row + margin}h${run}v1h-${run}z`;
      col += run;
    }
  }

  return { size: moduleCount + margin * 2, path };
}

/**
 * Prefer the mDNS name when one was discovered: it survives DHCP changes and
 * is explicitly exempt from mixed-content checks under Local Network Access.
 */
export function pickPreferredLanUrl(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  return urls.find((entry) => entry && entry.kind === "mdns") || urls[0];
}
