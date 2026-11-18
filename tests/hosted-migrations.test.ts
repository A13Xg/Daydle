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
  "20261117030322_20261117010000_phase7_results.sql",
  "20261117034143_20261117040000_phase8_statistics.sql",
  "20261117051824_20261117050000_phase9_social.sql",
  "20261117075359_phase10_comparisons.sql",
  "20261118013515_phase11_administration.sql",
  "20261118013526_phase12_privacy.sql",
  "20261118234500_phase15_parser_coverage.sql",
];
const baseline = [
  { version: "20261114050000", name: "phase2_domain_security" },
  { version: "20261114060000", name: "phase3_auth_identity" },
];
const phase4 = { version: "20261115040000", name: "phase4_catalog" };
const phase5 = { version: "20261115050000", name: "phase5_today_marks" };
const phase7 = {
  version: "20261117030322",
  name: "20261117010000_phase7_results",
};
const phase8 = {
  version: "20261117034143",
  name: "20261117040000_phase8_statistics",
};
const phase9 = {
  version: "20261117051824",
  name: "20261117050000_phase9_social",
};
const phase10 = {
  version: "20261117075359",
  name: "phase10_comparisons",
};
const phase11 = {
  version: "20261118013515",
  name: "phase11_administration",
};
const phase12 = { version: "20261118013526", name: "phase12_privacy" };
const phase15 = { version: "20261118234500", name: "phase15_parser_coverage" };
const projectRef = "abcdefghijklmnopqrst";
const accessToken = "synthetic-private-test-credential";

function remote(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
}

