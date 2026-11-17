import { describe, expect, it, vi } from "vitest";
import {
  assertWorkerRouting,
  inspectHealth,
  inspectIcon,
  inspectServiceWorker,
  inspectSocialAuthBoundary,
  inspectPublicPlayerAbsent,
  verifyLiveRelease,
  waitForEndpoint,
} from "../scripts/ops/verify-live-release.mjs";

const BASE = "https://daydle.agoodman.io";
const TYPE_JSON = { "content-type": "application/json; charset=utf-8" };
const TYPE_HTML = { "content-type": "text/html; charset=utf-8" };
const SW = 'const CACHE_NAME = "daydle-shell-aaaaaaaaaaaaaaaa";';

function health() {
  return new Response(
    JSON.stringify({ status: "ok", service: "daydle-api", version: "v1" }),
    { status: 200, headers: TYPE_JSON },
  );
}
function png(size: number) {
  const data = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data, 0);
  data.writeUInt32BE(size, 16);
  data.writeUInt32BE(size, 20);
  return new Response(data, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}
function liveResponse(url: string): Response {
  const path = new URL(url).pathname;
  if (path === "/api/v1/health") return health();
  if (path === "/api/v1/not-found")
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: TYPE_JSON,
    });
  if (path === "/api/v1/social")
    return new Response(JSON.stringify({ error: "authentication_required" }), {
      status: 401,
      headers: TYPE_JSON,
    });
  if (path === "/api/v1/players/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: TYPE_JSON,
    });
  if (path === "/app.webmanifest")
    return new Response(
      JSON.stringify({
        start_url: "/today",
        display: "standalone",
        icons: [{ purpose: "maskable" }],
      }),
      { status: 200, headers: { "content-type": "application/manifest+json" } },
    );
  if (path === "/sw.js")
    return new Response(SW, {
      status: 200,
      headers: { "content-type": "text/javascript" },
    });
  if (path === "/today" || path === "/games" || path === "/friends")
    return new Response("<!doctype html><html>Daydle</html>", {
      status: 200,
      headers: TYPE_HTML,
    });
  if (path === "/icons/icon-192.png") return png(192);
  if (path === "/icons/icon-512.png") return png(512);
  if (path === "/icons/apple-touch-icon.png") return png(180);
  throw new Error("Unexpected test route");
}

