import {
  ADMIN_PATH,
  REQUESTS_PATH,
  pageNumber,
  validMutation,
  validRequests,
  type AdminAction,
  type AdminView,
} from "../shared/administration";
import { RESULT_ID_PATTERN } from "../shared/results";
import { safePublisherUrl } from "../shared/catalog";
import {
  authenticate,
  boundedJson,
  configuration,
  errorResponse,
  isResponse,
  responseJson,
  rpc,
  type ResultsEnvironment,
} from "./results";

const VIEWS: readonly AdminView[] = [
  "overview",
  "requests",
  "games",
  "samples",
  "sample",
  "diagnostics",
  "restrictions",
];
const ACTIONS: readonly AdminAction[] = [
  "moderate",
  "save_game",
  "retire_game",
  "review_sample",
  "restrict",
  "unrestrict",
];

function projectedMutation(value: { status: string; id?: string }): {
  status: string;
  id?: string;
} {
  return value.id
    ? { status: value.status, id: value.id }
    : { status: value.status };
}

function projectAdminView(
  view: AdminView,
  value: unknown,
  id: string | null,
): unknown | null {
  if (view === "overview") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const row = value as Record<string, unknown>;
    const keys = [
      "pending_requests",
      "unparsed_samples",
      "restricted_users",
    ] as const;
    if (
      keys.some(
        (key) =>
          typeof row[key] !== "number" ||
          !Number.isSafeInteger(row[key]) ||
          (row[key] as number) < 0,
      )
    )
      return null;
    return Object.fromEntries(keys.map((key) => [key, row[key]]));
  }
  if (view === "sample") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const row = value as Record<string, unknown>;
    if (
      row.id !== id ||
      typeof row.raw_text !== "string" ||
      row.raw_text.length > 10000 ||
      typeof row.expires_at !== "string" ||
      !["invalid", "unsupported"].includes(String(row.disposition)) ||
      !row.diagnostics ||
      typeof row.diagnostics !== "object" ||
      Array.isArray(row.diagnostics)
    )
      return null;
    return {
      id: row.id,
      raw_text: row.raw_text,
      disposition: row.disposition,
      diagnostics: row.diagnostics,
      expires_at: row.expires_at,
    };
  }
  const allowed: Record<
    Exclude<AdminView, "overview" | "sample">,
    readonly string[]
  > = {
    requests: [
      "id",
      "name",
      "url",
      "notes",
      "status",
      "created_at",
      "suggested_by",
      "vote_count",
    ],
    games: [
      "id",
      "slug",
      "name",
      "description",
      "publisher",
      "url",
      "status",
      "cadence",
      "parser_status",
      "link_status",
      "category_slugs",
    ],
    samples: [
      "id",
      "disposition",
      "received_at",
      "expires_at",
      "reason",
      "review_status",
      "game_slug",
    ],
    diagnostics: ["game_slug", "parser_version", "reason", "disposition", "day", "samples"],
    restrictions: ["user_id", "reason", "created_at"],
  };
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  )
    return null;
  return value.map((row: Record<string, unknown>) =>
    Object.fromEntries(allowed[view].map((key) => [key, row[key] ?? null])),
  );
}

function statusFor(value: { status: string }): number {
  switch (value.status) {
    case "created":
      return 201;
    case "duplicate":
      return 409;
    case "rate_limited":
      return 429;
    case "restricted":
      return 403;
    case "invalid":
      return 422;
    case "not_found":
      return 404;
    default:
      return 200;
  }
}

