import { describe, expect, it, vi } from "vitest";
import {
  BETA_ORIGIN,
  runPublicBetaPreflight,
} from "../scripts/ops/beta-preflight.mjs";

function publicFixture(url: string) {
  const path = new URL(url).pathname;
  if (path === "/api/v1/health")
    return Response.json({
      service: "daydle-api",
      status: "ok",
      version: "v1",
    });
  if (path === "/api/v1/not-found")
    return Response.json({ error: "not_found" }, { status: 404 });
  if (path === "/api/v1/admin" || path === "/api/v1/privacy/export")
    return Response.json(
      { error: "authentication_required" },
      {
        status: 401,
        headers: { "cache-control": "private, no-store" },
      },
    );
  if (path === "/api/v1/requests")
    return Response.json(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Game",
          status: "pending",
        },
      ],
      {
        headers: {
          "cache-control": "private, no-store",
          vary: "Authorization",
        },
      },
    );
  if (path === "/privacy")
    return new Response("<!DOCTYPE html><html><title>Daydle</title></html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  throw Error("unexpected public test route");
}

describe("Phase 14 public beta preflight", () => {
  it("uses credential-free GET only and checks every release boundary", async () => {
    const fetchImpl = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toMatch(/^https:\/\/daydle\.agoodman\.io\//);
      expect(options.method).toBe("GET");
      expect(options.redirect).toBe("manual");
      expect(options.cache).toBe("no-store");
      expect(options.headers).toEqual({ "cache-control": "no-cache" });
      expect(JSON.stringify(options)).not.toContain("authorization");
      expect(JSON.stringify(options)).not.toContain("apikey");
      return publicFixture(url);
    });
    const result = await runPublicBetaPreflight({ fetchImpl });
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(6);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("fails closed when a supposedly private endpoint leaks data", async () => {
    const result = await runPublicBetaPreflight({
      fetchImpl: async (url: string) =>
        new URL(url).pathname === "/api/v1/admin"
          ? Response.json({ secret: "must not appear" })
          : publicFixture(url),
    });
    expect(result.passed).toBe(false);
    expect(
      result.checks.find(
        (row: { type: string; path: string }) => row.path === "/api/v1/admin",
      )?.passed,
    ).toBe(false);
    expect(JSON.stringify(result)).not.toContain("must not appear");
  });

  it("rejects guest responses with private fields or cacheable headers", async () => {
    const result = await runPublicBetaPreflight({
      fetchImpl: async (url: string) =>
        new URL(url).pathname === "/api/v1/requests"
          ? Response.json([
              {
                id: "11111111-1111-4111-8111-111111111111",
                name: "Game",
                status: "pending",
                raw_share_text: "PRIVATE_LEAK_CANARY_987",
              },
            ])
          : publicFixture(url),
    });
    expect(result.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_LEAK_CANARY_987");
  });

  it("preserves failures when a route cannot be reached", async () => {
    const result = await runPublicBetaPreflight({
      fetchImpl: async (url: string) => {
        if (new URL(url).pathname === "/privacy")
          throw new Error("sensitive upstream transport detail");
        return publicFixture(url);
      },
    });
    expect(result.passed).toBe(false);
    expect(result.checks.at(-1)?.passed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("refuses unsafe or non-HTTPS destinations", async () => {
    for (const base of [
      "http://daydle.agoodman.io",
      "https://user:password@daydle.agoodman.io",
      "https://daydle.agoodman.io/private",
      "https://daydle.agoodman.io/?token=secret",
    ]) {
      await expect(
        runPublicBetaPreflight({ base, fetchImpl: vi.fn() }),
      ).rejects.toThrow();
    }
    expect(BETA_ORIGIN).toBe("https://daydle.agoodman.io");
  });
});
