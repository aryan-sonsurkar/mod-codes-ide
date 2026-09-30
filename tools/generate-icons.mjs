import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "public");
const iconsDir = path.join(publicDir, "icons");
const svg = fs.readFileSync(path.join(iconsDir, "icon.svg"), "utf8");

const SIZES = [
  { file: "icon-32.png", size: 32 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "maskable-512.png", size: 512 },
];

function pngToIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];
  const images = [];

  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    directory.push(entry);
    images.push(png);
  }

  return Buffer.concat([header, ...directory, ...images]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(
  `<!doctype html><html><body style="margin:0">${svg}</body></html>`,
  { waitUntil: "load" }
);

fs.mkdirSync(iconsDir, { recursive: true });

const written = [];

for (const { file, size } of SIZES) {
  const dataUrl = await page.evaluate(async (target) => {
    const node = document.querySelector("svg");
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(node.outerHTML)))}`;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, target, target);
    return canvas.toDataURL("image/png");
  }, size);

  const png = Buffer.from(dataUrl.split(",")[1], "base64");
  fs.writeFileSync(path.join(iconsDir, file), png);
  written.push({ file, bytes: png.length });
}

const favicon = pngToIco([
  { size: 32, png: fs.readFileSync(path.join(iconsDir, "icon-32.png")) },
  { size: 192, png: fs.readFileSync(path.join(iconsDir, "icon-192.png")) },
]);
fs.writeFileSync(path.join(publicDir, "favicon.ico"), favicon);
written.push({ file: "favicon.ico", bytes: favicon.length });

await browser.close();

for (const entry of written) {
  console.log(`${entry.file}: ${entry.bytes} bytes`);
}
