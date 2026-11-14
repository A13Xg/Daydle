import {
  HEALTH_PATH,
  isHealthResponse,
  type HealthResponse,
} from "../../shared/contracts";

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(HEALTH_PATH, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error("Health request failed with HTTP " + response.status + ".");
  }

  const payload: unknown = await response.json();

  if (!isHealthResponse(payload)) {
    throw new Error("Health endpoint returned an invalid response.");
  }

  return payload;
}