describe("structured Supabase production migration history", () => {
  it("recognizes the hosted baseline and pending Phase 4/5/7/8/9/10/11", () => {
    expect(verifyStructuredHistory(baseline, filenames)).toEqual({
      applied: ["20261114050000", "20261114060000"],
      pending: [
        "20261115040000",
        "20261115050000",
        "20261117030322",
        "20261117034143",
        "20261117051824",
        "20261117075359",
        "20261118013515",
        "20261118013526",
      "20261118234500",
      ],
    });
  });

  it("accepts a partially or fully deployed reviewed migration chain", () => {
    expect(
      verifyStructuredHistory([...baseline, phase4], filenames).pending,
    ).toEqual([
      "20261115050000",
      "20261117030322",
      "20261117034143",
      "20261117051824",
      "20261117075359",
      "20261118013515",
      "20261118013526",
      "20261118234500",
    ]);
    expect(
      verifyStructuredHistory(
        [
          ...baseline,
          phase4,
          phase5,
          phase7,
          phase8,
          phase9,
          phase10,
          phase11,
          phase12,
          phase15,
        ],
        filenames,
        true,
      ),
    ).toEqual({
      applied: filenames.map((name) => name.slice(0, 14)),
      pending: [],
    });
  });

  it("requires the exact recorded hosted Phase 10 version and name", () => {
    const full = [
      ...baseline,
      phase4,
      phase5,
      phase7,
      phase8,
      phase9,
      phase10,
      phase11,
      phase12,
      phase15,
    ];
    expect(verifyStructuredHistory(full, filenames, true)).toEqual({
      applied: filenames.map((name) => name.slice(0, 14)),
      pending: [],
    });
    const inventedVersion = [
      ...full.slice(0, -4),
      { ...phase10, version: "20261117060000" },
      phase11,
      phase12,
      phase15,
    ];
    expect(() =>
      verifyStructuredHistory(inventedVersion, filenames, true),
    ).toThrow();
  });

  it("rejects missing, unknown, duplicate and out-of-order records", () => {
    const mismatchedPhase10 = { ...phase10, name: "wrong" };
    const invalid = [
      [],
      [baseline[0]],
      [baseline[1], phase4],
      [...baseline, phase5],
      [...baseline, phase4, phase4],
      [...baseline, phase4, phase5, phase8],
      [...baseline, phase4, phase5, phase7, phase9],
      [...baseline, phase4, phase5, phase7, phase8, phase10],
      [...baseline, phase4, phase5, phase7, phase8, phase9, mismatchedPhase10],
      [
        ...baseline,
        phase4,
        phase5,
        { version: "20261117010000", name: phase7.name },
      ],
      [...baseline, { version: "20270101000000", name: "unexpected" }],
      [{ version: "oops", name: "broken" }, ...baseline],
    ];
    for (const rows of invalid) {
      expect(() => verifyStructuredHistory(rows, filenames)).toThrow();
    }
  });

  it("rejects structurally malformed API responses and local file changes", () => {
    expect(() =>
      verifyStructuredHistory({ migrations: baseline }, filenames),
    ).toThrow();
    expect(() => verifyStructuredHistory([null], filenames)).toThrow();
    expect(() =>
      verifyStructuredHistory(baseline, filenames.slice(0, 3)),
    ).toThrow();
    expect(() =>
      verifyStructuredHistory(baseline, [
        ...filenames,
        "20270101000000_extra.sql",
      ]),
    ).toThrow();
  });

  it("checks remote names when provided, tolerates the documented optional name", () => {
    expect(
      verifyStructuredHistory(
        baseline.map(({ version }) => ({ version })),
        filenames,
      ).pending,
    ).toHaveLength(9);
    expect(() =>
      verifyStructuredHistory(
        [baseline[0], { ...baseline[1], name: "wrong_migration" }],
        filenames,
      ),
    ).toThrow(/name differs/);
  });

  it("requires all migrations applied after a successful deploy", () => {
    expect(() => verifyStructuredHistory(baseline, filenames, true)).toThrow(
      /pending/,
    );
  });

  it("uses an official GET endpoint and never prints or sends credentials in URL", async () => {
    const fetchImpl = remote(baseline);
    const result = await verifyHostedMigrations(
      { projectRef, accessToken, filenames },
      fetchImpl,
    );
    expect(result.pending).toEqual([
      "20261115040000",
      "20261115050000",
      "20261117030322",
      "20261117034143",
      "20261117051824",
      "20261117075359",
      "20261118013515",
      "20261118013526",
      "20261118234500",
    ]);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.supabase.com/v1/projects/" +
        projectRef +
        "/database/migrations",
    );
    expect(url).not.toContain(accessToken);
    expect(options.method).toBe("GET");
    expect(options.headers.authorization).toBe("Bearer " + accessToken);
  });

  it("fails closed with a scope-specific message on 401 and 403", async () => {
    for (const status of [401, 403]) {
      await expect(
        getStructuredMigrationHistory(
          projectRef,
          accessToken,
          remote(null, status),
        ),
      ).rejects.toThrow("database_migrations_read");
    }
  });

  it("fails closed on network error, HTTP error or invalid JSON", async () => {
    const fail = vi
      .fn()
      .mockRejectedValue(new Error("sensitive network details"));
    await expect(
      getStructuredMigrationHistory(projectRef, accessToken, fail),
    ).rejects.toThrow("request failed");
    await expect(
      getStructuredMigrationHistory(projectRef, accessToken, remote(null, 502)),
    ).rejects.toThrow("HTTP 502");
    await expect(
      getStructuredMigrationHistory(
        projectRef,
        accessToken,
        vi.fn().mockResolvedValue({
          status: 200,
          json: async () => {
            throw new Error("bad JSON");
          },
        }),
      ),
    ).rejects.toThrow("invalid JSON");
  });

  it("does not call the API with invalid credentials or project references", async () => {
    const fetchImpl = vi.fn();
    await expect(
      getStructuredMigrationHistory("wrong", accessToken, fetchImpl),
    ).rejects.toThrow("Missing protected");
    await expect(
      getStructuredMigrationHistory(projectRef, "", fetchImpl),
    ).rejects.toThrow("Missing protected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
