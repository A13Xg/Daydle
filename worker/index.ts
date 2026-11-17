import { RESULTS_PATH } from "../shared/results";
import {
  handleResultsRequest,
  handleStatisticsRequest,
  type ResultsEnvironment,
} from "./results";
import { HEALTH_PATH } from "../shared/contracts";
import { handleSocialRequest } from "./social";
import { healthResponse } from "./health";

function apiError(
  status: number,
  code: string,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function routeRequest(request: Request): Response {
  const pathname = new URL(request.url).pathname;

  if (pathname === HEALTH_PATH) {
    if (request.method !== "GET") {
      return apiError(405, "method_not_allowed", { allow: "GET" });
    }

    return healthResponse();
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return apiError(404, "not_found");
  }

  return new Response(null, { status: 404 });
}

export default {
  fetch(
    request: Request,
    env: ResultsEnvironment,
  ): Response | Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/social" || path.startsWith("/api/v1/players/")) {
      return handleSocialRequest(request, env);
    }
    if (new URL(request.url).pathname === "/api/v1/statistics") {
      return handleStatisticsRequest(request, env);
    }
    if (new URL(request.url).pathname.startsWith(RESULTS_PATH)) {
      return handleResultsRequest(request, env);
    }
    return routeRequest(request);
  },
};
