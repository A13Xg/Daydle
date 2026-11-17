import { RESULT_ID_PATTERN } from "./results";

export const REQUESTS_PATH = "/api/v1/requests";
export const ADMIN_PATH = "/api/v1/admin";

export type RequestStatus = "pending" | "approved";
export interface GameRequest {
  id: string;
  name: string;
  url: string;
  notes: string;
  status: RequestStatus;
  created_at: string;
  vote_count: number;
  voted_by_me: boolean;
  suggested_by_me: boolean;
}
export type RequestAction = "create" | "vote" | "unvote";
export type AdminView =
  | "overview"
  | "requests"
  | "games"
  | "samples"
  | "sample"
  | "diagnostics"
  | "restrictions";
export type AdminAction =
  | "moderate"
  | "save_game"
  | "retire_game"
  | "review_sample"
  | "restrict"
  | "unrestrict";

export function validRequest(value: unknown): value is GameRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<GameRequest>;
  return (
    typeof row.id === "string" &&
    RESULT_ID_PATTERN.test(row.id) &&
    typeof row.name === "string" &&
    row.name.length <= 120 &&
    typeof row.url === "string" &&
    row.url.length <= 2048 &&
    row.url.startsWith("https://") &&
    typeof row.notes === "string" &&
    row.notes.length <= 500 &&
    (row.status === "pending" || row.status === "approved") &&
    typeof row.created_at === "string" &&
    Number.isFinite(Date.parse(row.created_at)) &&
    typeof row.vote_count === "number" &&
    Number.isInteger(row.vote_count) &&
    row.vote_count >= 0 &&
    typeof row.voted_by_me === "boolean" &&
    typeof row.suggested_by_me === "boolean"
  );
}

export function validRequests(value: unknown): value is GameRequest[] {
  return (
    Array.isArray(value) && value.length <= 50 && value.every(validRequest)
  );
}

export function validMutation(
  value: unknown,
): value is { status: string; id?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as { status?: unknown; id?: unknown };
  return (
    typeof row.status === "string" &&
    [
      "created",
      "duplicate",
      "voted",
      "unvoted",
      "restricted",
      "rate_limited",
      "invalid",
      "not_found",
      "saved",
    ].includes(row.status) &&
    (row.id === undefined ||
      (typeof row.id === "string" && RESULT_ID_PATTERN.test(row.id)))
  );
}

export function pageNumber(
  value: string | null,
  fallback: number,
  max: number,
): number | null {
  if (value === null) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
}
