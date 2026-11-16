import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GAME_SLUG_PATTERN,
  RESULT_ID_PATTERN,
  RESULTS_PATH,
  type ResultMutationResponse,
  type SavedResult,
} from "../../shared/results";

export class ResultApiError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
  ) {
    super("Result request failed: " + code);
  }
}

async function callResults(
  client: SupabaseClient,
  userId: string,
  path: string,
  method: "GET" | "POST" | "DELETE",
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ response: Response; body: unknown }> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== userId) {
    throw new ResultApiError("authentication_required", 401);
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        authorization: "Bearer " + data.session.access_token,
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      credentials: "omit",
      cache: "no-store",
      signal,
    });
  } catch {
    throw new ResultApiError("connection_failed", 0);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ResultApiError("invalid_server_response", response.status);
  }
  return { response, body };
}

function errorCode(body: unknown): string {
  if (body && typeof body === "object" && "error" in body &&
    typeof body.error === "string") return body.error;
  return "request_failed";
}

export type SubmissionFeedback =
  | ResultMutationResponse
  | { status: "unknown" }
  | { status: "invalid"; code: string }
  | { status: "ambiguous"; gameSlugs: string[] };

export async function submitShare(
  client: SupabaseClient,
  userId: string,
  text: string,
  replaceResultId?: string,
  confirmedGameSlug?: string,
): Promise<SubmissionFeedback> {
  if (replaceResultId && !RESULT_ID_PATTERN.test(replaceResultId)) {
    throw new ResultApiError("invalid_replace_target", 422);
  }
  const { response, body } = await callResults(client, userId, RESULTS_PATH, "POST", {
    text,
    ...(replaceResultId ? { replaceResultId } : {}),
    ...(confirmedGameSlug ? { confirmedGameSlug } : {}),
  });
  if (body && typeof body === "object" && "status" in body &&
    typeof body.status === "string" &&
    ["saved","duplicate","replaced","conflict","replace_target_mismatch","unknown","invalid","ambiguous"].includes(body.status)) {
    return body as SubmissionFeedback;
  }
  throw new ResultApiError(errorCode(body), response.status);
}

export async function retainUnknownShare(
  client: SupabaseClient,
  userId: string,
  text: string,
  gameSlug?: string,
): Promise<ResultMutationResponse> {
  if (gameSlug && !GAME_SLUG_PATTERN.test(gameSlug)) {
    throw new ResultApiError("invalid_game_filter", 422);
  }
  const { response, body } = await callResults(
    client, userId, RESULTS_PATH + "/unknown", "POST",
    { text, retain: true, ...(gameSlug ? { gameSlug } : {}) },
  );
  if (response.status === 201 && body && typeof body === "object" &&
    "status" in body && body.status === "retained") {
    return body as ResultMutationResponse;
  }
  throw new ResultApiError(errorCode(body), response.status);
}

export async function loadResultHistory(
  client: SupabaseClient,
  userId: string,
  options: { game?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<SavedResult[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  params.set("offset", String(options.offset ?? 0));
  if (options.game) params.set("game", options.game);
  const { response, body } = await callResults(
    client, userId, RESULTS_PATH + "?" + params, "GET", undefined, signal,
  );
  if (!response.ok) throw new ResultApiError(errorCode(body), response.status);
  if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items)) {
    throw new ResultApiError("invalid_server_response", response.status);
  }
  return body.items as SavedResult[];
}

export async function getResultDetail(
  client: SupabaseClient, userId: string, id: string, signal?: AbortSignal,
): Promise<SavedResult> {
  if (!RESULT_ID_PATTERN.test(id)) throw new ResultApiError("invalid_result_id", 422);
  const { response, body } = await callResults(
    client, userId, RESULTS_PATH + "/" + id, "GET", undefined, signal,
  );
  if (!response.ok) throw new ResultApiError(errorCode(body), response.status);
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
    throw new ResultApiError("invalid_server_response", response.status);
  }
  return body as SavedResult;
}

export async function deleteResult(
  client: SupabaseClient, userId: string, id: string,
): Promise<void> {
  if (!RESULT_ID_PATTERN.test(id)) throw new ResultApiError("invalid_result_id", 422);
  const { response, body } = await callResults(
    client, userId, RESULTS_PATH + "/" + id, "DELETE",
  );
  if (!response.ok || !body || typeof body !== "object" ||
      !("status" in body) || body.status !== "deleted") {
    throw new ResultApiError(errorCode(body), response.status);
  }
}

/** User-facing text never echoes raw pasted share content or upstream details. */
export function resultErrorText(cause: unknown): string {
  const code = cause instanceof ResultApiError ? cause.code : "connection_failed";
  switch (code) {
    case "authentication_required": return "Your session is unavailable. Sign in again before saving a result.";
    case "invalid_game_filter": return "Choose a valid game from the catalog.";
    case "invalid_share": return "Paste a single publisher share result to continue.";
    case "payload_too_large": return "This result is too large to submit.";
    case "rate_limited": return "Too many submissions. Try again later.";
    case "connection_failed": return "Could not reach Daydle. Check your connection and retry; the last write may have succeeded.";
    case "result_service_unavailable":
    case "service_unavailable": return "Result saving is unavailable. Try again after service is restored.";
    default: return "The result could not be verified. Refresh history before trying again.";
  }
}
