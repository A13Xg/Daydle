import {
  PRIVACY_EXPORT_PATH, PRIVACY_PURGE_CRON, isDataset,
  projectPrivacyRows, validCursor, validPurgeResult,
} from "../shared/privacy";
import {
  authenticate, configuration, errorResponse, isResponse,
  responseJson, rpc, type ResultsEnvironment,
} from "./results";

export async function handlePrivacyRequest(
  request: Request,
  env?: ResultsEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== PRIVACY_EXPORT_PATH)
    return errorResponse("not_found", 404);
  if (request.method !== "GET")
    return errorResponse("method_not_allowed", 405, { allow: "GET" });

  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => !["dataset", "cursor", "limit"].includes(key)) ||
    new Set(keys).size !== keys.length)
    return errorResponse("invalid_export_query", 422);
  const dataset = url.searchParams.get("dataset");
  if (!isDataset(dataset)) return errorResponse("invalid_export_dataset", 422);
  const cursor = url.searchParams.get("cursor");
  if (!validCursor(cursor)) return errorResponse("invalid_export_cursor", 422);
  const limit = url.searchParams.get("limit");
  if (limit !== null &&
    (!/^[1-9][0-9]?$/.test(limit) ||
      Number(limit) > (dataset === "raw" ? 20 : 50)))
    return errorResponse("invalid_export_limit", 422);
  const auth = await authenticate(request, env);
  if (isResponse(auth)) return auth;
  const items = await rpc(auth, "privacy_export_page", {
    p_user: auth.userId,
    p_dataset: dataset,
    p_cursor: cursor,
    p_limit: limit === null ? (dataset === "raw" ? 20 : 50) : Number(limit),
  });
  if (isResponse(items)) return items;
  const safe = projectPrivacyRows(dataset, items, cursor);
  if (!safe) return errorResponse("privacy_service_unavailable", 503);
  return responseJson({ dataset, items: safe });
}

/** The only scheduled maintenance entry point; no public HTTP bypass. */
export async function purgeExpiredRawSamples(
  cron: string,
  env?: ResultsEnvironment,
): Promise<number> {
  if (cron !== PRIVACY_PURGE_CRON)
    throw new Error("unexpected_privacy_schedule");
  const config = configuration(env);
  if (!config) throw new Error("privacy_purge_configuration_unavailable");
  const result = await rpc(config, "privacy_purge_expired_raw", {});
  if (isResponse(result) || !validPurgeResult(result))
    throw new Error("privacy_purge_service_unavailable");
  console.info("privacy_purge_completed", { deleted: result.deleted });
  return result.deleted;
}
