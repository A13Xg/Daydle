import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { ResultsEnvironment } from "../worker/results";
import { ADMIN_PATH, REQUESTS_PATH, validRequests } from "../shared/administration";

const ORIGIN = "https://daydle.example";
const USER = "11111111-1111-4111-8111-111111111111";
const ITEM = "44444444-4444-4444-8444-444444444444";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://sample.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_public",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_service_role_testing_secret_never_exposed",
};
const requestItem = {
  id: ITEM,
  name: "Puzzle",
  url: "https://games.example/puzzle",
  notes: "",
  status: "pending",
  created_at: "2026-11-17T00:00:00Z",
  vote_count: 2,
  voted_by_me: false,
  suggested_by_me: false,
};
function makeRequest(
  path: string,
  options: { token?: string; method?: string; body?: unknown; origin?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = options.token;
  if (options.origin) headers.origin = options.origin;
  if (options.body) headers["content-type"] = "application/json";
  return new Request(ORIGIN + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}
function mockBackends(
  values: Record<string, unknown> = {},
  opts: { validToken?: boolean } = {},
) {
  const calls: Array<{ path: string; data: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user"))
      return opts.validToken === false
        ? Response.json({ message: "denied" }, { status: 401 })
        : Response.json({ id: USER });
    const rpcName = target.split("/rest/v1/rpc/")[1];
    if (!rpcName) throw new Error("Unexpected upstream");
    calls.push({
      path: rpcName,
      data: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {},
    });
    const value = values[rpcName];
    return Response.json(value === undefined ? null : value);
  }));
  return calls;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Phase 11 request and administration boundary", () => {
  it("makes guest listings public without allowing extra columns or caching", async () => {
    const calls = mockBackends({
      daydle_requests: [{ ...requestItem, raw_share_text: "PRIVATE", email: "private@example.invalid" }],
    });
    const res = await worker.fetch(makeRequest(REQUESTS_PATH), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([requestItem]);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("vary")).toContain("Authorization");
    expect(calls).toEqual([{ path: "daydle_requests", data: {
      p_actor: null, p_limit: 20, p_offset: 0,
    }}]);
  });

  it("rejects malformed or invalid token rather than downgrading to anonymous", async () => {
    const calls = mockBackends({ daydle_requests: [] }, { validToken: false });
    const res = await worker.fetch(makeRequest(REQUESTS_PATH, {
      token: "Bearer invalid.jwt.token",
    }), env);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("requires verified user identity for mutation and rejects foreign origins", async () => {
    const calls = mockBackends();
    expect((await worker.fetch(makeRequest(REQUESTS_PATH, {
      method: "POST", body: { action: "vote", id: ITEM },
    }), env)).status).toBe(401);
    expect((await worker.fetch(makeRequest(REQUESTS_PATH, {
      method: "POST", origin: "https://attacker.example", token: "Bearer token.jwt.value",
      body: { action: "vote", id: ITEM },
    }), env)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("enforces IDs, URL and pagination before invoking privileged RPC", async () => {
    const calls = mockBackends();
    for (const path of [
      REQUESTS_PATH + "?limit=51",
      REQUESTS_PATH + "?offset=-1",
      REQUESTS_PATH + "?offset=9999999",
    ]) {
      expect((await worker.fetch(makeRequest(path), env)).status).toBe(422);
    }
    for (const body of [
      { action: "vote", id: "not-a-uuid" },
      { action: "create", name: "Puzzle", url: "http://unsafe.example" },
      { action: "create", name: "Puzzle", url: "https://user:pass@example.org/" },
      { action: "moderate", id: ITEM },
    ]) {
      expect((await worker.fetch(makeRequest(REQUESTS_PATH, {
        method: "POST", token: "Bearer token.jwt.value", body,
      }), env)).status).toBe(422);
    }
    expect(calls).toHaveLength(0);
  });

  it("uses verified actor and strips client-supplied actor and SQL response extras", async () => {
    const calls = mockBackends({
      daydle_request_action: { status: "created", id: ITEM, raw_share_text: "SECRET" },
    });
    const res = await worker.fetch(makeRequest(REQUESTS_PATH, {
      method: "POST", token: "Bearer token.jwt.value",
      body: {
        action: "create", name: "Puzzle", url: "https://games.example/puzzle",
        notes: "Why", p_actor: "99999999-9999-9999-9999-999999999999",
      },
    }), env);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: "created", id: ITEM });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.data).toMatchObject({
      p_actor: USER, p_action: "create", p_name: "Puzzle",
      p_url: "https://games.example/puzzle", p_notes: "Why",
    });
    expect(JSON.stringify(calls[0]?.data)).not.toContain("99999999");
    expect(calls[0]?.path).toBe("daydle_request_action");
  });

  it("permits only verified admins to use private endpoints", async () => {
    const calls = mockBackends({ daydle_admin_status: false });
    const res = await worker.fetch(makeRequest(ADMIN_PATH + "?view=sample&id=" + ITEM, {
      token: "Bearer token.jwt.value",
    }), env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "admin_required" });
    expect(calls).toEqual([{ path: "daydle_admin_status", data: { p_actor: USER } }]);
  });

  it("does not expose raw sample from metadata list even if upstream adds it", async () => {
    const calls = mockBackends({
      daydle_admin_status: true,
      daydle_admin_view: [{
        id: ITEM, disposition: "unsupported", received_at: "2026-11-17",
        expires_at: "2027-02-17", reason: "unknown_header", review_status: "pending",
        game_slug: null, raw_text: "CONFIDENTIAL",
      }],
    });
    const res = await worker.fetch(makeRequest(ADMIN_PATH + "?view=samples", {
      token: "Bearer token.jwt.value",
    }), env);
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain("CONFIDENTIAL");
    expect(calls[1]?.data).toMatchObject({
      p_actor: USER, p_view: "samples", p_limit: 20, p_offset: 0,
    });
  });

  it("exposes raw text only to authorized explicit sample details", async () => {
    mockBackends({
      daydle_admin_status: true,
      daydle_admin_view: { id: ITEM, raw_text: "PRIVATE", disposition: "invalid",
        expires_at: "2027-02-17", diagnostics: { reason_code: "invalid_format" },
        attacker_data: "LEAK" },
    });
    const res = await worker.fetch(makeRequest(ADMIN_PATH + "?view=sample&id=" + ITEM, {
      token: "Bearer token.jwt.value",
    }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: ITEM, raw_text: "PRIVATE", disposition: "invalid",
      expires_at: "2027-02-17", diagnostics: { reason_code: "invalid_format" },
    });
  });

  it("rejects malformed and restricted admin actions", async () => {
    const calls = mockBackends({ daydle_admin_status: true });
    const invalid = [
      { action: "grant_admin", data: { userId: USER } },
      { action: "retire_game", data: { id: "bad-id" } },
      { action: "review_sample", data: { id: ITEM, status: 123 } },
    ];
    for (const body of invalid) {
      const res = await worker.fetch(makeRequest(ADMIN_PATH, {
        method: "POST", token: "Bearer token.jwt.value", body,
      }), env);
      expect(res.status).toBe(422);
    }
    expect(calls.every((x) => x.path === "daydle_admin_status")).toBe(true);
  });

  it("fails closed when Worker privileged config is missing", async () => {
    const calls = mockBackends();
    const res = await worker.fetch(makeRequest(REQUESTS_PATH), {});
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it("rejects unexpected public request DTOs", () => {
    expect(validRequests([requestItem])).toBe(true);
    expect(validRequests([{ ...requestItem, vote_count: -1 }])).toBe(false);
    expect(validRequests([{ ...requestItem, raw_share_text: "extra" }])).toBe(true);
  });
});
