import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_PATH,
  REQUESTS_PATH,
  validMutation,
  validRequests,
  type AdminAction,
  type AdminView,
  type GameRequest,
  type RequestAction,
} from "../../shared/administration";

export class AdministrationError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

async function bearer(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (
    error ||
    !data.session ||
    data.session.user.id !== userId ||
    !data.session.access_token
  )
    throw new AdministrationError("authentication_required", 401);
  return data.session.access_token;
}

async function responseJson(response: Response): Promise<unknown> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AdministrationError("invalid_response", response.status);
  }
  if (!response.ok) {
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : data &&
            typeof data === "object" &&
            "status" in data &&
            typeof data.status === "string"
          ? data.status
          : "service_unavailable";
    throw new AdministrationError(code, response.status);
  }
  return data;
}

export function administrationErrorText(error: unknown): string {
  if (!(error instanceof AdministrationError))
    return "The request failed. Check your connection and retry.";
  switch (error.code) {
    case "authentication_required":
      return "Sign in to continue.";
    case "admin_required":
      return "Administrator access is required.";
    case "rate_limited":
      return "Too many requests. Try again later.";
    case "restricted":
      return "This account cannot submit or vote on game requests.";
    case "duplicate":
      return "That publisher URL has already been suggested.";
    case "invalid":
    case "invalid_payload":
    case "invalid_request":
      return "Check the fields and try again.";
    case "not_found":
      return "That item is no longer available.";
    default:
      return "Daydle could not complete that request. Try again.";
  }
}

async function request(
  endpoint: string,
  options: {
    client?: SupabaseClient;
    userId?: string | null;
    signal?: AbortSignal;
    body?: unknown;
  } = {},
): Promise<unknown> {
  const { client, userId, signal, body } = options;
  const headers: Record<string, string> = {};
  if (client && userId)
    headers.authorization = "Bearer " + (await bearer(client, userId));
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: body !== undefined ? "POST" : "GET",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  } catch {
    throw new AdministrationError("connection_failed", 0);
  }
  return responseJson(response);
}

export async function loadGameRequests(
  client?: SupabaseClient,
  userId?: string | null,
  offset = 0,
  signal?: AbortSignal,
): Promise<GameRequest[]> {
  const data = await request(
    REQUESTS_PATH + "?limit=20&offset=" + offset,
    { client, userId, signal },
  );
  if (!validRequests(data))
    throw new AdministrationError("invalid_response", 503);
  return data;
}

export async function mutateGameRequest(
  client: SupabaseClient,
  userId: string,
  action: RequestAction,
  data: { id?: string; name?: string; url?: string; notes?: string },
): Promise<{ status: string; id?: string }> {
  const result = await request(REQUESTS_PATH, {
    client,
    userId,
    body: { action, ...data },
  });
  if (!validMutation(result))
    throw new AdministrationError("invalid_response", 503);
  return result;
}

export async function loadAdminView(
  client: SupabaseClient,
  userId: string,
  view: AdminView,
  offset = 0,
  id?: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const query = new URLSearchParams({ view, limit: "20", offset: String(offset) });
  if (id) query.set("id", id);
  return request(ADMIN_PATH + "?" + query.toString(), {
    client,
    userId,
    signal,
  });
}

export async function mutateAdmin(
  client: SupabaseClient,
  userId: string,
  action: AdminAction,
  data: Record<string, string | null>,
): Promise<{ status: string; id?: string }> {
  const result = await request(ADMIN_PATH, {
    client,
    userId,
    body: { action, data },
  });
  if (!validMutation(result))
    throw new AdministrationError("invalid_response", 503);
  return result;
}
