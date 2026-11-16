import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const EXPECTED_MIGRATIONS = Object.freeze([
  "20261114050000",
  "20261114060000",
  "20261115040000",
  "20261115050000",
]);

const BASELINE = EXPECTED_MIGRATIONS.slice(0, 2);

/**
 * Inspect only version identifiers. Never report database names, SQL,
 * credentials, or arbitrary migration-list output from production.
 */
export function inspectMigrationPlan(report, filenames) {
  const local = filenames.filter((name) => name.endsWith(".sql")).sort();
  if (
    local.length !== EXPECTED_MIGRATIONS.length ||
    local.some((name, i) => !name.startsWith(EXPECTED_MIGRATIONS[i] + "_"))
  ) {
    throw new Error("Unexpected checked-in migration files. Release aborted.");
  }

  if (typeof report !== "string" || !report.trim()) {
    throw new Error("Missing or unreadable migration report. Release aborted.");
  }

  const seen = new Map();
  for (const line of report.split(/\r?\n/)) {
    const fields = line.split(/[│|]/).map((field) => field.trim());
    if (fields.length < 3) continue;

    const [localVersion, remoteVersion] = fields;
    const hasLocal = /^\d{14}$/.test(localVersion);
    const hasRemote = /^\d{14}$/.test(remoteVersion);
    if (!hasLocal && !hasRemote) continue;

    const version = hasLocal ? localVersion : remoteVersion;
    if (
      !EXPECTED_MIGRATIONS.includes(version) ||
      (hasLocal && hasRemote && localVersion !== remoteVersion) ||
      seen.has(version)
    ) {
      throw new Error(
        "Unknown, duplicate, or inconsistent migration version in remote history. " +
          "No schema or history changes were made.",
      );
    }

    seen.set(version, { local: hasLocal, applied: hasRemote });
  }

  if (
    seen.size !== EXPECTED_MIGRATIONS.length ||
    EXPECTED_MIGRATIONS.some((version) => !seen.get(version)?.local)
  ) {
    throw new Error(
      "Migration report did not contain exactly four expected local versions. " +
        "Refusing to infer remote state.",
    );
  }

  const applied = EXPECTED_MIGRATIONS.filter((v) => seen.get(v).applied);
  const missingBaseline = BASELINE.filter((v) => !seen.get(v).applied);
  const pending = EXPECTED_MIGRATIONS.filter((v) => !seen.get(v).applied);
  if (
    (seen.get(EXPECTED_MIGRATIONS[3]).applied &&
      !seen.get(EXPECTED_MIGRATIONS[2]).applied) ||
    (seen.get(EXPECTED_MIGRATIONS[2]).applied && missingBaseline.length > 0)
  ) {
    throw new Error(
      "Production migration history is out of sequence; manual investigation required.",
    );
  }

  return { applied, pending, missingBaseline };
}

export function verifyMigrationPlan(report, filenames, requireAllApplied = false) {
  const status = inspectMigrationPlan(report, filenames);
  if (status.missingBaseline.length) {
    throw new Error(
      "Phase 2/3 migration history is missing versions: " +
        status.missingBaseline.join(", ") +
        ". Run read-only schema verification before any history repair.",
    );
  }
  if (requireAllApplied && status.pending.length) {
    throw new Error(
      "Production migration history still has pending versions: " +
        status.pending.join(", "),
    );
  }
  return status.pending;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invoked === import.meta.url) {
  try {
    if (!process.argv[2]) throw new Error("Migration report file is required.");
    const report = readFileSync(process.argv[2], "utf8");
    const files = readdirSync("supabase/migrations");
    const state = inspectMigrationPlan(report, files);
    console.log("Recorded remote versions:", state.applied.join(", ") || "(none)");
    console.log("Pending reviewed versions:", state.pending.join(", ") || "(none)");
    console.log(
      "Missing Phase 2/3 tracking:",
      state.missingBaseline.join(", ") || "(none)",
    );
    verifyMigrationPlan(
      report,
      files,
      process.argv.includes("--require-all-applied"),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration verification failed.");
    process.exitCode = 1;
  }
}