function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function handleAdministrationRequest(
  request: Request,
  env?: ResultsEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const admin = url.pathname === ADMIN_PATH;
  if (!admin && url.pathname !== REQUESTS_PATH)
    return errorResponse("not_found", 404);
  if (request.method !== "GET" && request.method !== "POST")
    return errorResponse("method_not_allowed", 405, {
      allow: "GET, POST",
    });
  if (request.method === "POST" && !validOrigin(request))
    return errorResponse("origin_rejected", 403);

  const limit = pageNumber(url.searchParams.get("limit"), 20, 50);
  const offset = pageNumber(url.searchParams.get("offset"), 0, 5000);
  if (limit === null || limit < 1 || offset === null)
    return errorResponse("invalid_page", 422);

  // Public request listing intentionally allows visitors. An offered bearer
  // must still be verified; never silently downgrade a bad token to guest.
  const hasBearer = request.headers.has("authorization");
  const auth =
    admin || request.method === "POST" || hasBearer
      ? await authenticate(request, env)
      : null;
  if (isResponse(auth)) return auth;
  const config = auth ?? configuration(env);
  if (!config) return errorResponse("service_unavailable", 503);

  if (!admin) {
    if (request.method === "GET") {
      const value = await rpc(config, "daydle_requests", {
        p_actor: auth?.userId ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (isResponse(value)) return value;
      if (!validRequests(value))
        return errorResponse("request_service_unavailable", 503);
      return responseJson(
        value.map(
          ({
            id,
            name,
            url: publisherUrl,
            notes,
            status,
            created_at,
            vote_count,
            voted_by_me,
            suggested_by_me,
          }) => ({
            id,
            name,
            url: publisherUrl,
            notes,
            status,
            created_at,
            vote_count,
            voted_by_me,
            suggested_by_me,
          }),
        ),
      );
    }
    if (!auth) return errorResponse("authentication_required", 401);
    const body = await boundedJson(request);
    if (isResponse(body)) return body;
    if (!["create", "vote", "unvote"].includes(String(body.action)))
      return errorResponse("invalid_action", 422);
    const action = body.action as string;
    const payload: Record<string, unknown> = {
      p_actor: auth.userId,
      p_action: action,
    };
    if (action === "create") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const notes = typeof body.notes === "string" ? body.notes : "";
      const urlValue =
        typeof body.url === "string" ? safePublisherUrl(body.url) : null;
      if (
        name.length < 2 ||
        name.length > 120 ||
        notes.length > 500 ||
        !urlValue
      )
        return errorResponse("invalid_request", 422);
      payload.p_name = name;
      payload.p_url = urlValue;
      payload.p_notes = notes;
    } else {
      if (typeof body.id !== "string" || !RESULT_ID_PATTERN.test(body.id))
        return errorResponse("invalid_request_id", 422);
      payload.p_id = body.id;
    }
    const value = await rpc(config, "daydle_request_action", payload);
    if (isResponse(value)) return value;
    if (!validMutation(value))
      return errorResponse("request_service_unavailable", 503);
    return responseJson(projectedMutation(value), statusFor(value));
  }

  if (!auth) return errorResponse("authentication_required", 401);
  const allowed = await rpc(config, "daydle_admin_status", {
    p_actor: auth.userId,
  });
  if (isResponse(allowed)) return allowed;
  if (allowed !== true) {
    return allowed === false
      ? errorResponse("admin_required", 403)
      : errorResponse("admin_service_unavailable", 503);
  }

  if (request.method === "GET") {
    const view = url.searchParams.get("view") ?? "overview";
    if (!VIEWS.includes(view as AdminView))
      return errorResponse("invalid_admin_view", 422);
    const id = url.searchParams.get("id");
    if (view === "sample" && (!id || !RESULT_ID_PATTERN.test(id)))
      return errorResponse("invalid_sample_id", 422);
    const value = await rpc(config, "daydle_admin_view", {
      p_actor: auth.userId,
      p_view: view,
      p_limit: limit,
      p_offset: offset,
      p_id: view === "sample" ? id : null,
    });
    if (isResponse(value)) return value;
    if (view === "sample" && value === null)
      return errorResponse("not_found", 404);
    const safe = projectAdminView(view as AdminView, value, id);
    if (safe === null) return errorResponse("admin_service_unavailable", 503);
    return responseJson(safe);
  }

  const body = await boundedJson(request);
  if (isResponse(body)) return body;
  if (!ACTIONS.includes(body.action as AdminAction))
    return errorResponse("invalid_action", 422);
  const action = body.action as AdminAction;
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input))
    return errorResponse("invalid_payload", 422);
  const data = input as Record<string, unknown>;
  if (JSON.stringify(data).length > 5000)
    return errorResponse("invalid_payload", 422);
  // Only documented data keys are sent to SQL; actor is always server-derived.
  const fields: Record<AdminAction, readonly string[]> = {
    moderate: ["id", "status"],
    save_game: [
      "id",
      "slug",
      "name",
      "url",
      "description",
      "publisher",
      "categories",
      "cadence",
      "status",
    ],
    retire_game: ["id"],
    review_sample: ["id", "status", "gameSlug", "notes"],
    restrict: ["userId", "reason"],
    unrestrict: ["userId"],
  };
  const safeData = Object.fromEntries(
    fields[action].filter((key) => key in data).map((key) => [key, data[key]]),
  );
  for (const value of Object.values(safeData)) {
    if (value !== null && typeof value !== "string")
      return errorResponse("invalid_payload", 422);
  }
  for (const key of ["id", "userId"]) {
    if (
      key in safeData &&
      (typeof safeData[key] !== "string" ||
        !RESULT_ID_PATTERN.test(safeData[key]))
    )
      return errorResponse("invalid_target", 422);
  }
  const value = await rpc(config, "daydle_admin_action", {
    p_actor: auth.userId,
    p_action: action,
    p_data: safeData,
  });
  if (isResponse(value)) return value;
  if (!validMutation(value))
    return errorResponse("admin_service_unavailable", 503);
  return responseJson(value, statusFor(value));
}
