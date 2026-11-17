import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPARISON_PATH,
  validComparisonBoard,
  validHeadToHead,
  validPublicPerformance,
  validPublicResult,
  validPuzzlesResponse,
  type BoardScope,
  type ComparisonBoard,
  type HeadToHead,
  type PublicPerformance,
  type PublicPuzzleResult,
  type PuzzlesResponse,
} from "../../shared/comparisons";

export class ComparisonApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super("Comparison request failed: " + code);
  }
}

export function comparisonErrorText(cause: unknown): string {
  if (!(cause instanceof ComparisonApiError))
    return "Could not load the comparison. Retry when connected.";
  switch (cause.code) {
    case "authentication_required":
      return "Sign in to see your friend-only rankings.";
    case "not_found":
      return "This puzzle or player is unavailable.";
    case "invalid_game":
    case "invalid_puzzle":
    case "invalid_players":
      return "This comparison link is invalid.";
    case "connection_failed":
      return "Could not reach Daydle. Check your connection and retry.";
    default:
      return "Comparison data could not be loaded. Please retry.";
  }
}

async function getViewerToken(
  client?: SupabaseClient | null,
  userId?: string | null,
): Promise<string | null> {
  if (!userId) return null;
  if (!client) throw new ComparisonApiError("authentication_required", 401);
  const { data, error } = await client.auth.getSession();
  if (error || !data.session ||
    data.session.user.id !== userId || !data.session.access_token)
    throw new ComparisonApiError("authentication_required", 401);
  return data.session.access_token;
}

async function requestComparison(
  path: string,
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<unknown> {
  const token = await getViewerToken(client, viewerId);
  let response: Response;
  try {
    response = await fetch(path, {
      method: "GET",
      headers: token ? { authorization: "Bearer " + token } : undefined,
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  } catch {
    throw new ComparisonApiError("connection_failed", 0);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ComparisonApiError("invalid_server_response", response.status);
  }
  if (!response.ok) {
    const code = data && typeof data === "object" &&
      "error" in data && typeof data.error === "string"
      ? data.error : "comparison_service_unavailable";
    throw new ComparisonApiError(code, response.status);
  }
  return data;
}

export async function loadComparisonPuzzles(
  game: string,
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<PuzzlesResponse> {
  const path = COMPARISON_PATH + "/puzzles?" +
    new URLSearchParams({ game }).toString();
  const value = await requestComparison(path, client, viewerId, signal);
  if (!validPuzzlesResponse(value))
    throw new ComparisonApiError("invalid_server_response", 503);
  return value;
}

export async function loadComparisonBoard(
  game: string,
  puzzle: string,
  scope: BoardScope,
  pagination: { limit: number; offset: number },
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<ComparisonBoard> {
  const path = COMPARISON_PATH + "/board?" +
    new URLSearchParams({
      game, puzzle, scope,
      limit: String(pagination.limit),
      offset: String(pagination.offset),
    });
  const value = await requestComparison(path, client, viewerId, signal);
  if (!validComparisonBoard(value))
    throw new ComparisonApiError("invalid_server_response", 503);
  return value;
}

export async function loadVisiblePerformance(
  id: string,
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<PublicPerformance> {
  const value = await requestComparison(
    COMPARISON_PATH + "/profile/" + encodeURIComponent(id),
    client, viewerId, signal,
  );
  if (!validPublicPerformance(value) ||
    value.profileId.toLowerCase() !== id.toLowerCase())
    throw new ComparisonApiError("invalid_server_response", 503);
  return value;
}

export async function loadPublicPuzzleResult(
  id: string,
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<PublicPuzzleResult> {
  const value = await requestComparison(
    COMPARISON_PATH + "/result/" + encodeURIComponent(id),
    client, viewerId, signal,
  );
  if (!validPublicResult(value) ||
    value.resultId.toLowerCase() !== id.toLowerCase())
    throw new ComparisonApiError("invalid_server_response", 503);
  return value;
}

export async function loadHeadToHead(
  leftId: string,
  rightId: string,
  game: string | null,
  pagination: { limit: number; offset: number },
  client?: SupabaseClient | null,
  viewerId?: string | null,
  signal?: AbortSignal,
): Promise<HeadToHead> {
  const query = new URLSearchParams({
    left: leftId,
    right: rightId,
    limit: String(pagination.limit),
    offset: String(pagination.offset),
  });
  if (game) query.set("game", game);
  const value = await requestComparison(
    COMPARISON_PATH + "/head-to-head?" + query,
    client, viewerId, signal,
  );
  if (!validHeadToHead(value) ||
      value.leftUserId.toLowerCase() !== leftId.toLowerCase() ||
      value.rightUserId.toLowerCase() !== rightId.toLowerCase())
    throw new ComparisonApiError("invalid_server_response", 503);
  return value;
}
