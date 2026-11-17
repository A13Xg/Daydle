import {
  SOCIAL_PATH,
  normalizeFriendCode,
  validPublicPlayer,
  validSocialNetwork,
  validSocialMutation,
} from "../shared/social";
import { RESULT_ID_PATTERN } from "../shared/results";
import {
  authenticate,
  boundedJson,
  errorResponse,
  isResponse,
  publicProfileLookup,
  responseJson,
  rpc,
  type ResultsEnvironment,
} from "./results";

/** Public identity only; current puzzle performance must wait for Phase 10. */
export async function handleSocialRequest(
  request: Request,
  env?: ResultsEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const profileId = url.pathname.match(
    /^\/api\/v1\/players\/([0-9a-f-]{36})$/i,
  )?.[1];
  const mine = url.pathname === SOCIAL_PATH;
  if (!mine && !profileId) return errorResponse("not_found", 404);
  if (profileId) {
    if (request.method !== "GET")
      return errorResponse("method_not_allowed", 405, { allow: "GET" });
    if (!RESULT_ID_PATTERN.test(profileId))
      return errorResponse("not_found", 404);
    const result = await publicProfileLookup(env, profileId);
    if (isResponse(result)) return result;
    if (result === null) return errorResponse("not_found", 404);
    if (
      !validPublicPlayer(result) ||
      result.id.toLowerCase() !== profileId.toLowerCase()
    )
      return errorResponse("social_service_unavailable", 503);
    return responseJson({
      id: result.id,
      display_name: result.display_name,
      created_at: result.created_at,
      games: result.games.map((g) => ({ slug: g.slug, name: g.name })),
    });
  }

  if (request.method !== "GET" && request.method !== "POST")
    return errorResponse("method_not_allowed", 405, { allow: "GET, POST" });
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin)
      return errorResponse("origin_rejected", 403);
  }

  const auth = await authenticate(request, env);
  if (isResponse(auth)) return auth;
  if (request.method === "GET") {
    const value = await rpc(auth, "social_my_network", { p_user: auth.userId });
    if (isResponse(value)) return value;
    if (!validSocialNetwork(value))
      return errorResponse("social_service_unavailable", 503);
    return responseJson({
      code: value.code,
      friends: value.friends.map(({ id, display_name }) => ({
        id,
        display_name,
      })),
      blocked: value.blocked.map(({ id, display_name }) => ({
        id,
        display_name,
      })),
      has_more_friends: value.has_more_friends,
    });
  }
  const body = await boundedJson(request);
  if (isResponse(body)) return body;
  let method: string;
  let payload: Record<string, unknown>;
  if (body.action === "connect") {
    const code = normalizeFriendCode(body.code);
    if (!code) return errorResponse("invalid_friend_code", 422);
    method = "social_connect_by_code";
    payload = { p_user: auth.userId, p_code: code };
  } else if (body.action === "regenerate") {
    method = "social_regenerate_code";
    payload = { p_user: auth.userId };
  } else if (["unfriend", "block", "unblock"].includes(String(body.action))) {
    if (
      typeof body.targetId !== "string" ||
      !RESULT_ID_PATTERN.test(body.targetId)
    )
      return errorResponse("invalid_target", 422);
    method = "social_change_relation";
    payload = {
      p_user: auth.userId,
      p_other: body.targetId,
      p_action: body.action,
    };
  } else {
    return errorResponse("invalid_social_action", 422);
  }
  const value = await rpc(auth, method, payload);
  if (isResponse(value)) return value;
  if (!validSocialMutation(value))
    return errorResponse("social_service_unavailable", 503);
  const status =
    value.status === "rate_limited"
      ? 429
      : ["invalid_code", "invalid_action"].includes(value.status)
        ? 422
        : ["not_found", "unavailable"].includes(value.status)
          ? 404
          : value.status === "self"
            ? 409
            : 200;
  return responseJson(
    {
      status: value.status,
      ...(value.friend
        ? {
            friend: {
              id: value.friend.id,
              display_name: value.friend.display_name,
            },
          }
        : {}),
      ...(value.code ? { code: value.code } : {}),
    },
    status,
  );
}
