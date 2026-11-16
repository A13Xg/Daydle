import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { inspectMigrationPlan } from "./verify-migration-plan.mjs";

/**
 * Fixed, aggregate-only catalog probe. No user rows, email addresses,
 * OAuth tokens or private game results are queried.
 *
 * Hosted credentials must come only from the protected GitHub environment.
 */
export const BASELINE_PROBE_SQL = "\nWITH expected_tables(object_name) AS (\n  VALUES\n    ('public.profiles'), ('public.friend_codes'),\n    ('public.game_categories'), ('public.games'),\n    ('public.game_category_links'), ('public.user_games'),\n    ('public.puzzles'), ('public.game_results'),\n    ('public.raw_submissions'), ('public.result_corrections'),\n    ('public.friendships'), ('public.blocks'),\n    ('public.achievement_definitions'), ('public.user_achievements'),\n    ('public.game_suggestions'), ('public.suggestion_votes'),\n    ('app_private.admin_members'), ('app_private.admin_events')\n),\nexpected_policies(policy_name) AS (\n  VALUES ('profiles_public_read'), ('profiles_owner_update'),\n    ('friend_codes_own_read'), ('games_public_read'),\n    ('game_categories_public_read'), ('game_category_links_public_read'),\n    ('user_games_public_read'), ('user_games_owner_insert'),\n    ('user_games_owner_delete'), ('user_games_owner_update'),\n    ('puzzles_public_read'), ('game_results_spoiler_read'),\n    ('friendships_member_read'), ('blocks_owner_read'),\n    ('achievements_definitions_public_read'), ('achievements_spoiler_read'),\n    ('suggestions_public_read'), ('suggestion_votes_own_read')\n)\nSELECT\n  (\n    SELECT pg_catalog.count(*) = 18\n      AND pg_catalog.bool_and(c.relrowsecurity)\n    FROM expected_tables e\n    JOIN pg_catalog.pg_class c\n      ON c.oid = pg_catalog.to_regclass(e.object_name)\n    WHERE c.relkind IN ('r', 'p')\n  ) AS phase2_tables_rls,\n  (\n    SELECT pg_catalog.count(*) = 18\n    FROM expected_policies e\n    JOIN pg_catalog.pg_policies p ON p.policyname = e.policy_name\n    WHERE p.schemaname = 'public'\n  ) AS phase2_policies,\n  (\n    pg_catalog.to_regprocedure('app_private.can_view_result(uuid,uuid)') IS NOT NULL\n    AND pg_catalog.to_regprocedure('app_private.purge_expired_raw_submissions()') IS NOT NULL\n    AND pg_catalog.to_regclass('app_private.admin_members') IS NOT NULL\n  ) AS phase2_functions,\n  (\n    SELECT pg_catalog.count(*) = 1\n    FROM pg_catalog.pg_attribute a\n    WHERE a.attrelid = pg_catalog.to_regclass('public.profiles')\n      AND a.attname = 'onboarding_completed'\n      AND a.attnotnull AND NOT a.attisdropped\n  ) AS phase3_column,\n  (\n    pg_catalog.to_regprocedure('app_private.random_friend_code()') IS NOT NULL\n    AND pg_catalog.to_regprocedure('app_private.allocate_friend_code(uuid)') IS NOT NULL\n    AND pg_catalog.to_regprocedure('app_private.on_auth_user_created()') IS NOT NULL\n  ) AS phase3_functions,\n  (\n    SELECT pg_catalog.count(*) = 1\n    FROM pg_catalog.pg_trigger t\n    WHERE t.tgrelid = pg_catalog.to_regclass('auth.users')\n      AND t.tgname = 'daydle_auth_user_created'\n      AND t.tgenabled <> 'D'\n      AND t.tgfoid = pg_catalog.to_regprocedure('app_private.on_auth_user_created()')\n  ) AS phase3_trigger,\n  (\n    EXISTS (\n      SELECT 1 FROM pg_catalog.pg_attribute a\n      WHERE a.attrelid = pg_catalog.to_regclass('public.games')\n        AND a.attname = 'link_status' AND NOT a.attisdropped\n    )\n    OR pg_catalog.to_regprocedure('public.set_my_games(uuid[])') IS NOT NULL\n  ) AS phase4_present,\n  (\n    pg_catalog.to_regclass('public.user_game_day_marks') IS NOT NULL\n  ) AS phase5_present\n";

export function verifiedRepairs(state, probe) {
  if (state.missingBaseline.length === 0) return [];
  const required = [
    "phase2_tables_rls",
    "phase2_policies",
    "phase2_functions",
    "phase3_column",
    "phase3_functions",
    "phase3_trigger",
  ];
  if (
    !probe ||
    typeof probe !== "object" ||
    required.some((field) => probe[field] !== true) ||
    probe.phase4_present !== false ||
    probe.phase5_present !== false
  ) {
    throw new Error(
      "Remote Phase 2/3 schema signatures do not match the approved baseline, " +
        "or later schema is present but untracked. " +
        "No migration tracking has been modified.",
    );
  }
  return [...state.missingBaseline];
}

export async function queryBaseline(
  projectRef,
  accessToken,
  fetchImpl = fetch,
) {
  if (!/^[a-z0-9]{20}$/.test(projectRef) || !accessToken) {
    throw new Error("Missing valid protected Supabase project configuration.");
  }
  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: BASELINE_PROBE_SQL }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (response.status !== 201) {
    throw new Error(
      "Supabase read-only catalog verification unavailable (HTTP " +
        response.status +
        "). Confirm Management API database_read scope; " +
        "no migration history was repaired.",
    );
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(
      "Unexpected read-only schema verification response; " +
        "no migration history was repaired.",
    );
  }
  return data[0];
}

export async function reconcileBaseline(
  report,
  filenames,
  {
    projectRef,
    accessToken,
    fetchImpl = fetch,
    repair = (version) =>
      execFileSync(
        "supabase",
        ["migration", "repair", version, "--status", "applied", "--linked"],
        { stdio: ["ignore", "pipe", "pipe"] },
      ),
    log = console.log,
  },
) {
  const state = inspectMigrationPlan(report, filenames);
  log("Recorded remote versions:", state.applied.join(", ") || "(none)");
  log("Unrecorded reviewed versions:", state.pending.join(", ") || "(none)");

  if (state.missingBaseline.length === 0) return [];
  log(
    "Phase 2/3 history absent. Checking live RLS, functions and auth trigger " +
      "before any metadata repair.",
  );

  const probe = await queryBaseline(projectRef, accessToken, fetchImpl);
  const allowed = verifiedRepairs(state, probe);
  // Do not print provider response or SQL rows; schema booleans are enough.
  log("Read-only Phase 2/3 baseline verification: PASS");
  for (const version of allowed) {
    try {
      await repair(version);
    } catch {
      throw new Error(
        "Migration metadata repair failed for version " + version +
          ". The next run will re-check history before proceeding.",
      );
    }
    log("Recorded verified existing migration:", version);
  }
  return allowed;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invoked === import.meta.url) {
  try {
    if (!process.argv[2]) throw new Error("Migration history file is required.");
    await reconcileBaseline(
      readFileSync(process.argv[2], "utf8"),
      readdirSync("supabase/migrations"),
      {
        projectRef: process.env.SUPABASE_PROJECT_ID,
        accessToken: process.env.SUPABASE_ACCESS_TOKEN,
      },
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Remote baseline verification failed.",
    );
    process.exitCode = 1;
  }
}
