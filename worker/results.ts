import { parseShare } from "../shared/parsers";
import {
  GAME_SLUG_PATTERN,
  RESULT_ID_PATTERN,
  RESULTS_PATH,
  isResultMutationResponse,
} from "../shared/results";

export interface ResultsEnvironment {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ResultAuth {
  userId: string;
  project: string;
  publishable: string;
  serviceKey: string;
}

const MAX_BODY_BYTES = 48_000;
const errorResponse = (error: string, status: number, headers: HeadersInit = {}) =>
  responseJson({ error }, status, headers);

function responseJson(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "Authorization",
      ...headers,
    },
  });
}

function configuration(env: ResultsEnvironment | undefined): Omit<ResultAuth, "userId"> | null {
  try {
    if (!env?.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const url = new URL(env.SUPABASE_URL);
    if (url.protocol !== "https:" || url.pathname !== "/" ||
        url.search || url.hash || url.username || url.password) return null;
    if (!env.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")) return null;
    if (env.SUPABASE_SERVICE_ROLE_KEY.length < 30 ||
        env.SUPABASE_SERVICE_ROLE_KEY === env.SUPABASE_PUBLISHABLE_KEY) return null;
    return {
      project: url.origin,
      publishable: env.SUPABASE_PUBLISHABLE_KEY,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    };
  } catch { return null; }
}

async function authenticate(request: Request, env: ResultsEnvironment | undefined): Promise<ResultAuth | Response> {
  const config = configuration(env);
  if (!config) return errorResponse("service_unavailable", 503);
  const token = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(token) || token.length > 4096) {
    return errorResponse("authentication_required", 401);
  }
  try {
    const result = await fetch(config.project + "/auth/v1/user", {
      method: "GET",
      headers: { apikey: config.publishable, authorization: token },
      cache: "no-store",
      redirect: "error",
    });
    if (result.status === 401 || result.status === 403) return errorResponse("authentication_required", 401);
    if (!result.ok) return errorResponse("service_unavailable", 503);
    const data: unknown = await result.json();
    if (!data || typeof data !== "object" || !("id" in data) ||
        typeof data.id !== "string" || !RESULT_ID_PATTERN.test(data.id)) {
      return errorResponse("authentication_required", 401);
    }
    return { ...config, userId: data.id };
  } catch { return errorResponse("service_unavailable", 503); }
}

async function boundedJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return errorResponse("content_type_required", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return errorResponse("payload_too_large", 413);
  }
  if (!request.body) return errorResponse("invalid_json", 400);
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      count += item.value.byteLength;
      if (count > MAX_BODY_BYTES) {
        await reader.cancel();
        return errorResponse("payload_too_large", 413);
      }
      parts.push(item.value);
    }
    const bytes = new Uint8Array(count);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return errorResponse("invalid_json", 400);
    }
    return data as Record<string, unknown>;
  } catch {
    return errorResponse("invalid_json", 400);
  } finally {
    reader.releaseLock();
  }
}

