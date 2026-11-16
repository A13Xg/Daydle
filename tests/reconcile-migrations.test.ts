import { describe, expect, it, vi } from "vitest";
import {
  BASELINE_PROBE_SQL,
  queryBaseline,
  reconcileBaseline,
  verifiedRepairs,
} from "../scripts/ops/reconcile-migration-history.mjs";
import {
  EXPECTED_MIGRATIONS,
  inspectMigrationPlan,
} from "../scripts/ops/verify-migration-plan.mjs";

const filenames = EXPECTED_MIGRATIONS.map((version) => version + "_test.sql");
const projectRef = "abcdefghijklmnopqrst";
const accessToken = "synthetic-do-not-log";

function report(remoteVersions: string[]) {
  return [
    "         LOCAL      │     REMOTE     │     TIME (UTC)",
    "────────────────────┼────────────────┼─────────────────────",
    ...EXPECTED_MIGRATIONS.map(
      (v) =>
        `    ${v} │ ${remoteVersions.includes(v) ? v : "              "} │ 2026-11-15`,
    ),
  ].join("\n");
}

const goodProbe = {
  phase2_tables_rls: true,
  phase2_policies: true,
  phase2_functions: true,
  phase3_column: true,
  phase3_functions: true,
  phase3_trigger: true,
  phase4_present: false,
  phase5_present: false,
};

function fakeRemote(probe = goodProbe, code = 201) {
  return vi.fn().mockResolvedValue({
    status: code,
    json: async () => [probe],
  });
}

describe("read-only production baseline reconciliation", () => {
  it("parses the documented CLI table and reports version-only state", () => {
    const state = inspectMigrationPlan(
      report(EXPECTED_MIGRATIONS.slice(0, 2)),
      filenames,
    );
    expect(state).toEqual({
      applied: EXPECTED_MIGRATIONS.slice(0, 2),
      pending: EXPECTED_MIGRATIONS.slice(2),
      missingBaseline: [],
    });
  });

  it("rejects unknown version rows and an out-of-order remote history", () => {
    expect(() =>
      inspectMigrationPlan(
        report(EXPECTED_MIGRATIONS.slice(0, 2)) +
          "\n 20271116000000 │ 20271116000000 │ unexpected",
        filenames,
      ),
    ).toThrow(/Unknown/);
    expect(() =>
      inspectMigrationPlan(
        report([EXPECTED_MIGRATIONS[0], EXPECTED_MIGRATIONS[3]]),
        filenames,
      ),
    ).toThrow(/out of sequence/);
  });

  it("runs a read-only Management API query without logging credentials", async () => {
    const fetchImpl = fakeRemote();
    await expect(
      queryBaseline(projectRef, accessToken, fetchImpl),
    ).resolves.toEqual(goodProbe);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain("/database/query/read-only");
    expect(options.method).toBe("POST");
    expect(options.headers.authorization).toBe("Bearer " + accessToken);
    expect(JSON.parse(options.body)).toEqual({ query: BASELINE_PROBE_SQL });
    expect(BASELINE_PROBE_SQL).not.toMatch(/DELETE\s|UPDATE\s|INSERT\s/i);
    expect(BASELINE_PROBE_SQL).toContain("pg_catalog.pg_trigger");
  });

  it("records exactly missing baseline entries after all remote signatures pass", async () => {
    const repair = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = fakeRemote();
    const log = vi.fn();

    const result = await reconcileBaseline(report([]), filenames, {
      projectRef,
      accessToken,
      repair,
      fetchImpl,
      log,
    });

    expect(result).toEqual(EXPECTED_MIGRATIONS.slice(0, 2));
    expect(repair.mock.calls.map((args) => args[0])).toEqual(
      EXPECTED_MIGRATIONS.slice(0, 2),
    );
    expect(log.mock.calls.flat().join(" ")).not.toContain(accessToken);
    expect(log.mock.calls.flat().join(" ")).toContain(
      "Read-only Phase 2/3 baseline verification: PASS",
    );
  });

  it("never repairs tracking if a required RLS policy or trigger is missing", async () => {
    const repair = vi.fn();
    const badProbe = { ...goodProbe, phase3_trigger: false };
    const fetchImpl = fakeRemote(badProbe);

    await expect(
      reconcileBaseline(report([]), filenames, {
        projectRef,
        accessToken,
        fetchImpl,
        repair,
      }),
    ).rejects.toThrow("schema signatures");
    expect(repair).not.toHaveBeenCalled();
  });

  it("never reclassifies an untracked Phase 4 or 5 schema", () => {
    const state = inspectMigrationPlan(report([]), filenames);
    expect(() =>
      verifiedRepairs(state, { ...goodProbe, phase4_present: true }),
    ).toThrow("untracked");
    expect(() =>
      verifiedRepairs(state, { ...goodProbe, phase5_present: true }),
    ).toThrow("untracked");
  });

  it("fails closed if read-only API permission or response is unavailable", async () => {
    const repair = vi.fn();
    await expect(
      reconcileBaseline(report([]), filenames, {
        projectRef,
        accessToken,
        repair,
        fetchImpl: fakeRemote(goodProbe, 403),
      }),
    ).rejects.toThrow("HTTP 403");
    expect(repair).not.toHaveBeenCalled();
  });

  it("does not need API access or repair when baseline history is already correct", async () => {
    const repair = vi.fn();
    const fetchImpl = vi.fn();

    await expect(
      reconcileBaseline(report(EXPECTED_MIGRATIONS.slice(0, 2)), filenames, {
        projectRef,
        accessToken,
        fetchImpl,
        repair,
      }),
    ).resolves.toEqual([]);
    expect(repair).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("halts if a history metadata repair fails, without applying SQL", async () => {
    const repair = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(
      reconcileBaseline(report([]), filenames, {
        projectRef,
        accessToken,
        fetchImpl: fakeRemote(),
        repair,
      }),
    ).rejects.toThrow("metadata repair failed");
    expect(repair).toHaveBeenCalledTimes(1);
  });
});
