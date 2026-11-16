import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const EXPECTED_MIGRATIONS = Object.freeze([
  "20261114050000",
  "20261114060000",
  "20261115040000",
  "20261115050000",
]);

/** Fail closed if the linked database or checked-in migration set diverges. */
export function verifyMigrationPlan(report, filenames, requireAllApplied = false) {
  const local = filenames.filter((name) => name.endsWith(".sql")).sort();
  if (local.length !== EXPECTED_MIGRATIONS.length ||
      local.some((name, i) => !name.startsWith(EXPECTED_MIGRATIONS[i] + "_"))) {
    throw new Error("Unexpected checked-in migration set. Release aborted.");
  }

  const seen = new Map();
  for (const line of report.split(/\r?\n/)) {
    const fields = line.split(/[│|]/).map((field) => field.trim());
    if (fields.length < 3) continue;
    const [localVersion, remoteVersion] = fields;
    const validLocal = /^\d{14}$/.test(localVersion);
    const validRemote = /^\d{14}$/.test(remoteVersion);
    if (!validLocal && !validRemote) continue;
    const version = validLocal ? localVersion : remoteVersion;
    if (!EXPECTED_MIGRATIONS.includes(version) ||
        (validLocal && validRemote && localVersion !== remoteVersion) ||
        seen.has(version)) {
      throw new Error("Unexpected or inconsistent remote migration history. Release aborted.");
    }
    seen.set(version, { local: validLocal, applied: validRemote });
  }

  if (seen.size !== EXPECTED_MIGRATIONS.length ||
      EXPECTED_MIGRATIONS.some((v) => !seen.get(v)?.local) ||
      EXPECTED_MIGRATIONS.slice(0, 2).some((v) => !seen.get(v)?.applied) ||
      (seen.get(EXPECTED_MIGRATIONS[3])?.applied &&
       !seen.get(EXPECTED_MIGRATIONS[2])?.applied)) {
    throw new Error("Production Phase 2/3 baseline is missing or migration history diverged.");
  }
  const pending = EXPECTED_MIGRATIONS.filter((v) => !seen.get(v).applied);
  if (requireAllApplied && pending.length) {
    throw new Error("Production migration history still has pending versions.");
  }
  return pending;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invoked === import.meta.url) {
  try {
    if (!process.argv[2]) throw new Error("Migration history file is required.");
    const pending = verifyMigrationPlan(
      readFileSync(process.argv[2], "utf8"),
      readdirSync("supabase/migrations"),
      process.argv.includes("--require-all-applied"),
    );
    console.log("Reviewed pending migrations:", pending.join(", ") || "(none)");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration verification failed");
    process.exitCode = 1;
  }
}
