import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth } from "../src/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health fetch contract", () => {
  it("validates response structure and uses same-origin, no-store requests", async () => {
    const mockFetch = vi.fn(async () =>
      Response.json({ status: "ok", service: "daydle-api", version: "v1" }),
    );
    vi.stubGlobal("fetch", mockFetch);

    expect(await fetchHealth()).toEqual({
      status: "ok",
      service: "daydle-api",
      version: "v1",
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/health", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "ok" })));
    await expect(fetchHealth()).rejects.toThrow("invalid response");
  });

  it("rejects HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(fetchHealth()).rejects.toThrow("HTTP 503");
  });
});
