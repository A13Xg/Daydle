import { fileURLToPath } from "node:url";

/**
 * Verify a Cloudflare Worker runtime secret by reading metadata only.
 * Never print token, response body, secret names other than the required binding,
 * or any secret value. This runs exclusively in the approved production job.
 */
export const REQUIRED_WORKER_SECRET = "SUPABASE_SERVICE_ROLE_KEY";
export const WORKER_NAME = "daydle-app";

export class WorkerSecretPreflightError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkerSecretPreflightError";
    this.code = code;
  }
}

export function hasRequiredWorkerSecrets(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed?.success === true && Array.isArray(parsed.result)
        ? parsed.result
        : null;
    return (
      Array.isArray(entries) &&
      entries.some(
        (entry) =>
          entry?.name === REQUIRED_WORKER_SECRET &&
          entry.type === "secret_text",
      )
    );
  } catch {
    return false;
  }
}

export function inspectWorkerSecretMetadata(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.success !== true ||
    !Array.isArray(payload.result)
  ) {
    throw new WorkerSecretPreflightError(
      "invalid_response",
      "Cloudflare returned invalid secret metadata. No deployment attempted.",
    );
  }

  const binding = payload.result.find(
    (entry) => entry && entry.name === REQUIRED_WORKER_SECRET,
  );
  if (!binding) {
    throw new WorkerSecretPreflightError(
      "missing_binding",
      "Cloudflare Worker daydle-app exists, but required encrypted binding " +
        REQUIRED_WORKER_SECRET +
        " is absent. Configure it as a Worker secret before deploying.",
    );
  }
  if (binding.type !== "secret_text") {
    throw new WorkerSecretPreflightError(
      "wrong_binding_type",
      REQUIRED_WORKER_SECRET +
        " exists but is not a secret_text binding. A plain-text variable is forbidden.",
    );
  }
  return true;
}

export async function verifyCloudflareWorkerSecret({
  accountId,
  apiToken,
  workerName = WORKER_NAME,
  fetchImpl = fetch,
}) {
  if (
    typeof accountId !== "string" ||
    !/^[a-f0-9]{32}$/i.test(accountId) ||
    typeof apiToken !== "string" ||
    apiToken.length === 0 ||
    workerName !== WORKER_NAME
  ) {
    throw new WorkerSecretPreflightError(
      "invalid_configuration",
      "Protected Cloudflare credentials, account ID or Worker target are missing/invalid.",
    );
  }

  const endpoint =
    "https://api.cloudflare.com/client/v4/accounts/" +
    accountId +
    "/workers/scripts/" +
    workerName +
    "/secrets";

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: "Bearer " + apiToken,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new WorkerSecretPreflightError(
      "lookup_failed",
      "Cannot reach Cloudflare's Worker secret metadata API. " +
        "Check network access and Cloudflare status; deployment remains blocked.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new WorkerSecretPreflightError(
      "permission_denied",
      "Cloudflare secret metadata lookup returned HTTP " +
        response.status +
        ". Verify the production API token permits Workers Scripts Read/Write " +
        "for the correct account.",
    );
  }
  if (response.status === 404) {
    throw new WorkerSecretPreflightError(
      "worker_not_found",
      "Cloudflare returned HTTP 404 for Worker daydle-app. " +
        "Verify the account/target and create the Worker with its encrypted " +
        "service-role binding through an authorized setup before deployment.",
    );
  }
  if (!response.ok) {
    throw new WorkerSecretPreflightError(
      "lookup_failed",
      "Cloudflare secret metadata lookup returned HTTP " +
        response.status +
        ". No deployment attempted.",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new WorkerSecretPreflightError(
      "invalid_response",
      "Cloudflare returned a non-JSON secret metadata response. No deployment attempted.",
    );
  }
  return inspectWorkerSecretMetadata(data);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await verifyCloudflareWorkerSecret({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    });
    console.log(
      "Verified required Cloudflare Worker encrypted secret binding.",
    );
  } catch (error) {
    const safeError =
      error instanceof WorkerSecretPreflightError
        ? error
        : new WorkerSecretPreflightError(
            "unexpected",
            "Cloudflare secret preflight failed. Deployment blocked.",
          );
    console.error(
      "Cloudflare preflight [" + safeError.code + "]: " + safeError.message,
    );
    process.exitCode = 1;
  }
}
