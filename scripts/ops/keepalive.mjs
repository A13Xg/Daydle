import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CHECK_PATH = "/rest/v1/games?select=id&limit=1";
const SUPABASE_HOST = /^[a-z0-9-]+\.supabase\.co$/;
const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]+$/;

/**
 * Validate the configured production project, separately from the testable
 * read-only request. This prevents accidentally probing unrelated endpoints.
 */
export function readKeepaliveConfig(env) {
  const urlText = env.SUPABASE_URL;
  if (typeof urlText !== "string" || !urlText) {
    throw new Error("KEEPALIVE_SUPABASE_URL is not configured.");
  }

  let url;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error("KEEPALIVE_SUPABASE_URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    !SUPABASE_HOST.test(url.hostname) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash ||
    url.port
  ) {
    throw new Error("KEEPALIVE_SUPABASE_URL must be a Supabase project HTTPS origin.");
  }

  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (typeof publishableKey !== "string" || !PUBLISHABLE_KEY.test(publishableKey)) {
    throw new Error("KEEPALIVE_SUPABASE_PUBLISHABLE_KEY must be a public publishable key.");
  }

  return { baseUrl: url.origin, publishableKey };
}

/**
 * This is exactly the request used by the scheduled workflow. Injecting a
 * fetch implementation (or a loopback HTTP server) tests the actual method,
 * header and path without contacting a hosted project or exposing keys.
 */
export async function probePublicGames({
  baseUrl,
  publishableKey,
  fetchImpl = fetch,
  onStatus = () => {},
}) {
  const url = new URL(CHECK_PATH, baseUrl);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { apikey: publishableKey, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  onStatus(response.status);
  if (response.status !== 200) {
    const error = new Error("Supabase keep-alive probe returned HTTP " + response.status);
    error.status = response.status;
    throw error;
  }
  return response.status;
}

export async function runKeepalive(env, { fetchImpl = fetch, log = console.log } = {}) {
  const config = readKeepaliveConfig(env);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const status = await probePublicGames({ ...config, fetchImpl });
      log("Supabase public database read succeeded (HTTP " + status + ").");
      return;
    } catch (error) {
      // A wrong API key or bad configuration won't improve on retry. Retry
      // transient network/5xx failures only, never print the response body.
      const permanent = typeof error?.status === "number" &&
        error.status >= 400 && error.status < 500;
      if (permanent || attempt === 3) throw error;
      await new Promise((finish) => setTimeout(finish, 1000 * attempt));
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  runKeepalive(process.env)
    .catch((error) => {
      // Only HTTP status or a sanitized config error; never log key values.
      console.error(error instanceof Error ? error.message : "Keep-alive failed.");
      process.exitCode = 1;
    });
}
