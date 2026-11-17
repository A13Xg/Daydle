import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { ResultsEnvironment } from "../worker/results";
import {
  connectionLink, normalizeFriendCode, validPublicPlayer, validSocialNetwork,
} from "../shared/social";
import { codeFromScan } from "../src/components/FriendScanner";
import {
  rememberPendingFriendCode, takePendingFriendCode,
} from "../src/lib/social-api";

const OWNER = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://daydle.example";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://sample.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_public",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_service_role_testing_secret_never_exposed",
};
const profile = {
  id: PEER, display_name: "Other", created_at: "2026-11-15T00:00:00Z",
  games: [{ name: "Wordle", slug: "wordle" }],
};
const network = { code: "K7M4P", friends: [{ id: PEER, display_name: "Other" }], blocked: [], has_more_friends: false };

function mockRpc(result: unknown) {
  const calls: { url: string; body: Record<string, unknown> | null; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    calls.push({
      url: path,
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null,
      init,
    });
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: OWNER });
    if (path.includes("/rpc/")) return Response.json(result);
    throw Error("Unexpected service call");
  }));
  return calls;
}
const request = (path: string, method = "GET", body?: Record<string, unknown>) =>
  new Request(ORIGIN + path, {
    method,
    headers: {
      authorization: "Bearer test.jwt.value",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("social contract and user safety", () => {
  it("normalizes unambiguous codes and restricts invite QR links to local origin", () => {
    expect(normalizeFriendCode(" k7m4p ")).toBe("K7M4P");
    expect(normalizeFriendCode("IO0L1")).toBeNull();
    expect(normalizeFriendCode("TOOLONG")).toBeNull();
    const link = connectionLink("K7M4P", ORIGIN)!;
    expect(link).toBe(ORIGIN + "/friends?code=K7M4P");
    expect(codeFromScan(link, ORIGIN)).toBe("K7M4P");
    expect(codeFromScan("K7M4P", ORIGIN)).toBe("K7M4P");
    expect(codeFromScan("https://attacker.example/friends?code=K7M4P", ORIGIN)).toBeNull();
    expect(codeFromScan(ORIGIN + "/today?code=K7M4P", ORIGIN)).toBeNull();
  });
  it("retains a bounded code through login exactly once", () => {
    const items = new Map<string, string>();
    const storage = {
      setItem: (key: string, value: string) => { items.set(key, value); },
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => { items.delete(key); },
    } as Storage;
    expect(rememberPendingFriendCode("K7M4P", storage)).toBe(true);
    expect(takePendingFriendCode(storage)).toBe("K7M4P");
    expect(takePendingFriendCode(storage)).toBeNull();
    expect(rememberPendingFriendCode("bad!", storage)).toBe(false);
  });
  it("validates public/profile DTOs without accepting private alternatives", () => {
    expect(validPublicPlayer(profile)).toBe(true);
    expect(validSocialNetwork(network)).toBe(true);
    expect(validPublicPlayer({ ...profile, games: [{ slug: "bad/path", name: "X" }] })).toBe(false);
    expect(validSocialNetwork({ ...network, code: "O0IL1" })).toBe(false);
  });
  it("reads only an explicit public profile, with no bearer needed", async () => {
    const calls = mockRpc({ ...profile, email: "private@example.invalid", score: 1000 });
    const response = await worker.fetch(new Request(ORIGIN + "/api/v1/players/" + PEER), env);
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toEqual(profile);
    expect(JSON.stringify(data)).not.toContain("private@example.invalid");
    expect(JSON.stringify(data)).not.toContain("score");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toMatch(/\/rpc\/social_public_profile$/);
    expect(calls[0]?.body).toEqual({ p_profile: PEER });
  });
  it("requires verified identity to fetch private network, ignoring URL impersonation", async () => {
    const calls = mockRpc({ ...network, email: "private@example.invalid" });
    const response = await worker.fetch(request("/api/v1/social?userId=" + PEER), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(network);
    expect(calls[1]?.body).toEqual({ p_user: OWNER });
    expect(JSON.stringify(calls[1]?.init?.headers)).toContain("eyJ_service_role_testing");
    expect(JSON.stringify(await response.clone().text())).not.toContain("private@example.invalid");
  });
  it("denies unauthenticated and cross-origin mutation with no upstream call", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await worker.fetch(new Request(ORIGIN + "/api/v1/social"), env)).status).toBe(401);
    const invalid = request("/api/v1/social", "POST", { action: "connect", code: "K7M4P" });
    invalid.headers.set("origin", "https://attacker.example");
    expect((await worker.fetch(invalid, env)).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("normalizes code and never trusts client-supplied owner identity", async () => {
    const calls = mockRpc({ status: "connected", friend: { id: PEER, display_name: "Other" } });
    const response = await worker.fetch(request("/api/v1/social", "POST", {
      action: "connect", code: "k7m4p", userId: PEER,
    }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "connected", friend: { id: PEER, display_name: "Other" } });
    expect(calls[1]?.body).toEqual({ p_user: OWNER, p_code: "K7M4P" });
  });
  it("restricts target actions and returns correct rate and self status codes", async () => {
    mockRpc({ status: "rate_limited" });
    const limited = await worker.fetch(request("/api/v1/social", "POST", { action: "connect", code: "K7M4P" }), env);
    expect(limited.status).toBe(429);
    expect((await limited.json() as { status: string }).status).toBe("rate_limited");
    mockRpc({ status: "self" });
    const self = await worker.fetch(request("/api/v1/social", "POST", { action: "connect", code: "K7M4P" }), env);
    expect(self.status).toBe(409);
    const invalid = await worker.fetch(request("/api/v1/social", "POST", { action: "block", targetId: "wrong" }), env);
    expect(invalid.status).toBe(422);
  });
  it("does not leak secrets, other-user profile details or arbitrary raw RPC responses", async () => {
    mockRpc({ ...profile, raw_share_text: "PRIVATE", code: "K7M4P", games: null });
    const malformed = await worker.fetch(new Request(ORIGIN + "/api/v1/players/" + PEER), env);
    expect(malformed.status).toBe(503);
    expect(await malformed.json()).toEqual({ error: "social_service_unavailable" });
  });
});
