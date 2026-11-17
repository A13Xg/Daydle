import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const BASE_URL = "https://daydle.agoodman.io";
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_ATTEMPTS = 16;
const RETRY_DELAY_MS = 7500;

export function assertWorkerRouting(config) {
  const routes = config?.assets?.run_worker_first;
  if (!Array.isArray(routes) || !routes.includes("/api/*")) {
    throw new Error(
      "Built Worker configuration does not route /api/* to the Worker first.",
    );
  }
  if (config.assets.not_found_handling !== "single-page-application") {
    throw new Error("Built Worker configuration has no SPA shell fallback.");
  }
}

function responseType(response) {
  return response.headers.get("content-type") ?? "(missing)";
}

async function checkJson(response, validate, label) {
  if (response.status !== 200) {
    return `${label}: HTTP ${response.status}, expected 200`;
  }
  if (
    !/\b(?:application\/json|application\/manifest\+json)\b/i.test(
      responseType(response),
    )
  ) {
    return `${label}: HTTP 200 but content-type ${responseType(response)}, expected JSON`;
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return `${label}: JSON body could not be parsed`;
  }
  return validate(payload)
    ? null
    : `${label}: JSON data did not match the release contract`;
}

export async function inspectHealth(response) {
  return checkJson(
    response,
    (value) =>
      value &&
      value.status === "ok" &&
      value.service === "daydle-api" &&
      value.version === "v1",
    "health",
  );
}

export async function inspectMissingApi(response) {
  if (
    response.status !== 404 ||
    !/\bapplication\/json\b/i.test(responseType(response))
  ) {
    return `unknown API: HTTP ${response.status}, content-type ${responseType(response)}, expected JSON 404`;
  }
  try {
    return (await response.json()).error === "not_found"
      ? null
      : "unknown API: unexpected 404 JSON contract";
  } catch {
    return "unknown API: 404 JSON parsing failed";
  }
}

export async function inspectSocialAuthBoundary(response) {
  if (response.status !== 401 || !/\bapplication\/json\b/i.test(responseType(response))) {
    return `social auth: HTTP ${response.status}, expected JSON 401`;
  }
  try {
    const payload = await response.json();
    return payload?.error === "authentication_required" ? null : "social auth: unexpected response";
  } catch {
    return "social auth: invalid JSON";
  }
}

export async function inspectPublicPlayerAbsent(response) {
  if (response.status === 503 && /\bapplication\/json\b/i.test(responseType(response))) {
    try {
      const code = (await response.json())?.error;
      if (code === "service_unavailable")
        return "public player: HTTP 503, missing/invalid Worker runtime configuration or encrypted service-role binding";
      if (code === "result_service_unavailable")
        return "public player: HTTP 503, Supabase privileged RPC rejected/unavailable; verify the legacy service-role JWT and project";
      if (code === "social_service_unavailable")
        return "public player: HTTP 503, unexpected safe public-profile RPC result";
    } catch {
      // Do not print arbitrary response bodies or provider errors.
    }
  }
  if (response.status !== 404 || !/\bapplication\/json\b/i.test(responseType(response))) {
    return `public player: HTTP ${response.status}, expected JSON 404`;
  }
  try {
    const payload = await response.json();
    return payload?.error === "not_found" ? null : "public player: unexpected response";
  } catch {
    return "public player: invalid JSON";
  }
}

export async function inspectManifest(response) {
  return checkJson(
    response,
    (value) =>
      value &&
      value.start_url === "/today" &&
      value.display === "standalone" &&
      Array.isArray(value.icons) &&
      value.icons.some((icon) => icon.purpose === "maskable"),
    "PWA manifest",
  );
}

export async function inspectServiceWorker(response, expectedSource) {
  if (
    response.status !== 200 ||
    !/(?:javascript|ecmascript)/i.test(responseType(response))
  ) {
    return `service worker: HTTP ${response.status}, content-type ${responseType(response)}`;
  }
  const actual = await response.text();
  if (!/daydle-shell-[a-f0-9]{16}/.test(actual) ||
      actual.includes("__DAYDLE_PWA_CONFIG__")) {
    return "service worker: invalid or unconfigured deployed script";
  }
  if (expectedSource !== undefined && actual !== expectedSource) {
    return "service worker: deployed version differs from current build";
  }
  return null;
}

