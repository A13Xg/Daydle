import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { ResultsEnvironment } from "../worker/results";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const api = "https://daydle.example/api/v1/statistics?timezone=America%2FLos_Angeles";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_key",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_testing_service_role_key_never_log",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("owner-only statistics endpoint", () => {
  it("rejects unauthorized users and invalid methods/timezones without upstream calls", async () => {
    const mocked = vi.fn();
    vi.stubGlobal("fetch", mocked);
    const request = (url: string, method = "GET") =>
      new Request(url, { method });

    expect((await worker.fetch(request(api), env)).status).toBe(401);
    expect(
      (await worker.fetch(request(api.replace("America%2FLos_Angeles", "../bad")), env))
        .status,
    ).toBe(400);
    expect((await worker.fetch(request(api, "POST"), env)).status).toBe(405);
    expect(
      (
        await worker.fetch(
          request(api, "GET"),
          {},
        )
      ).status,
    ).toBe(503);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("uses the verified owner, protects the service key and derives achievements", async () => {
    const upstream: { url: string; body: unknown; headers: HeadersInit | undefined }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      upstream.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: init?.headers,
      });
      if (String(url).endsWith("/auth/v1/user")) {
        return Response.json({ id: OWNER });
      }
      return Response.json({
        timezone: "America/Los_Angeles",
        totalResults: 10,
        longestStreak: 3,
        currentStreak: 2,
        daysActive: 9,
        gamesRecorded: 1,
        activityDays: [],
        games: [],
      });
    }));
    const response = await worker.fetch(
      new Request(api + "&userId=" + OTHER, {
        headers: { authorization: "Bearer mock.jwt.token" },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toContain("Authorization");
    const data = (await response.json()) as {
      achievements: { code: string }[];
    };
    expect(data.achievements.map((a) => a.code)).toEqual([
      "first_result",
      "ten_results",
      "three_day_streak",
    ]);
    expect(upstream[1]?.url).toContain("/rpc/my_personal_statistics");
    expect(upstream[1]?.body).toEqual({
      p_user: OWNER,
      p_timezone: "America/Los_Angeles",
    });
    expect(upstream[1]?.headers).toMatchObject({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    expect(JSON.stringify(data)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("fails closed for a malformed upstream response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/auth/v1/user")
        ? Response.json({ id: OWNER })
        : Response.json({ totalResults: "10", games: "bad" }),
    ));
    const response = await worker.fetch(
      new Request(api, { headers: { authorization: "Bearer mock.jwt.token" } }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "result_service_unavailable",
    });
  });
});