describe("live release verification after Cloudflare deployment", () => {
  it("requires the generated bundle to preserve worker-first API routing", () => {
    expect(() =>
      assertWorkerRouting({
        assets: {
          run_worker_first: ["/api/*"],
          not_found_handling: "single-page-application",
        },
      }),
    ).not.toThrow();
    expect(() => assertWorkerRouting({ assets: {} })).toThrow(/route/);
    expect(() =>
      assertWorkerRouting({
        assets: { run_worker_first: ["/games/*"] },
      }),
    ).toThrow();
  });

  it("does not mistake HTTP 200 HTML for a healthy API", async () => {
    const pause = vi.fn(async () => undefined);
    const log = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<!doctype html><html>Daydle</html>", {
          status: 200,
          headers: TYPE_HTML,
        }),
      )
      .mockResolvedValueOnce(health());

    await waitForEndpoint(BASE + "/api/v1/health", inspectHealth, {
      fetchImpl,
      pause,
      log,
      attempts: 3,
      delayMs: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(" ")).toContain("expected JSON");
  });

  it("fails with an actionable diagnostic if an HTML API fallback persists", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      async () =>
        new Response("<!doctype html><html>Daydle</html>", {
          status: 200,
          headers: TYPE_HTML,
        }),
    );
    await expect(
      waitForEndpoint(BASE + "/api/v1/health", inspectHealth, {
        fetchImpl,
        pause: async () => undefined,
        attempts: 2,
        delayMs: 0,
        log: vi.fn(),
      }),
    ).rejects.toThrow(/content-type text\/html/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a temporary API outage without logging the response body", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("PRIVATE SERVER CONTENT"))
      .mockResolvedValueOnce(health());
    const log = vi.fn();
    await waitForEndpoint(BASE + "/api/v1/health", inspectHealth, {
      fetchImpl,
      pause: async () => undefined,
      attempts: 2,
      delayMs: 0,
      log,
    });
    expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE");
  });

  it("rejects incorrect health JSON even with application/json", async () => {
    const incorrect = new Response(
      JSON.stringify({ status: "ok", service: "some-other-service" }),
      { status: 200, headers: TYPE_JSON },
    );
    await expect(inspectHealth(incorrect)).resolves.toMatch(/release contract/);
  });

  it("requires the deployed service worker source to match the build", async () => {
    const matching = new Response(SW, {
      headers: { "content-type": "text/javascript" },
    });
    const stale = new Response(
      'const CACHE_NAME = "daydle-shell-bbbbbbbbbbbbbbbb";',
      {
        headers: { "content-type": "text/javascript" },
      },
    );
    expect(await inspectServiceWorker(matching, SW)).toBeNull();
    expect(await inspectServiceWorker(stale, SW)).toMatch(/differs/);
  });

  it("supports public-only SW validation without embedding production VITE variables", async () => {
    const headers = { "content-type": "text/javascript" };
    expect(
      await inspectServiceWorker(new Response(SW, { headers }), undefined),
    ).toBeNull();
    expect(
      await inspectServiceWorker(
        new Response("const CACHE_NAME = 'unknown';", { headers }),
        undefined,
      ),
    ).toMatch(/invalid or unconfigured/);
  });

  it("checks actual PNG signature and dimensions", async () => {
    expect(await inspectIcon(png(192), 192)).toBeNull();
    expect(await inspectIcon(png(512), 192)).toMatch(/dimensions/);
    expect(
      await inspectIcon(
        new Response("not PNG", {
          headers: { "content-type": "image/png" },
        }),
        192,
      ),
    ).toMatch(/invalid PNG/);
  });

  it("fails closed on missing social route, missing Worker secrets or incorrect authorization denial", async () => {
    expect(
      await inspectSocialAuthBoundary(
        new Response("<html>fallback</html>", {
          status: 200,
          headers: TYPE_HTML,
        }),
      ),
    ).toMatch(/social auth/);
    expect(
      await inspectSocialAuthBoundary(
        new Response('{"error":"authentication_required"}', {
          status: 503,
          headers: TYPE_JSON,
        }),
      ),
    ).toMatch(/HTTP 503/);
    expect(
      await inspectPublicPlayerAbsent(
        new Response('{"error":"not_found"}', {
          status: 503,
          headers: TYPE_JSON,
        }),
      ),
    ).toMatch(/HTTP 503/);
  });

  it("verifies the entire live PWA/API contract using non-secret requests", async () => {
    const fetchImpl = vi.fn(async (url: string) => liveResponse(url));
    const log = vi.fn();
    await verifyLiveRelease({
      base: BASE,
      expectedServiceWorker: SW,
      fetchImpl,
      pause: async () => undefined,
      attempts: 1,
      log,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(12);
    expect(log.mock.calls.flat().join(" ")).toContain(
      "hosted API, current service worker version",
    );
  });

  it("fails if a PWA asset never reaches the expected version", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (new URL(url).pathname === "/sw.js") {
        return new Response(
          'const CACHE_NAME = "daydle-shell-bbbbbbbbbbbbbbbb";',
          {
            headers: { "content-type": "text/javascript" },
          },
        );
      }
      return liveResponse(url);
    });
    await expect(
      verifyLiveRelease({
        base: BASE,
        expectedServiceWorker: SW,
        fetchImpl,
        attempts: 2,
        delayMs: 0,
        pause: async () => undefined,
        log: vi.fn(),
      }),
    ).rejects.toThrow(/deployed version differs/);
  });
});
