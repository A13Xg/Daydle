import type { HealthResponse } from "../shared/contracts";

export function healthResponse(): Response {
  const body: HealthResponse = {
    status: "ok",
    service: "daydle-api",
    version: "v1",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
