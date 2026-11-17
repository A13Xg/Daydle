import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOCIAL_PATH,
  normalizeFriendCode,
  validPublicPlayer,
  validSocialNetwork,
  validSocialMutation,
  type PublicPlayer,
  type SocialAction,
  type SocialMutation,
  type SocialNetwork,
} from "../../shared/social";

export class SocialApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super("Social request failed: " + code);
  }
}

async function tokenFor(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== userId)
    throw new SocialApiError("authentication_required", 401);
  return data.session.access_token;
}

async function parse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SocialApiError("invalid_server_response", response.status);
  }
  if (!response.ok) {
    let code = "social_service_unavailable";
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
    )
      code = body.error;
    if (
      body &&
      typeof body === "object" &&
      "status" in body &&
      typeof body.status === "string"
    )
      code = body.status;
    throw new SocialApiError(code, response.status);
  }
  return body;
}

export function socialErrorText(error: unknown): string {
  if (!(error instanceof SocialApiError))
    return "Something went wrong. Please retry.";
  switch (error.code) {
    case "authentication_required":
      return "Sign in to manage your friends.";
    case "invalid_friend_code":
      return "Enter a valid five-character friend code.";
    case "invalid_target":
      return "That player link is invalid.";
    case "rate_limited":
      return "Too many connection attempts. Try again later.";
    case "not_found":
      return "This player or code is no longer available.";
    case "unavailable":
      return "This connection is unavailable.";
    case "connection_failed":
      return "Could not connect. Check your connection and retry.";
    default:
      return "We couldn't load that information. Please retry.";
  }
}

export async function loadSocialNetwork(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<SocialNetwork> {
  const token = await tokenFor(client, userId);
  let response: Response;
  try {
    response = await fetch(SOCIAL_PATH, {
      headers: { authorization: "Bearer " + token },
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  } catch {
    throw new SocialApiError("connection_failed", 0);
  }
  const value = await parse(response);
  if (!validSocialNetwork(value))
    throw new SocialApiError("invalid_server_response", response.status);
  return value;
}

export async function socialAction(
  client: SupabaseClient,
  userId: string,
  action: SocialAction,
  args: { code?: string; targetId?: string } = {},
): Promise<SocialMutation> {
  const token = await tokenFor(client, userId);
  let response: Response;
  try {
    response = await fetch(SOCIAL_PATH, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, ...args }),
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new SocialApiError("connection_failed", 0);
  }
  const value = await parse(response);
  if (!validSocialMutation(value))
    throw new SocialApiError("invalid_server_response", response.status);
  return value;
}

export async function loadPublicPlayer(
  id: string,
  signal?: AbortSignal,
): Promise<PublicPlayer> {
  let response: Response;
  try {
    response = await fetch("/api/v1/players/" + encodeURIComponent(id), {
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  } catch {
    throw new SocialApiError("connection_failed", 0);
  }
  const result = await parse(response);
  if (
    !validPublicPlayer(result) ||
    result.id.toLowerCase() !== id.toLowerCase()
  )
    throw new SocialApiError("invalid_server_response", response.status);
  return result;
}

const PENDING_FRIEND = "daydle.pendingFriendCode";

export function rememberPendingFriendCode(
  code: string,
  storage?: Storage,
): boolean {
  const valid = normalizeFriendCode(code);
  if (!valid || !storage) return false;
  try {
    storage.setItem(PENDING_FRIEND, valid);
    return true;
  } catch {
    return false;
  }
}
export function takePendingFriendCode(storage?: Storage): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_FRIEND);
    storage.removeItem(PENDING_FRIEND);
    return normalizeFriendCode(raw);
  } catch {
    return null;
  }
}
export function pendingFriendStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
