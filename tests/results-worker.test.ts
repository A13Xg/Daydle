import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { ResultsEnvironment } from "../worker/results";
import { RESULTS_PATH } from "../shared/results";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JWT = "Bearer mock.jwt.token";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://sample.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_public",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_service_role_testing_secret_never_exposed",
};
const wordle = [
  "Wordle 1,406 4/6*",
  "⬛⬛⬛⬛🟩",
  "⬛⬛⬛🟨🟩",
  "⬛🟨⬛⬛🟩",
  "🟩🟩🟩🟩🟩",
].join("\n");
const path = (suffix = "") => "https://daydle.example" + RESULTS_PATH + suffix;

function makeRequest(
  url: string,
  method = "GET",
  payload?: Record<string, unknown>,
  token = JWT,
): Request {
  return new Request(url, {
    method,
    headers: {
      authorization: token,
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}

function mockUpstream(result: unknown, userId = USER) {
  const calls: {
    url: string;
    body?: Record<string, unknown>;
    init?: RequestInit;
  }[] = [];
  const fetchMock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const address = String(url);
      calls.push({
        url: address,
        body: init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined,
        init,
      });
      if (address.endsWith("/auth/v1/user"))
        return Response.json({ id: userId });
      if (address.includes("/rest/v1/rpc/")) return Response.json(result);
      throw new Error("unexpected upstream");
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authenticated result Worker boundary", () => {
  it("preserves public health and rejects unauthenticated result calls", async () => {
    expect(
      (
        await worker.fetch(
          new Request("https://daydle.example/api/v1/health"),
          env,
        )
      ).status,
    ).toBe(200);
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request(path()), env);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication_required" });
    expect(upstream).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not work without server secrets or with a cross-site origin", async () => {
    expect((await worker.fetch(makeRequest(path()), {})).status).toBe(503);
    const req = makeRequest(path(), "POST", { text: wordle });
    req.headers.set("origin", "https://attacker.example");
    expect((await worker.fetch(req, env)).status).toBe(403);
  });

  it("persists only a parsed supported one-share result using verified user identity", async () => {
    const calls = mockUpstream({ status: "saved", id: ID });
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: wordle, userId: OTHER }),
      env,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "saved", id: ID });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://sample.supabase.co/auth/v1/user");
    expect(calls[0]?.init?.headers).toMatchObject({
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: JWT,
    });
    expect(calls[1]?.url).toMatch(/\/rpc\/ingest_parsed_share$/);
    expect(calls[1]?.body).toMatchObject({
      p_user: USER,
      p_raw: wordle,
      p_parsed: {
        gameSlug: "wordle",
        puzzleKey: "wordle:number:1406",
        attempts: 4,
      },
      p_replace_id: null,
    });
    expect(calls[1]?.init?.headers).toMatchObject({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  });

  it("retains bounded unknown shares on explicit Submit and classifies them", async () => {
    const calls = mockUpstream({ status: "captured", classification: "unknown_header" });
    const raw = "Unrecognized Daily Game #17";
    const result = await worker.fetch(makeRequest(path(), "POST", { text: raw, userId: OTHER }), env);
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ status: "unknown", captured: true });
    const request = calls.find((call) => call.url.endsWith("/rpc/capture_unparsed_share"));
    expect(request?.body).toEqual({
      p_user: USER,
      p_raw: raw,
      p_disposition: "unsupported",
      p_reason: "unknown_header",
      p_candidates: [],
      p_game_slug: null,
    });
  });

  it("captures recognized but malformed shares with parser hint and category", async () => {
    const calls = mockUpstream({ status: "captured", classification: "invalid_format" });
    const raw = "Wordle 1406 4/6*\n⬛⬛⬛⬛🟩";
    const result = await worker.fetch(makeRequest(path(), "POST", { text: raw }), env);
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({
      status: "invalid", code: "invalid_format", captured: true,
    });
    expect(calls.find((call) => call.url.endsWith("/rpc/capture_unparsed_share"))?.body).toMatchObject({
      p_disposition: "invalid",
      p_reason: "invalid_format",
      p_game_slug: "wordle",
    });
  });

  it("bounds invalid sample capture and never retains empty, oversized or NUL shares", async () => {
    const calls = mockUpstream({ status: "captured" });
    for (const raw of ["", "x".repeat(10_001), "Wordle 1/6\u0000bad"]) {
      const response = await worker.fetch(makeRequest(path(), "POST", { text: raw }), env);
      expect(response.status).toBe(422);
      const body = await response.json() as { captured?: boolean };
      expect(body.captured).toBe(false);
      expect(JSON.stringify(body)).not.toContain(raw.slice(0, 150));
    }
    expect(calls.filter((call) => call.url.includes("/rpc/"))).toHaveLength(0);
  });

  it("captures too-many-lines input when within raw retention limits", async () => {
    const calls = mockUpstream({ status: "captured" });
    const raw = Array.from({ length: 65 }, () => "a").join("\n");
    const response = await worker.fetch(makeRequest(path(), "POST", { text: raw }), env);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      status: "invalid", code: "too_many_lines", captured: true,
    });
    expect(calls.find((call) => call.url.includes("/rpc/"))?.body).toMatchObject({
      p_disposition: "invalid", p_reason: "too_many_lines",
    });
  });

  it("returns service failure rather than claiming capture if the database write fails", async () => {
    const calls = mockUpstream({ invalid: true });
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: "unknown publisher format" }), env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "result_service_unavailable" });
    expect(calls.find((call) => call.url.endsWith("/rpc/capture_unparsed_share"))).toBeTruthy();
  });

  it("does not expose the obsolete standalone unknown-retention endpoint", async () => {
    const calls = mockUpstream({ status: "captured" });
    const result = await worker.fetch(
      makeRequest(path("/unknown"), "POST", { text: "random unknown", retain: true }), env,
    );
    expect(result.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("returns sanitized conflict and supports an explicit same-result replacement target", async () => {
    const calls = mockUpstream({ status: "conflict", id: ID });
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: wordle }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "conflict", id: ID });
    await worker.fetch(
      makeRequest(path(), "POST", {
        text: wordle,
        replaceResultId: ID,
      }),
      env,
    );
    expect(
      calls.filter((x) => x.url.includes("/rpc/"))[1]?.body?.p_replace_id,
    ).toBe(ID);
    const invalid = await worker.fetch(
      makeRequest(path(), "POST", {
        text: wordle,
        replaceResultId: OTHER.slice(0, 3),
      }),
      env,
    );
    expect(invalid.status).toBe(422);
  });

  it("scopes history, detail and deletion to verified user, never a query user ID", async () => {
    const calls = mockUpstream([]);
    const list = await worker.fetch(
      makeRequest(path("?game=wordle&limit=20&userId=" + OTHER)),
      env,
    );
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ items: [] });
    expect(calls[1]?.body).toMatchObject({
      p_user: USER,
      p_game: "wordle",
      p_limit: 20,
    });
    const bad = await worker.fetch(makeRequest(path("?limit=500")), env);
    expect(bad.status).toBe(400);
    expect(calls.filter((x) => x.url.includes("/rpc/"))).toHaveLength(1);

    const detail = await worker.fetch(makeRequest(path("/" + ID)), env);
    expect(calls.at(-1)?.body).toMatchObject({ p_user: USER, p_id: ID });
    expect(detail.status).toBe(503); // An array is not a valid scalar detail payload.

    const deleted = await worker.fetch(
      makeRequest(path("/" + ID), "DELETE"),
      env,
    );
    expect(calls.at(-1)?.body).toMatchObject({ p_user: USER, p_id: ID });
    expect(deleted.status).toBe(503);
  });

  it("bounds body streaming, method dispatch, content types and upstream failures", async () => {
    expect(
      (await worker.fetch(makeRequest(path(), "PUT", { text: wordle }), env))
        .status,
    ).toBe(405);
    const calls = mockUpstream({ status: "saved", id: ID });
    const huge = await worker.fetch(
      makeRequest(path(), "POST", { text: "x".repeat(60_000) }),
      env,
    );
    expect(huge.status).toBe(413);
    const badType = await worker.fetch(
      new Request(path(), {
        method: "POST",
        headers: { authorization: JWT },
        body: "{}",
      }),
      env,
    );
    expect(badType.status).toBe(415);
    expect(calls.filter((x) => x.url.includes("/rpc/"))).toHaveLength(0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    expect((await worker.fetch(makeRequest(path()), env)).status).toBe(503);
  });
});
