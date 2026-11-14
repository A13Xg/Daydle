import { describe, expect, it } from "vitest";
import { HEALTH_PATH, isHealthResponse } from "../shared/contracts";
import { routeRequest } from "../worker/index";

const url = (path: string) => "https://daydle.example" + path;

describe("Worker HTTP routing", () => {
  it("returns a typed JSON health response without caching", async () => {
    const response = routeRequest(new Request(url(HEALTH_PATH)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(isHealthResponse(await response.json())).toBe(true);
  });

  it("rejects unsupported methods on health with Allow header", async () => {
    const response = routeRequest(
      new Request(url(HEALTH_PATH), { method: "POST" }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });

  it("returns JSON 404 for unknown API paths instead of SPA HTML", async () => {
    for (const path of ["/api/v1/missing", "/api", "/api/"]) {
      const response = routeRequest(new Request(url(path)));
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toMatch(/application\/json/);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });

  it("returns not-found for non-API paths sent directly to Worker", () => {
    expect(routeRequest(new Request(url("/something"))).status).toBe(404);
  });
});
