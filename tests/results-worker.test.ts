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
    const calls = mockUpstream({
      status: "captured",
      classification: "unknown_header",
    });
    const raw = "Unrecognized Daily Game #17";
    const result = await worker.fetch(
      makeRequest(path(), "POST", { text: raw, userId: OTHER }),
      env,
    );
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ status: "unknown", captured: true });
    const request = calls.find((call) =>
      call.url.endsWith("/rpc/capture_unparsed_share"),
    );
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
    const calls = mockUpstream({
      status: "captured",
      classification: "invalid_format",
    });
    const raw = "Wordle 1406 4/6*\n⬛⬛⬛⬛🟩";
    const result = await worker.fetch(
      makeRequest(path(), "POST", { text: raw }),
      env,
    );
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({
      status: "invalid",
      code: "invalid_format",
      captured: true,
    });
    expect(
      calls.find((call) => call.url.endsWith("/rpc/capture_unparsed_share"))
        ?.body,
    ).toMatchObject({
      p_disposition: "invalid",
      p_reason: "invalid_format",
      p_game_slug: "wordle",
    });
  });

  it("retains ambiguous mixed-game shares with a bounded candidate set", async () => {
    const calls = mockUpstream({
      status: "captured",
      classification: "ambiguous_match",
    });
    const mixed = wordle + "\nStrands #987";
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: mixed }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      status: "ambiguous",
      gameSlugs: ["wordle", "strands"],
      captured: true,
    });
    const captured = calls.find((call) =>
      call.url.endsWith("/rpc/capture_unparsed_share"),
    );
    expect(captured?.body).toMatchObject({
      p_user: USER,
      p_disposition: "unsupported",
      p_reason: "ambiguous_match",
      p_candidates: ["wordle", "strands"],
    });
  });

  it("bounds invalid sample capture and never retains empty, oversized or NUL shares", async () => {
    const calls = mockUpstream({ status: "captured" });
    for (const raw of ["", "x".repeat(10_001), "Wordle 1/6\u0000bad"]) {
      const response = await worker.fetch(
        makeRequest(path(), "POST", { text: raw }),
        env,
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as { captured?: boolean };
      expect(body.captured).toBe(false);
      if (raw.length > 0)
        expect(JSON.stringify(body)).not.toContain(raw.slice(0, 150));
    }
    expect(calls.filter((call) => call.url.includes("/rpc/"))).toHaveLength(0);
  });

  it("captures too-many-lines input when within raw retention limits", async () => {
    const calls = mockUpstream({ status: "captured" });
    const raw = Array.from({ length: 65 }, () => "a").join("\n");
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: raw }),
      env,
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      status: "invalid",
      code: "too_many_lines",
      captured: true,
    });
    expect(
      calls.find((call) => call.url.includes("/rpc/"))?.body,
    ).toMatchObject({
      p_disposition: "invalid",
      p_reason: "too_many_lines",
    });
  });

  it("returns service failure rather than claiming capture if the database write fails", async () => {
    const calls = mockUpstream({ invalid: true });
    const response = await worker.fetch(
      makeRequest(path(), "POST", { text: "unknown publisher format" }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "result_service_unavailable",
    });
    expect(
      calls.find((call) => call.url.endsWith("/rpc/capture_unparsed_share")),
    ).toBeTruthy();
  });

  it("does not expose the obsolete standalone unknown-retention endpoint", async () => {
    const calls = mockUpstream({ status: "captured" });
    const result = await worker.fetch(
      makeRequest(path("/unknown"), "POST", {
        text: "random unknown",
        retain: true,
      }),
      env,
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

describe("sanitized privileged Supabase RPC diagnostics", () => {
  const absentProfile = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const requestUrl = "https://daydle.example/api/v1/players/" + absentProfile;

  it.each([
    [401, "PGRST301"],
    [403, "42501"],
    [404, "PGRST202"],
    [500, "XX000"],
  ])(
    "logs HTTP %i and a sanitized PostgREST code without disclosing response details",
    async (status, code) => {
      const err = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const upstream = vi.fn(async () =>
        Response.json(
          {
            code,
            message: "SECRET_UPSTREAM_MESSAGE_AND_JWT",
            details: "RAW_PRIVATE_SHARE",
            hint: "access_token=PRIVATE",
          },
          { status },
        ),
      );
      vi.stubGlobal("fetch", upstream);

      const response = await worker.fetch(new Request(requestUrl), env);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "result_service_unavailable",
      });
      expect(err).toHaveBeenCalledExactlyOnceWith("supabase_rpc_failure", {
        rpc: "social_public_profile",
        httpStatus: status,
        postgrestCode: code,
      });
      const recorded = JSON.stringify(err.mock.calls);
      expect(recorded).not.toContain("SECRET_UPSTREAM");
      expect(recorded).not.toContain("RAW_PRIVATE_SHARE");
      expect(recorded).not.toContain("access_token");
      expect(recorded).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
      expect(recorded).not.toContain(absentProfile);
      expect(upstream).toHaveBeenCalledOnce();
    },
  );

  it("nulls malicious/malformed PostgREST code rather than printing it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { code: "PGRST202\\nSECRET_HEADER", message: "TOKEN_PRIVATE" },
          { status: 403 },
        ),
      ),
    );
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(503);
    expect(err).toHaveBeenCalledWith("supabase_rpc_failure", {
      rpc: "social_public_profile",
      httpStatus: 403,
      postgrestCode: null,
    });
    expect(JSON.stringify(err.mock.calls)).not.toContain("SECRET_HEADER");
    expect(JSON.stringify(err.mock.calls)).not.toContain("TOKEN_PRIVATE");
  });

  it("handles non-JSON upstream failures without logging the response body", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("PRIVATE_UPSTREAM_HTML_BODY", { status: 502 }),
      ),
    );
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(503);
    expect(err).toHaveBeenCalledWith("supabase_rpc_failure", {
      rpc: "social_public_profile",
      httpStatus: 502,
      postgrestCode: null,
    });
    expect(JSON.stringify(err.mock.calls)).not.toContain("PRIVATE_UPSTREAM");
  });

  it("retains the existing explicit rate-limit mapping without noisy failure logs", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "result_rate_limited", code: "P0001" },
          { status: 400 },
        ),
      ),
    );
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(err).not.toHaveBeenCalled();
  });

  it("emits a safe, distinct transport event and never logs exceptions", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Bearer SENSITIVE_TOKEN_IN_EXCEPTION");
      }),
    );
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(503);
    expect(err).toHaveBeenCalledWith("supabase_rpc_transport_failure", {
      rpc: "social_public_profile",
    });
    expect(JSON.stringify(err.mock.calls)).not.toContain("SENSITIVE_TOKEN");
  });

  it("does not log successful public-profile RPC requests", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(null)),
    );
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(404);
    expect(err).not.toHaveBeenCalled();
  });
});

