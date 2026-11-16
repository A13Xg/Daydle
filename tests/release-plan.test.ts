import { describe, expect, it } from "vitest";
import {
  EXPECTED_MIGRATIONS,
  verifyMigrationPlan,
} from "../scripts/ops/verify-migration-plan.mjs";

const files = EXPECTED_MIGRATIONS.map((v) => v + "_migration.sql");
function migrationList(applied: string[]) {
  return [
    "LOCAL             │ REMOTE            │ TIME (UTC)",
    "──────────────────┼───────────────────┼────────────────────",
    ...EXPECTED_MIGRATIONS.map(
      (v) => v + " │ " + (applied.includes(v) ? v : "              ") + " │ 2026-11-15",
    ),
  ].join("\n");
}

describe("production migration preflight is fail-closed", () => {
  it("only permits unapplied Phase 4 and 5 after the deployed baseline", () => {
    expect(verifyMigrationPlan(migrationList(EXPECTED_MIGRATIONS.slice(0, 2)), files))
      .toEqual(EXPECTED_MIGRATIONS.slice(2));
    expect(verifyMigrationPlan(migrationList(EXPECTED_MIGRATIONS.slice(0, 3)), files))
      .toEqual(EXPECTED_MIGRATIONS.slice(3));
  });
  it("accepts an already fully migrated database without reapplying SQL", () => {
    expect(verifyMigrationPlan(migrationList([...EXPECTED_MIGRATIONS]), files, true))
      .toEqual([]);
  });
  it("rejects missing baseline, out-of-order changes and unknown remote migrations", () => {
    expect(() => verifyMigrationPlan(migrationList(EXPECTED_MIGRATIONS.slice(1)), files)).toThrow();
    expect(() => verifyMigrationPlan(migrationList([
      EXPECTED_MIGRATIONS[0], EXPECTED_MIGRATIONS[1], EXPECTED_MIGRATIONS[3],
    ]), files)).toThrow();
    expect(() => verifyMigrationPlan(
      migrationList(EXPECTED_MIGRATIONS) +
        "\n20271212000000 │ 20271212000000 │ unexpected",
      files,
    )).toThrow();
  });
  it("rejects unmatched local migrations and unparseable remote history", () => {
    expect(() => verifyMigrationPlan(
      migrationList(EXPECTED_MIGRATIONS),
      [...files, "20270101000000_extra.sql"],
    )).toThrow();
    expect(() => verifyMigrationPlan("", files)).toThrow();
  });
  it("requires all reviewed migrations after the push before deploying", () => {
    expect(() => verifyMigrationPlan(
      migrationList(EXPECTED_MIGRATIONS.slice(0, 3)), files, true,
    )).toThrow();
  });
});
