import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4173";

async function request(path, options) {
  const response = await fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
  return response;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await request("/");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Preview server did not start.");
}

await waitForServer();

const health = await request("/api/v1/health");
assert.equal(health.status, 200);
assert.match(health.headers.get("content-type") ?? "", /application\/json/);
assert.equal(health.headers.get("cache-control"), "no-store");
assert.deepEqual(await health.json(), {
  status: "ok",
  service: "daydle-api",
  version: "v1",
});

const method = await request("/api/v1/health", { method: "POST" });
assert.equal(method.status, 405);
assert.equal(method.headers.get("allow"), "GET");

const missing = await request("/api/v1/not-found");
assert.equal(missing.status, 404);
assert.match(missing.headers.get("content-type") ?? "", /application\/json/);

for (const path of ["/", "/today", "/auth", "/auth/callback", "/account", "/games", "/games/wordle", "/some/deep/link"]) {
  const response = await request(path, {
    headers: { "sec-fetch-mode": "navigate" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await response.text(), /Daydle/);
}


const manifestResponse = await request("/app.webmanifest");
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.start_url, "/today");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some((item) => item.purpose === "maskable"));

for (const [name, size] of [["icon-192.png", 192],
  ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  const icon = await request("/icons/" + name);
  assert.equal(icon.status, 200, name);
  const binary = Buffer.from(await icon.arrayBuffer());
  assert.equal(binary.readUInt32BE(16), size);
  assert.equal(binary.readUInt32BE(20), size);
}

const serviceWorker = await request("/sw.js");
assert.equal(serviceWorker.status, 200);
const swSource = await serviceWorker.text();
assert.match(swSource, /daydle-shell-[a-f0-9]{16}/);
assert.match(swSource, /\/assets\//);
assert.doesNotMatch(swSource, /__DAYDLE_PWA_CONFIG__/);

console.log("Preview smoke passed: API, Today deep link, PWA manifest/icons and generated service worker.");

