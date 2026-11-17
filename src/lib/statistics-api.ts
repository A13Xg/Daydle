import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalStatistics } from "../../shared/statistics";
import { ResultApiError } from "./results-api";

/** Same-origin, owner-scoped, cache-disabled read; no service key in browser. */
export async function loadPersonalStatistics(
  client: SupabaseClient,
  userId: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<PersonalStatistics> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== userId) {
    throw new ResultApiError("authentication_required", 401);
  }
  let response: Response;
  try {
    response = await fetch(
      "/api/v1/statistics?timezone=" + encodeURIComponent(timezone),
      {
        headers: { authorization: "Bearer " + data.session.access_token },
        credentials: "omit",
        cache: "no-store",
        signal,
      },
    );
  } catch {
    throw new ResultApiError("connection_failed", 0);
  }
  if (!response.ok) {
    throw new ResultApiError(
      response.status === 401
        ? "authentication_required"
        : "result_service_unavailable",
      response.status,
    );
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ResultApiError("invalid_server_response", response.status);
  }
  if (
    !result ||
    typeof result !== "object" ||
    !("totalResults" in result) ||
    !("games" in result) ||
    !Array.isArray(result.games) ||
    typeof result.totalResults !== "number"
  ) {
    throw new ResultApiError("invalid_server_response", response.status);
  }
  return result as PersonalStatistics;
}
