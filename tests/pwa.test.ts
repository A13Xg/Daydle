import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = {
    addAll: vi.fn(),
    match: vi.fn().mockResolvedValue(
      new Response("<html>generic public shell</html>", {
        headers: { "content-type": "text/html" },
      }),
    ),
    put: vi.fn(),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  };
  const self = {
    location: { origin: "https://daydle.example" },
    addEventListener: (name: string, fn: (event: unknown) => void) =>
      listeners.set(name, fn),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  const context = {
    self,
    caches,
    URL,
    Response,
    fetch: vi.fn().mockRejectedValue(new Error("offline")),
  };
  const template = readFileSync("scripts/sw-template.js", "utf8").replace(
    "/*__DAYDLE_PWA_CONFIG__*/",
    'const CACHE_NAME = "daydle-shell-test";\nconst PRECACHE_URLS = ["/index.html"];',
  );
  runInNewContext(template, context);
  return { listeners, context, cache, caches };
}

describe("offline install and security boundaries", () => {
  it("provides a valid standalone manifest and Apple-compatible PNG sizes", () => {
    const manifest = JSON.parse(readFileSync("public/app.webmanifest", "utf8"));
    expect(manifest.start_url).toBe("/today");
    expect(manifest.display).toBe("standalone");
    expect(
      manifest.icons.some(
        (icon: { purpose: string }) => icon.purpose === "maskable",
      ),
    ).toBe(true);

    execFileSync(process.execPath, ["scripts/generate-icons.mjs"]);
    for (const [name, size] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-512.png", 512],
      ["apple-touch-icon.png", 180],
    ] as const) {
      const png = readFileSync("public/icons/" + name);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it("does not intercept Supabase, Worker API, OAuth, accounts, POST or cross-origin", () => {
    const { listeners } = worker();
    const onFetch = listeners.get("fetch");
    expect(onFetch).toBeDefined();
    for (const [url, method, mode] of [
      ["https://daydle.example/api/v1/health", "GET", "cors"],
      ["https://daydle.example/auth/callback?code=private", "GET", "navigate"],
      ["https://daydle.example/account", "GET", "navigate"],
      ["https://daydle.example/history", "GET", "navigate"],
      ["https://daydle.example/api/v1/results", "GET", "cors"],
      ["https://daydle.example/rest/v1/game_results", "GET", "cors"],
      ["https://project.supabase.co/rest/v1/game_results", "GET", "cors"],
      ["https://daydle.example/assets/script.js", "POST", "cors"],
      ["https://daydle.example/today?code=secret", "GET", "navigate"],
    ]) {
      const respondWith = vi.fn();
      onFetch?.({
        request: { method, mode, url, headers: new Headers() },
        respondWith,
      });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("never caches requests carrying authentication or apikey headers", () => {
    const { listeners } = worker();
    const onFetch = listeners.get("fetch");
    for (const name of ["authorization", "apikey"]) {
      const respondWith = vi.fn();
      onFetch?.({
        request: {
          method: "GET",
          mode: "cors",
          url: "https://daydle.example/assets/secret.js",
          headers: new Headers([[name, "sensitive"]]),
        },
        respondWith,
      });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("keeps the new Arcade shell's public routes offline-safe and auth pages excluded", () => {
    const { listeners } = worker();
    const onFetch = listeners.get("fetch");
    for (const pathname of [
      "/lineup",
      "/statistics",
      "/friends",
      "/notifications",
      "/how-it-works",
    ]) {
      const respondWith = vi.fn();
      onFetch?.({
        request: {
          method: "GET",
          mode: "navigate",
          url: "https://daydle.example" + pathname,
          headers: new Headers(),
        },
        respondWith,
      });
      expect(respondWith).toHaveBeenCalledTimes(1);
    }
    for (const pathname of ["/account", "/auth", "/auth/callback"]) {
      const respondWith = vi.fn();
      onFetch?.({
        request: {
          method: "GET",
          mode: "navigate",
          url: "https://daydle.example" + pathname,
          headers: new Headers(),
        },
        respondWith,
      });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("serves only the generic cached SPA HTML after an eligible navigation fails offline", async () => {
    const { listeners, cache } = worker();
    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://daydle.example/games/wordle",
        headers: new Headers(),
      },
      respondWith: (p: Promise<Response>) => {
        responsePromise = p;
      },
    });
    expect(responsePromise).toBeDefined();
    expect(await (await responsePromise)?.text()).toContain(
      "generic public shell",
    );
    expect(cache.match).toHaveBeenCalledWith("/index.html");
  });
});
