import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import {
  PRIVACY_EXPORT_PATH, PRIVACY_PURGE_CRON,
  projectPrivacyRows,
} from "../shared/privacy";
import type { ResultsEnvironment } from "../worker/results";

const ORIGIN = "https://daydle.example";
const OWNER = "11111111-1111-4111-8111-111111111111";
const RECORD = "f1111111-1111-4111-8111-111111111111";
const env: ResultsEnvironment = {
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing_public",
  SUPABASE_SERVICE_ROLE_KEY: "eyJ_service_role_testing_secret_never_exposed",
};
const make = (path: string, token?: string, method = "GET") =>
  new Request(ORIGIN + path, {
    method,
    headers: token ? { authorization: token } : {},
  });

function mockServices(values: Record<string, unknown>, isValid = true) {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const target = String(input);
    if (target.endsWith("/auth/v1/user"))
      return isValid
        ? Response.json({ id: OWNER })
        : Response.json({}, { status: 401 });
    const method = target.split("/rest/v1/rpc/")[1];
    if (!method) throw new Error("Unexpected fixture upstream");
    calls.push({ method, body: JSON.parse(String(init?.body ?? "{}")) });
    return Response.json(values[method] ?? null);
  }));
  return calls;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Phase 12 private account export", () => {
  it("requires OAuth auth even when a valid export name is supplied", async () => {
    mockServices({});
    const res = await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=profile"), env);
    expect(res.status).toBe(401);
  });

  it("rejects unauthorized user selectors, invalid input and unsupported mutations", async () => {
    const calls = mockServices({});
    for (const path of [
      PRIVACY_EXPORT_PATH + "?dataset=unknown",
      PRIVACY_EXPORT_PATH + "?dataset=raw&limit=21",
      PRIVACY_EXPORT_PATH + "?dataset=profile&cursor=not-a-uuid",
      PRIVACY_EXPORT_PATH + "?dataset=profile&userId=" + OWNER,
      PRIVACY_EXPORT_PATH + "?dataset=profile&dataset=raw",
    ]) expect((await worker.fetch(make(path, "Bearer valid.jwt.token"),env)).status).toBe(422);
    expect((await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=profile",
      "Bearer valid.jwt.token", "DELETE"),env)).status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it("rejects revoked JWT rather than returning an export", async () => {
    const calls = mockServices({}, false);
    const res = await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=raw",
      "Bearer valid.jwt.token"), env);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("derives owner exclusively from verified auth and projects DTO fields", async () => {
    const calls = mockServices({ privacy_export_page: [{
      id: RECORD, display_name: "A", friend_code: "ABCDE",
      raw_share_text: "NOT IN PROFILE", email: "private@invalid.example",
    }] });
    const res = await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=profile",
      "Bearer valid.jwt.token"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("vary")).toContain("Authorization");
    const body = await res.json();
    expect(body).toEqual({ dataset: "profile", items: [{
      id: RECORD, display_name: "A", avatar_url: null,
      created_at: null, updated_at: null, friend_code: "ABCDE",
    }] });
    expect(JSON.stringify(body)).not.toContain("NOT IN PROFILE");
    expect(calls).toEqual([{ method: "privacy_export_page", body: {
      p_user: OWNER, p_dataset: "profile", p_cursor: null, p_limit: 50,
    } }]);
  });

  it("rejects unsorted duplicates and expired raw content", async () => {
    const duplicate = [
      { id: RECORD }, { id: RECORD },
    ];
    expect(projectPrivacyRows("results", duplicate, null)).toBeNull();
    expect(projectPrivacyRows("raw", [{
      id: RECORD, raw_share_text: "Expired", expires_at: "2020-01-01T00:00:00Z",
    }], null)).toBeNull();
    const calls = mockServices({
      privacy_export_page: [{
        id: RECORD, raw_share_text: "Expired", expires_at: "2020-01-01T00:00:00Z",
      }],
    });
    const res = await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=raw",
      "Bearer valid.jwt.token"), env);
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(1);
  });

  it("fails closed without runtime privileged configuration", async () => {
    const calls = mockServices({});
    const res = await worker.fetch(make(PRIVACY_EXPORT_PATH + "?dataset=raw",
      "Bearer valid.jwt.token"), {});
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});

describe("Phase 12 private scheduled retention", () => {
  it("runs only at authorized cron and emits sanitized aggregate count", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const calls = mockServices({ privacy_purge_expired_raw: { deleted: 3 } });
    await expect(worker.scheduled({ cron: PRIVACY_PURGE_CRON },env))
      .resolves.toBeUndefined();
    expect(calls).toEqual([{ method: "privacy_purge_expired_raw", body: {} }]);
    expect(log).toHaveBeenCalledWith("privacy_purge_completed", { deleted: 3 });
  });

  it("does not allow arbitrary cron or missing privileged key", async () => {
    const calls = mockServices({});
    await expect(worker.scheduled({ cron: "* * * * *" },env))
      .rejects.toThrow("unexpected_privacy_schedule");
    await expect(worker.scheduled({ cron: PRIVACY_PURGE_CRON },{}))
      .rejects.toThrow("privacy_purge_configuration_unavailable");
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed purge replies without logging raw values", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const calls = mockServices({ privacy_purge_expired_raw: { deleted: "3",raw: "secret" } });
    await expect(worker.scheduled({ cron: PRIVACY_PURGE_CRON },env))
      .rejects.toThrow("privacy_purge_service_unavailable");
    expect(calls).toHaveLength(1);
    expect(console.info).not.toHaveBeenCalled();
  });
});
