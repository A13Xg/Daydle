/**
 * Cross-runtime contracts must remain free of React, Supabase, and Worker-specific imports.
 */
export const HEALTH_PATH = "/api/v1/health" as const;

export interface HealthResponse {
  status: "ok";
  service: "daydle-api";
  version: "v1";
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === "ok" &&
    candidate.service === "daydle-api" &&
    candidate.version === "v1"
  );
}
