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

for (const path of ["/", "/some/deep/link"]) {
  const response = await request(path, {
    headers: { "sec-fetch-mode": "navigate" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await response.text(), /Daydle/);
}

console.log("Preview smoke passed: health, methods, API 404, root, SPA fallback.");