describe("Cloudflare Worker outbound redirect compatibility", () => {
  const absentProfile = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const requestUrl = "https://daydle.example/api/v1/players/" + absentProfile;

  it("uses Cloudflare-supported manual redirect mode for the authenticated Supabase user lookup", async () => {
    const upstream = vi.fn(async () => Response.json({ id: USER }));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(makeRequest(path()), env);
    expect(response.status).toBe(503);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[0]?.[1]?.redirect).toBe("manual");
    expect(upstream.mock.calls[1]?.[1]?.redirect).toBe("manual");
  });

  it("does not follow Supabase Auth redirects or forward the user token", async () => {
    const upstream = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://untrusted.example/collect" },
        }),
    );
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(makeRequest(path()), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "service_unavailable" });
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[1]?.redirect).toBe("manual");
  });

  it("does not follow privileged RPC redirects or forward the service-role key", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upstream = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://untrusted.example/collect" },
        }),
    );
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "result_service_unavailable",
    });
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[1]?.redirect).toBe("manual");
    expect(log).toHaveBeenCalledWith("supabase_rpc_failure", {
      rpc: "social_public_profile",
      httpStatus: 302,
      postgrestCode: null,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  it("sets manual redirect mode on successful privileged RPC fetches", async () => {
    const upstream = vi.fn(async () => Response.json(null));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request(requestUrl), env);
    expect(response.status).toBe(404);
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0]?.[1]?.redirect).toBe("manual");
  });
});
