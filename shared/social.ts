import { RESULT_ID_PATTERN } from "./results";

export const SOCIAL_PATH = "/api/v1/social";
export const FRIEND_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export type SocialAction =
  "connect" | "regenerate" | "unfriend" | "block" | "unblock";
export type FriendState =
  | "connected"
  | "already_connected"
  | "self"
  | "not_found"
  | "invalid_code"
  | "unavailable"
  | "rate_limited"
  | "unfriended"
  | "already_unfriended"
  | "blocked"
  | "unblocked"
  | "regenerated";

export interface PublicPlayer {
  id: string;
  display_name: string;
  created_at: string;
  games: { slug: string; name: string }[];
}
export interface SocialPerson {
  id: string;
  display_name: string;
}
export interface SocialNetwork {
  code: string;
  friends: SocialPerson[];
  blocked: SocialPerson[];
  has_more_friends: boolean;
}
export interface SocialMutation {
  status: FriendState;
  friend?: SocialPerson;
  code?: string;
}

export function normalizeFriendCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return FRIEND_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function playerPath(id: string): string | null {
  return RESULT_ID_PATTERN.test(id) ? "/players/" + id.toLowerCase() : null;
}

export function connectionLink(code: string, origin: string): string | null {
  const normalized = normalizeFriendCode(code);
  if (!normalized) return null;
  try {
    const base = new URL(origin);
    if (
      base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
      )
    )
      return null;
    const url = new URL("/friends", base);
    url.searchParams.set("code", normalized);
    return url.toString();
  } catch {
    return null;
  }
}

export function validPublicPlayer(value: unknown): value is PublicPlayer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<PublicPlayer>;
  return (
    typeof v.id === "string" &&
    RESULT_ID_PATTERN.test(v.id) &&
    typeof v.display_name === "string" &&
    v.display_name.length <= 80 &&
    typeof v.created_at === "string" &&
    Array.isArray(v.games) &&
    v.games.length <= 100 &&
    v.games.every(
      (g) =>
        !!g &&
        typeof g.slug === "string" &&
        /^[a-z][a-z0-9-]{1,63}$/.test(g.slug) &&
        typeof g.name === "string" &&
        g.name.length <= 120,
    )
  );
}

function validSocialPerson(value: unknown): value is SocialPerson {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof value.id === "string" &&
    RESULT_ID_PATTERN.test(value.id) &&
    "display_name" in value &&
    typeof value.display_name === "string" &&
    value.display_name.length <= 80
  );
}

export function validSocialNetwork(value: unknown): value is SocialNetwork {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<SocialNetwork>;
  return (
    typeof v.code === "string" &&
    FRIEND_CODE_PATTERN.test(v.code) &&
    Array.isArray(v.friends) &&
    v.friends.length <= 200 &&
    v.friends.every(validSocialPerson) &&
    Array.isArray(v.blocked) &&
    v.blocked.length <= 200 &&
    v.blocked.every(validSocialPerson) &&
    typeof v.has_more_friends === "boolean"
  );
}

export function validSocialMutation(value: unknown): value is SocialMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<SocialMutation>;
  return (
    !!v.status &&
    [
      "connected",
      "already_connected",
      "self",
      "not_found",
      "invalid_code",
      "unavailable",
      "rate_limited",
      "unfriended",
      "already_unfriended",
      "blocked",
      "unblocked",
      "regenerated",
    ].includes(v.status) &&
    (v.friend === undefined || validSocialPerson(v.friend)) &&
    (v.code === undefined ||
      (typeof v.code === "string" && FRIEND_CODE_PATTERN.test(v.code)))
  );
}
