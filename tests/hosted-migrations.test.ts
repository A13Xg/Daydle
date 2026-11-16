import { describe, expect, it, vi } from "vitest";
import {
  getStructuredMigrationHistory,
  verifyStructuredHistory,
  verifyHostedMigrations,
} from "../scripts/ops/check-hosted-migrations.mjs";

const filenames = [
  "20261114050000_phase2_domain_security.sql",
  "20261114060000_phase3_auth_identity.sql",
  "20261115040000_phase4_catalog.sql",
  "20261115050000_phase5_today_marks.sql",
];
const baseline = [
  { version: "20261114050000", name: "phase2_domain_security" },
  { version: "20261114060000", name: "phase3_auth_identity" },
];
const phase4 = { version: "20261115040000", name: "phase4_catalog" };
const phase5 = { version: "20261115050000", name: "phase5_today_marks" };
const projectRef = "abcdefghijklmnopqrst";
const accessToken = "synthetic-private-test-credential";

function remote(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
}

describe("structured Supabase production migration history", () => {
  it("accepts the actual production baseline recorded by Supabase and identifies only Phase 4/5 pending", () => {
    expect(verifyStructuredHistory(baseline, filenames)).toEqual({
      applied: ["20261114050000", "20261114060000"],
      pending: ["20261115040000", "20261115050000"],
    });
  });

  it("accepts a partially or fully deployed reviewed migration chain", () => {
    expect(verifyStructuredHistory([...baseline, phase4], filenames).pending)
      .toEqual(["20261115050000"]);
    expect(verifyStructuredHistory([...baseline, phase4, phase5], filenames, true))
      .toEqual({
        applied: filenames.map((name) => name.slice(0, 14)),
        pending: [],
      });
  });

  it("rejects missing, unknown, duplicate and out-of-order records", () => {
    const invalid = [
      [],
      [baseline[0]],
      [baseline[1], phase4],
      [...baseline, phase5],
      [...baseline, phase4, phase4],
      [...baseline, { version: "20270101000000", name: "unexpected" }],
      [{ version: "oops", name: "broken" }, ...baseline],
    ];
    for (const rows of invalid) {
      expect(() => verifyStructuredHistory(rows, filenames)).toThrow();
    }
  });

  it("rejects structurally malformed API responses and local file changes", () => {
    expect(() => verifyStructuredHistory({ migrations: baseline }, filenames)).toThrow();
    expect(() => verifyStructuredHistory([null], filenames)).toThrow();
    expect(() => verifyStructuredHistory(baseline, filenames.slice(0, 3))).toThrow();
    expect(() => verifyStructuredHistory(baseline, [
      ...filenames,
      "20270101000000_extra.sql",
    ])).toThrow();
  });

  it("checks remote names when provided, tolerates the documented optional name", () => {
    expect(verifyStructuredHistory(baseline.map(({ version }) => ({ version })), filenames).pending)
      .toHaveLength(2);
    expect(() => verifyStructuredHistory([
      baseline[0],
      { ...baseline[1], name: "wrong_migration" },
    ], filenames)).toThrow(/name differs/);
  });

  it("requires all migrations applied after a successful deploy", () => {
    expect(() => verifyStructuredHistory(baseline, filenames, true)).toThrow(/pending/);
  });

  it("uses an official GET endpoint and never prints or sends credentials in URL", async () => {
    const fetchImpl = remote(baseline);
    const result = await verifyHostedMigrations(
      { projectRef, accessToken, filenames },
      fetchImpl,
    );
    expect(result.pending).toEqual(["20261115040000", "20261115050000"]);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.supabase.com/v1/projects/" + projectRef + "/database/migrations",
    );
    expect(url).not.toContain(accessToken);
    expect(options.method).toBe("GET");
    expect(options.headers.authorization).toBe("Bearer " + accessToken);
  });

  it("fails closed with a scope-specific message on 401 and 403", async () => {
    for (const status of [401, 403]) {
      await expect(getStructuredMigrationHistory(
        projectRef, accessToken, remote(null, status),
      )).rejects.toThrow("database_migrations_read");
    }
  });

  it("fails closed on network error, HTTP error or invalid JSON", async () => {
    const fail = vi.fn().mockRejectedValue(new Error("sensitive network details"));
    await expect(getStructuredMigrationHistory(projectRef, accessToken, fail))
      .rejects.toThrow("request failed");
    await expect(getStructuredMigrationHistory(projectRef, accessToken, remote(null, 502)))
      .rejects.toThrow("HTTP 502");
    await expect(getStructuredMigrationHistory(projectRef, accessToken, vi.fn().mockResolvedValue({
      status: 200,
      json: async () => { throw new Error("bad JSON"); },
    }))).rejects.toThrow("invalid JSON");
  });

  it("does not call the API with invalid credentials or project references", async () => {
    const fetchImpl = vi.fn();
    await expect(getStructuredMigrationHistory("wrong", accessToken, fetchImpl))
      .rejects.toThrow("Missing protected");
    await expect(getStructuredMigrationHistory(projectRef, "", fetchImpl))
      .rejects.toThrow("Missing protected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
