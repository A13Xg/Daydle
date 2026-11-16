import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  probePublicGames,
  readKeepaliveConfig,
  runKeepalive,
} from "../scripts/ops/keepalive.mjs";

const key = "sb_publishable_synthetic_test_only";
const projectUrl = "https://daydle-example.supabase.co";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    ),
  ));
  vi.restoreAllMocks();
});

async function localServer(status = 200) {
  const calls: Array<{ method: string | undefined; path: string | undefined; apikey: string | undefined }> = [];
  const server = createServer((request, response) => {
    calls.push({
      method: request.method,
      path: request.url,
      apikey: request.headers.apikey as string | undefined,
    });
    response.writeHead(status, { "content-type": "application/json" });
    response.end(status === 200 ? "[]" : '{"message":"Invalid API key"}');
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server port");
  return { baseUrl: "http://127.0.0.1:" + address.port, calls };
}

describe("Supabase keep-alive operational contract", () => {
  it("validates the real Supabase HTTPS origin and public key", () => {
    expect(readKeepaliveConfig({
      SUPABASE_URL: projectUrl,
      SUPABASE_PUBLISHABLE_KEY: key,
    })).toEqual({ baseUrl: projectUrl, publishableKey: key });

    for (const badUrl of [
      "http://daydle-example.supabase.co",
      "https://example.com",
      "https://user:password@daydle-example.supabase.co",
      "https://daydle-example.supabase.co/some-path",
      "http://127.0.0.1:54321",
    ]) {
      expect(() => readKeepaliveConfig({
        SUPABASE_URL: badUrl,
        SUPABASE_PUBLISHABLE_KEY: key,
      })).toThrow();
    }
    expect(() => readKeepaliveConfig({
      SUPABASE_URL: projectUrl,
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_must_not_use",
    })).toThrow();
  });

  it("sends an actual row-limited GET with the configured key to a local HTTP server", async () => {
    const { baseUrl, calls } = await localServer(200);
    await expect(probePublicGames({ baseUrl, publishableKey: key })).resolves.toBe(200);
    expect(calls).toEqual([{
      method: "GET",
      path: "/rest/v1/games?select=id&limit=1",
      apikey: key,
    }]);
  });

  it("rejects an HTTP 401 and does not log response bodies or credentials", async () => {
    const { baseUrl, calls } = await localServer(401);
    const onStatus = vi.fn();
    const onLogs = vi.fn();
    await expect(probePublicGames({
      baseUrl, publishableKey: key, onStatus,
    })).rejects.toThrow("HTTP 401");
    expect(onStatus).toHaveBeenCalledWith(401);
    expect(calls[0]?.apikey).toBe(key);
    expect(onLogs).not.toHaveBeenCalled();
  });

  it("does not retry permanent credential errors and reports only the status", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad key", { status: 401 }));
    const log = vi.fn();
    await expect(runKeepalive({
      SUPABASE_URL: projectUrl,
      SUPABASE_PUBLISHABLE_KEY: key,
    }, { fetchImpl, log })).rejects.toThrow("HTTP 401");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("requires daily cadence and runs the tested request code, not an inline placeholder", () => {
    const workflow = readFileSync(".github/workflows/keepalive.yml", "utf8");
    expect(workflow).toContain('cron: "17 12 * * *"');
    expect(workflow).toContain("node scripts/ops/keepalive.mjs");
    expect(workflow).not.toContain("apikey: ***");
    expect(workflow).not.toMatch(/wrangler deploy|supabase db push/);
  });
});
