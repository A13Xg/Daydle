/** Owner-only result API contracts. Never include raw pasted text in responses. */
export const RESULTS_PATH = "/api/v1/results" as const;
export const RESULT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const GAME_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export interface SavedResult {
  id: string;
  game_id: string;
  game_slug: string;
  game_name: string;
  puzzle_key: string;
  puzzle_date: string | null;
  outcome: "win" | "loss" | "complete" | "incomplete";
  score: number | null;
  attempts: number | null;
  completion_time_ms: number | null;
  metrics: Record<string, unknown>;
  parser_version: string;
  format_version: string | null;
  submitted_at: string;
  updated_at: string;
  correction_count?: number;
}

export type ResultStatus =
  | "saved"
  | "duplicate"
  | "conflict"
  | "replaced"
  | "replace_target_mismatch"
  | "deleted"
  | "not_found"
  | "retained";

export interface ResultMutationResponse {
  status: ResultStatus;
  id?: string;
}

export function isResultMutationResponse(
  value: unknown,
): value is ResultMutationResponse {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.status === "string" &&
    [
      "saved",
      "duplicate",
      "conflict",
      "replaced",
      "replace_target_mismatch",
      "deleted",
      "not_found",
      "retained",
    ].includes(row.status) &&
    (row.id === undefined || typeof row.id === "string")
  );
}
