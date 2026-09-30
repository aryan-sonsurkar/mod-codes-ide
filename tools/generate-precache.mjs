import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");
const outFile = path.join(root, "public", "precache-manifest.json");

if (!fs.existsSync(staticDir)) {
  console.error("precache: .next/static not found, run next build first.");
  process.exit(1);
}

const assets = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    const relative = path
      .relative(path.join(root, ".next"), fullPath)
      .split(path.sep)
      .join("/");
    assets.push(`/_next/${relative}`);
  }
}

walk(staticDir);
assets.sort();

const buildId = fs.existsSync(path.join(root, ".next", "BUILD_ID"))
  ? fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim()
  : "unknown";

fs.writeFileSync(
  outFile,
  `${JSON.stringify({ buildId, assets }, null, 2)}\n`,
  "utf8"
);

console.log(`precache: ${assets.length} static assets -> public/precache-manifest.json`);
