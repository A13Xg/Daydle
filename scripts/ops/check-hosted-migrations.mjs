import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
/** Exact hosted migration versions and names, including generated Phase 7/8/9/10 and proposed Phase 11 IDs. */
export const HOSTED_MIGRATIONS = Object.freeze([
  { version: "20261114050000", name: "phase2_domain_security" },
  { version: "20261114060000", name: "phase3_auth_identity" },
  { version: "20261115040000", name: "phase4_catalog" },
  { version: "20261115050000", name: "phase5_today_marks" },
  { version: "20261117030322", name: "20261117010000_phase7_results" },
  { version: "20261117034143", name: "20261117040000_phase8_statistics" },
  { version: "20261117051824", name: "20261117050000_phase9_social" },
  { version: "20261117075359", name: "phase10_comparisons" },
  { version: "20261117090000", name: "phase11_administration" },
]);

const EXPECTED_MIGRATIONS = HOSTED_MIGRATIONS.map(({ version }) => version);

const VERSION = /^\d{14}$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;

/**
 * Validate *local files* and the Supabase Management API's structured array.
 * Never parse console-drawn tables, rely on stdout formatting or infer a
 * missing migration from unparseable output.
 */
export function verifyStructuredHistory(
  records,
  filenames,
  requireAllApplied = false,
) {
  const files = filenames.filter((name) => name.endsWith(".sql")).sort();
  const names = HOSTED_MIGRATIONS.map(({ version, name }, index) => {
    const filename = files[index];
    if (
      filename !== version + "_" + name + ".sql" ||
      !/^\d{14}_[a-z0-9_]+\.sql$/.test(filename)
    ) {
      throw new Error("Local migration filenames differ from the reviewed hosted version/name allowlist.");
    }
    return name;
  });
  if (files.length !== HOSTED_MIGRATIONS.length) {
    throw new Error("Unreviewed local migration files found. No release authorized.");
  }
  if (!Array.isArray(records)) {
    throw new Error(
      "Migration API returned a non-array response; refusing to infer history.",
    );
  }

  const seen = new Map();
  for (const item of records) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      typeof item.version !== "string" ||
      !VERSION.test(item.version)
    ) {
      throw new Error("Migration API returned an invalid version record.");
    }
    const position = EXPECTED_MIGRATIONS.indexOf(item.version);
    if (position < 0 || seen.has(item.version)) {
      throw new Error("Unexpected or duplicate remote migration version.");
    }
    // The Management API includes a name, but treats it as optional in the
    // documented schema. When present, it must match the checked-in file.
    if (
      item.name !== undefined &&
      (typeof item.name !== "string" || item.name !== names[position])
    ) {
      throw new Error(
        "Remote migration name differs from the checked-in migration.",
      );
    }
    seen.set(item.version, true);
  }

  const applied = EXPECTED_MIGRATIONS.filter((v) => seen.has(v));
  const pending = EXPECTED_MIGRATIONS.filter((v) => !seen.has(v));
  if (
    applied.length < 2 ||
    applied.some((v, i) => v !== EXPECTED_MIGRATIONS[i])
  ) {
    throw new Error(
      "Production migration history has a missing Phase 2/3 baseline or an out-of-order version.",
    );
  }
  if (requireAllApplied && pending.length) {
    throw new Error(
      "Reviewed migrations still pending after deployment: " +
        pending.join(", "),
    );
  }
  return { applied, pending };
}

/** Official structured Management API: GET /database/migrations. */
export async function getStructuredMigrationHistory(
  projectRef,
  accessToken,
  fetchImpl = fetch,
) {
  if (!PROJECT_REF.test(projectRef ?? "") || !accessToken) {
    throw new Error("Missing protected Supabase project ID or access token.");
  }
  let response;
  try {
    response = await fetchImpl(
      `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw new Error(
      "Supabase migration-history request failed; no database changes attempted.",
    );
  }

  if (response.status !== 200) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Supabase migration-history API access denied (HTTP " +
          response.status +
          "); production access token requires database_migrations_read permission.",
      );
    }
    throw new Error(
      "Supabase structured migration-history API unavailable (HTTP " +
        response.status +
        "); no database changes attempted.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Supabase migration-history API returned invalid JSON.");
  }
}

export async function verifyHostedMigrations(
  { projectRef, accessToken, filenames, requireAllApplied = false },
  fetchImpl = fetch,
) {
  const history = await getStructuredMigrationHistory(
    projectRef,
    accessToken,
    fetchImpl,
  );
  return verifyStructuredHistory(history, filenames, requireAllApplied);
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invoked === import.meta.url) {
  try {
    const state = await verifyHostedMigrations({
      projectRef: process.env.SUPABASE_PROJECT_ID,
      accessToken: process.env.SUPABASE_ACCESS_TOKEN,
      filenames: readdirSync("supabase/migrations"),
      requireAllApplied: process.argv.includes("--require-all-applied"),
    });
    console.log("Production migration versions:", state.applied.join(", "));
    console.log(
      "Approved pending migrations:",
      state.pending.join(", ") || "(none)",
    );
  } catch (error) {
    // Never log the server response, token, request headers, database
    // connection or user data. Only our own constant error messages.
    console.error(
      error instanceof Error ? error.message : "Migration verification failed.",
    );
    process.exitCode = 1;
  }
}
