import { RESULT_ID_PATTERN } from "./results";

export const PRIVACY_EXPORT_PATH = "/api/v1/privacy/export";
export const PRIVACY_DATASETS = [
  "profile", "selections", "results", "corrections", "raw", "friends",
  "blocks", "achievements", "suggestions", "votes", "result_events",
] as const;
export type PrivacyDataset = (typeof PRIVACY_DATASETS)[number];
export const PRIVACY_PURGE_CRON = "18 8 * * *";

const fields: Record<PrivacyDataset, readonly string[]> = {
  profile: ["id", "display_name", "avatar_url", "created_at", "updated_at", "friend_code"],
  selections: ["id", "game_slug", "sort_order", "added_at"],
  results: ["id", "game_slug", "puzzle_key", "puzzle_date", "outcome",
    "score", "max_score", "attempts", "completion_time_ms", "metrics",
    "parser_version", "format_version", "submitted_at", "updated_at"],
  corrections: ["id", "result_id", "old_payload", "new_payload", "corrected_at"],
  raw: ["id", "game_slug", "result_id", "raw_share_text", "disposition",
    "parser_diagnostics", "received_at", "expires_at"],
  friends: ["id", "display_name", "created_at"],
  blocks: ["id", "created_at"],
  achievements: ["id", "code", "name", "source_puzzle_id", "earned_at", "visible_after"],
  suggestions: ["id", "name", "url", "notes", "status", "created_at"],
  votes: ["id", "created_at"],
  result_events: ["id", "result_id", "game_id", "puzzle_id", "action", "recorded_at"],
};

export function isDataset(value: string | null): value is PrivacyDataset {
  return value !== null && (PRIVACY_DATASETS as readonly string[]).includes(value);
}
export function validCursor(value: string | null): boolean {
  return value === null || RESULT_ID_PATTERN.test(value);
}

/** Owner data only; still fail-closed on malformed upstream DTOs. */
export function projectPrivacyRows(
  dataset: PrivacyDataset,
  data: unknown,
  priorCursor: string | null,
): Record<string, unknown>[] | null {
  const max = dataset === "raw" ? 20 : 50;
  if (!Array.isArray(data) || data.length > max) return null;
  let cursor = priorCursor?.toLowerCase() ?? null;
  const projected: Record<string, unknown>[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || !RESULT_ID_PATTERN.test(row.id))
      return null;
    if (cursor !== null && row.id.toLowerCase() <= cursor) return null;
    cursor = row.id.toLowerCase();
    if (dataset === "raw" &&
      (typeof row.expires_at !== "string" ||
       Date.parse(row.expires_at) <= Date.now() ||
       typeof row.raw_share_text !== "string" ||
       row.raw_share_text.length > 10000))
      return null;
    projected.push(Object.fromEntries(fields[dataset].map((key) => [
      key, row[key] ?? null,
    ])));
  }
  return projected;
}

export function validPurgeResult(value: unknown): value is { deleted: number } {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && "deleted" in value && typeof value.deleted === "number"
    && Number.isSafeInteger(value.deleted) && value.deleted >= 0;
}
