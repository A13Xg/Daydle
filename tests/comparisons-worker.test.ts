import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { ResultsEnvironment } from "../worker/results";
import {
  COMPARISON_PATH,
  formatComparisonMetric,
  validComparisonBoard,
  validPublicPerformance,
  validHeadToHead,
} from "../shared/comparisons";

const ORIGIN = "https://daydle.example";
const OWNER = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const RESULT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://sample.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_public",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_service_role_testing_secret_never_exposed",
};
const boardPath =
  COMPARISON_PATH +
  "/board?game=wordle&puzzle=wordle%3Anumber%3A1406&scope=global&limit=20&offset=0";
const locked = {
  status: "locked",
  gameSlug: "wordle",
  gameName: "Wordle",
  puzzleKey: "wordle:number:1406",
  puzzleDate: null,
};
const board = {
  status: "ready",
  gameSlug: "wordle",
  gameName: "Wordle",
  puzzleKey: "wordle:number:1406",
  puzzleDate: null,
  released: false,
  metricLabel: "Attempts",
  scope: "global",
  totalVisible: 2,
  rankedCount: 2,
  items: [
    {
      resultId: RESULT,
      userId: OWNER,
      displayName: "One",
      outcome: "win",
      metricValue: 3,
      rank: 1,
    },
    {
      resultId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: PEER,
      displayName: "Two",
      outcome: "win",
      metricValue: 4,
      rank: 2,
    },
  ],
};
const performance = {
  status: "ready",
  profileId: PEER,
  visibleResults: 1,
  visibleWins: 1,
  games: [
    {
      slug: "wordle",
      name: "Wordle",
      visibleResults: 1,
      completed: 1,
      bestMetric: 3,
    },
  ],
};
const detail = {
  resultId: RESULT,
  userId: OWNER,
  displayName: "One",
  gameSlug: "wordle",
  gameName: "Wordle",
  puzzleKey: "wordle:number:1406",
  puzzleDate: null,
  outcome: "win",
  metricLabel: "Attempts",
  metricValue: 3,
};
const history = {
  status: "ready",
  leftUserId: OWNER,
  rightUserId: PEER,
  leftName: "One",
  rightName: "Two",
  totalVisible: 1,
  items: [
    {
      gameSlug: "wordle",
      gameName: "Wordle",
      puzzleKey: "wordle:number:1406",
      puzzleDate: null,
      leftOutcome: "win",
      rightOutcome: "win",
      leftMetric: 3,
      rightMetric: 4,
      winner: "left",
    },
  ],
};
const puzzleList = {
  status: "ready",
  gameSlug: "wordle",
  gameName: "Wordle",
  items: [
    { puzzleKey: "wordle:number:1406", puzzleDate: null, released: false },
  ],
};
const path = (suffix: string) => ORIGIN + COMPARISON_PATH + suffix;
function req(url: string, token?: string) {
  return new Request(url, {
    headers: token ? { authorization: token } : undefined,
  });
}
function mockRpc(value: unknown, { tokenFailure = false } = {}) {
  const calls: {
    url: string;
    args: Record<string, unknown> | null;
    init?: RequestInit;
  }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const address = String(url);
      calls.push({
        url: address,
        args: init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : null,
        init,
      });
      if (address.endsWith("/auth/v1/user"))
        return tokenFailure
          ? Response.json({ message: "Unauthorized" }, { status: 401 })
          : Response.json({ id: OWNER });
      if (address.includes("/rest/v1/rpc/")) return Response.json(value);
      throw new Error("Unexpected upstream");
    }),
  );
  return calls;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("viewer-specific comparison Worker security", () => {
  it("keeps anonymous current puzzle locked without score/count or cached response", async () => {
    const calls = mockRpc({ ...locked, secretCount: 900, items: board.items });
    const response = await worker.fetch(req(ORIGIN + boardPath), env);
    // The request URL above is intentionally a valid same-origin API path.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(locked);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toContain("Authorization");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toMatch(/\/rpc\/comparison_board$/);
    expect(calls[0]?.args).toMatchObject({
      p_viewer: null,
      p_game_slug: "wordle",
      p_puzzle_key: "wordle:number:1406",
      p_scope: "global",
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("uses Supabase-verified bearer rather than query owner for same-puzzle unlock", async () => {
    const calls = mockRpc({ ...board, raw_share_text: "PRIVATE" });
    const url = ORIGIN + boardPath + "&viewer=" + PEER;
    const result = await worker.fetch(req(url, "Bearer valid.jwt.token"), env);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(board);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args?.p_viewer).toBe(OWNER);
    expect(calls[1]?.init?.headers).toMatchObject({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  });

  it("requires authentication for a friend-filtered board", async () => {
    const calls = mockRpc(board);
    const response = await worker.fetch(
      req(
        path("/board?game=wordle&puzzle=wordle%3Anumber%3A1406&scope=friends"),
      ),
      env,
    );
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
    await worker.fetch(
      req(
        path("/board?game=wordle&puzzle=wordle%3Anumber%3A1406&scope=friends"),
        "Bearer valid.jwt.token",
      ),
      env,
    );
    expect(calls.at(-1)?.args).toMatchObject({
      p_scope: "friends",
      p_viewer: OWNER,
    });
  });

  it("does not convert an invalid bearer to anonymous", async () => {
    const calls = mockRpc(locked, { tokenFailure: true });
    const response = await worker.fetch(
      req(
        path("/board?game=wordle&puzzle=wordle%3Anumber%3A1406"),
        "Bearer invalid.jwt.token",
      ),
      env,
    );
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toMatch(/\/auth\/v1\/user$/);
  });

  it("refuses absent service-role configuration even for a public read", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const response = await worker.fetch(req(path("/puzzles?game=wordle")), {});
    expect(response.status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects invalid filters, pagination, paths and non-GET methods before DB", async () => {
    const calls = mockRpc(board);
    const invalid = [
      "/board?game=x%20x&puzzle=wordle",
      "/board?game=wordle",
      "/board?game=wordle&puzzle=x&scope=private",
      "/board?game=wordle&puzzle=x&limit=200",
      "/board?game=wordle&puzzle=x&offset=6000",
      "/head-to-head?left=bad&right=" + PEER,
      "/profile/not-a-uuid",
      "/result/not-a-uuid",
      "/does-not-exist",
    ];
    for (const item of invalid) {
      const response = await worker.fetch(req(path(item)), env);
      expect([400, 404]).toContain(response.status);
    }
    expect(
      (
        await worker.fetch(
          new Request(path("/puzzles?game=wordle"), { method: "POST" }),
          env,
        )
      ).status,
    ).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it("public puzzle metadata never contains player activity from unexpected RPC fields", async () => {
    mockRpc({ ...puzzleList, playerCount: 5, email: "PRIVATE" });
    const response = await worker.fetch(req(path("/puzzles?game=wordle")), env);
    expect(await response.json()).toEqual(puzzleList);
  });

  it("returns 404 for missing or still-locked direct result, never a result existence bit", async () => {
    mockRpc(null);
    const res = await worker.fetch(req(path("/result/" + RESULT)), env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("projects only allowed public result data", async () => {
    const calls = mockRpc({
      ...detail,
      raw_share_text: "SECRET",
      email: "person@example.invalid",
    });
    const res = await worker.fetch(
      req(path("/result/" + RESULT), "Bearer test.jwt.token"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(detail);
    expect(calls[1]?.args).toEqual({ p_result: RESULT, p_viewer: OWNER });
  });

  it("public profile summary contains no hidden derived counters or private fields", async () => {
    const calls = mockRpc({
      ...performance,
      totalAllTime: 500,
      raw_share_text: "SECRET",
    });
    const res = await worker.fetch(req(path("/profile/" + PEER)), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(performance);
    expect(calls[0]?.args).toEqual({ p_profile: PEER, p_viewer: null });
  });

  it("filters head-to-head by both users, not by friendship entitlement", async () => {
    const calls = mockRpc({ ...history, hiddenPuzzles: 42, email: "PRIVATE" });
    const res = await worker.fetch(
      req(
        path(
          "/head-to-head?left=" +
            OWNER +
            "&right=" +
            PEER +
            "&game=wordle&limit=5",
        ),
        "Bearer valid.jwt.token",
      ),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(history);
    expect(calls[1]?.args).toMatchObject({
      p_viewer: OWNER,
      p_left: OWNER,
      p_right: PEER,
      p_game_slug: "wordle",
      p_limit: 5,
      p_offset: 0,
    });
  });

  it("fails closed on malformed DTO rather than forwarding sensitive SQL records", async () => {
    mockRpc({
      ...board,
      items: [{ ...board.items[0], metricValue: "not numeric" }],
    });
    const result = await worker.fetch(
      req(path("/board?game=wordle&puzzle=wordle%3Anumber%3A1406")),
      env,
    );
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({
      error: "comparison_service_unavailable",
    });
  });

  it("validates rank/metric contracts and never invents cross-game points", () => {
    expect(validComparisonBoard(board)).toBe(true);
    expect(validComparisonBoard({ ...board, rankedCount: 3 })).toBe(false);
    expect(validPublicPerformance(performance)).toBe(true);
    expect(validHeadToHead(history)).toBe(true);
    expect(formatComparisonMetric(null, "quordle")).toBe("Unranked");
    expect(formatComparisonMetric(69000, "mini-crossword")).toBe("1:09");
    expect(formatComparisonMetric(3, "wordle")).toBe("3");
  });
});
