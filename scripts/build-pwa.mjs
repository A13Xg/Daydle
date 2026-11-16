// Emits a versioned service worker using the static assets Vite actually built.
// Run after vite build. No external API, credentials or third-party runtime.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const output = resolve("dist/client");
const html = readFileSync(join(output, "index.html"), "utf8");
const template = readFileSync(resolve("scripts/sw-template.js"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
  .map((match) => match[1]).filter(Boolean);
if (!assets.some((path) => path.endsWith(".js")) ||
    !assets.some((path) => path.endsWith(".css"))) {
  throw new Error("Vite assets not detected in the built application shell.");
}

const precache = [
  "/index.html",
  "/app.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  ...new Set(assets),
];
const checksum = createHash("sha256");
for (const url of precache) {
  const path = join(output, url.slice(1));
  if (!statSync(path).isFile()) throw new Error("PWA asset missing: " + url);
  checksum.update(url);
  checksum.update(readFileSync(path));
}
checksum.update(template);
const key = "daydle-shell-" + checksum.digest("hex").slice(0, 16);
const header = `const CACHE_NAME = ${JSON.stringify(key)};\n` +
  `const PRECACHE_URLS = ${JSON.stringify(precache)};\n`;
const replaced = template.replace("/*__DAYDLE_PWA_CONFIG__*/", header);
if (replaced === template) throw new Error("Service worker template missing configuration slot.");
writeFileSync(join(output, "sw.js"), replaced);
console.log("Built offline PWA shell with", precache.length, "assets and cache", key);