export async function inspectIcon(response, size) {
  if (response.status !== 200 || !/image\/png/i.test(responseType(response))) {
    return `icon ${size}: HTTP ${response.status}, content-type ${responseType(response)}`;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(PNG_MAGIC) ||
    buffer.readUInt32BE(16) !== size ||
    buffer.readUInt32BE(20) !== size
  ) {
    return `icon ${size}: invalid PNG signature or dimensions`;
  }
  return null;
}

export async function inspectPage(response, path) {
  if (response.status !== 200 || !/text\/html/i.test(responseType(response))) {
    return `${path}: HTTP ${response.status}, content-type ${responseType(response)}`;
  }
  const html = await response.text();
  return /<html\b/i.test(html) && /Daydle/.test(html)
    ? null
    : `${path}: invalid application shell`;
}

export async function waitForEndpoint(
  url,
  inspect,
  {
    fetchImpl = fetch,
    pause = sleep,
    attempts = MAX_ATTEMPTS,
    delayMs = RETRY_DELAY_MS,
    log = console.log,
  } = {},
) {
  let last = "no response";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(15000),
      });
      last = (await inspect(response)) ?? "";
      if (!last) {
        log(
          `PASS: ${new URL(url).pathname} has expected response (attempt ${attempt})`,
        );
        return;
      }
    } catch {
      last = "request unavailable or invalid response";
    }

    // Do not log response bodies, secrets, OAuth query strings or headers.
    if (attempt < attempts) {
      log(`Waiting for release propagation (${attempt}/${attempts}): ${last}`);
      await pause(delayMs);
    }
  }
  throw new Error(
    `Live release check failed after ${attempts} attempts: ${last}`,
  );
}

export async function verifyLiveRelease({
  base = BASE_URL,
  expectedServiceWorker,
  fetchImpl = fetch,
  pause = sleep,
  attempts = MAX_ATTEMPTS,
  delayMs = RETRY_DELAY_MS,
  log = console.log,
} = {}) {
  const checks = [
    ["/api/v1/health", inspectHealth],
    ["/api/v1/not-found", inspectMissingApi],
    ["/api/v1/social", inspectSocialAuthBoundary],
    ["/api/v1/players/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", inspectPublicPlayerAbsent],
    ["/app.webmanifest", inspectManifest],
    [
      "/sw.js",
      (response) => inspectServiceWorker(response, expectedServiceWorker),
    ],
    ["/today", (response) => inspectPage(response, "/today")],
    ["/games", (response) => inspectPage(response, "/games")],
    ["/friends", (response) => inspectPage(response, "/friends")],
    ["/icons/icon-192.png", (response) => inspectIcon(response, 192)],
    ["/icons/icon-512.png", (response) => inspectIcon(response, 512)],
    ["/icons/apple-touch-icon.png", (response) => inspectIcon(response, 180)],
  ];
  for (const [path, inspect] of checks) {
    await waitForEndpoint(new URL(path, base).toString(), inspect, {
      fetchImpl,
      pause,
      attempts,
      delayMs,
      log,
    });
  }
  log(
    "Verified: hosted API, current service worker version, PWA assets and routes.",
  );
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invoked === import.meta.url) {
  try {
    const config = JSON.parse(
      readFileSync("dist/worker/wrangler.json", "utf8"),
    );
    assertWorkerRouting(config);
    if (process.argv.includes("--routing-only")) {
      console.log(
        "PASS: generated Worker routes API requests before SPA assets.",
      );
    } else {
      await verifyLiveRelease({
        // CI public probes have no VITE_* values and therefore produce
        // different hashed assets than the protected production build.
        // Production release MUST compare the exact built SW version.
        expectedServiceWorker: process.argv.includes("--public-only")
          ? undefined
          : readFileSync("dist/client/sw.js", "utf8"),
      });
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Live release verification failed.",
    );
    process.exitCode = 1;
  }
}