async function rpc(auth: ResultAuth, method: string, args: Record<string, unknown>): Promise<unknown | Response> {
  try {
    const result = await fetch(auth.project + "/rest/v1/rpc/" + method, {
      method: "POST",
      headers: {
        apikey: auth.serviceKey,
        authorization: "Bearer " + auth.serviceKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      redirect: "error",
    });
    if (!result.ok) {
      if (result.status === 429) return errorResponse("rate_limited", 429);
      if (result.status === 400) {
        const detail: unknown = await result.json().catch(() => null);
        if (detail && typeof detail === "object" && "message" in detail &&
          detail.message === "result_rate_limited") return errorResponse("rate_limited", 429);
      }
      return errorResponse("result_service_unavailable", 503);
    }
    return await result.json();
  } catch {
    return errorResponse("result_service_unavailable", 503);
  }
}

function isResponse(data: unknown): data is Response {
  return data instanceof Response;
}

function mutation(data: unknown): Response {
  if (!isResultMutationResponse(data)) return errorResponse("result_service_unavailable", 503);
  if (data.status === "conflict" || data.status === "replace_target_mismatch") {
    return responseJson(data, 409);
  }
  if (data.status === "not_found") return responseJson(data, 404);
  return responseJson(data, data.status === "saved" || data.status === "retained" ? 201 : 200);
}

/** Auth is server-validated; no client-provided user ID is accepted. */
export async function handleResultsRequest(request: Request, env?: ResultsEnvironment): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const detail = pathname.match(/^\/api\/v1\/results\/([a-f0-9-]{36})$/i);
  if (pathname !== RESULTS_PATH && pathname !== RESULTS_PATH + "/unknown" && !detail) {
    return errorResponse("not_found", 404);
  }
  const allowed = pathname === RESULTS_PATH ? "GET, POST" :
    pathname === RESULTS_PATH + "/unknown" ? "POST" : "GET, DELETE";
  if (!allowed.split(", ").includes(request.method)) {
    return errorResponse("method_not_allowed", 405, { allow: allowed });
  }
  if (detail && !RESULT_ID_PATTERN.test(detail[1]!)) {
    return errorResponse("invalid_result_id", 400);
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return errorResponse("origin_rejected", 403);
  }

  const auth = await authenticate(request, env);
  if (isResponse(auth)) return auth;
  if (request.method === "GET") {
    if (detail) {
      const result = await rpc(auth, "my_result_detail", { p_user: auth.userId, p_id: detail[1] });
      return isResponse(result) ? result : result === null ? errorResponse("not_found", 404) : responseJson(result);
    }
    const game = url.searchParams.get("game");
    if (game && !GAME_SLUG_PATTERN.test(game)) return errorResponse("invalid_game_filter", 400);
    const limit = url.searchParams.get("limit") || "20";
    const offset = url.searchParams.get("offset") || "0";
    if (!/^\d{1,4}$/.test(limit) || !/^\d{1,4}$/.test(offset) ||
        Number(limit) < 1 || Number(limit) > 50 || Number(offset) > 5000) {
      return errorResponse("invalid_pagination", 400);
    }
    const result = await rpc(auth, "my_result_history", {
      p_user: auth.userId, p_game: game, p_limit: Number(limit), p_offset: Number(offset),
    });
    if (isResponse(result)) return result;
    return Array.isArray(result) ? responseJson({ items: result }) :
      errorResponse("result_service_unavailable", 503);
  }

  if (detail && request.method === "DELETE") {
    const result = await rpc(auth, "delete_my_result", { p_user: auth.userId, p_id: detail[1] });
    return isResponse(result) ? result : mutation(result);
  }

  const body = await boundedJson(request);
  if (isResponse(body)) return body;
  if (typeof body.text !== "string") return errorResponse("invalid_share", 422);
  const parsed = parseShare(body.text);

  if (pathname === RESULTS_PATH + "/unknown") {
    if (body.retain !== true) return errorResponse("retention_requires_consent", 422);
    if (parsed.status === "parsed" || parsed.status === "ambiguous") {
      return errorResponse("recognized_share", 409);
    }
    if (parsed.status === "invalid" && parsed.code !== "invalid_format") {
      return responseJson({ status: "invalid", code: parsed.code }, 422);
    }
    const game = body.gameSlug;
    if (game !== undefined && (typeof game !== "string" || !GAME_SLUG_PATTERN.test(game))) {
      return errorResponse("invalid_game_filter", 422);
    }
    const result = await rpc(auth, "retain_unknown_share", {
      p_user: auth.userId, p_raw: body.text, p_game_slug: game ?? null,
    });
    return isResponse(result) ? result : mutation(result);
  }

  if (parsed.status === "invalid") return responseJson({ status: "invalid", code: parsed.code }, 422);
  if (parsed.status === "unknown") return responseJson({ status: "unknown" }, 422);
  if (parsed.status === "ambiguous") return responseJson({ status: "ambiguous", gameSlugs: parsed.gameSlugs }, 409);

  const target = body.replaceResultId;
  if (target !== undefined && (typeof target !== "string" || !RESULT_ID_PATTERN.test(target))) {
    return errorResponse("invalid_replace_target", 422);
  }
  const result = await rpc(auth, "ingest_parsed_share", {
    p_user: auth.userId, p_raw: body.text, p_parsed: parsed.result, p_replace_id: target ?? null,
  });
  return isResponse(result) ? result : mutation(result);
}
