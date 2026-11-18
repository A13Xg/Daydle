// Credential-free, read-only beta route preflight.
// Live network calls happen ONLY with the explicit --live argument.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const BETA_ORIGIN = "https://daydle.agoodman.io";

const CASES = Object.freeze([
  { path: "/api/v1/health", type: "health" },
  { path: "/api/v1/not-found", type: "not-found" },
  { path: "/api/v1/admin?view=overview", type: "private" },
  { path: "/api/v1/privacy/export?dataset=profile", type: "private" },
  { path: "/api/v1/requests?limit=1", type: "requests" },
  { path: "/privacy", type: "page" },
]);

function isJson(response) {
  return /\bapplication\/json\b/i.test(response.headers.get("content-type") ?? "");
}

async function responseMatches(response, type) {
  if (type === "page") {
    if (response.status !== 200 ||
      !/\btext\/html\b/i.test(response.headers.get("content-type") ?? ""))
      return false;
    const html = await response.text();
    return /<html\b/i.test(html) && /Daydle/i.test(html);
  }
  if (!isJson(response)) return false;
  if (type === "private" && response.status !== 401) return false;
  if (type === "requests" && response.status !== 200) return false;
  if (type === "health" && response.status !== 200) return false;
  if (type === "not-found" && response.status !== 404) return false;
  const value = await response.json();
  if (type === "health")
    return value && value.service === "daydle-api" &&
      value.status === "ok" && value.version === "v1";
  if (type === "not-found")
    return value && value.error === "not_found";
  if (type === "private")
    return value && value.error === "authentication_required" &&
      /\bno-store\b/i.test(response.headers.get("cache-control") ?? "");
  if (type === "requests")
    return Array.isArray(value) && value.length <= 1 &&
      /\bno-store\b/i.test(response.headers.get("cache-control") ?? "") &&
      /authorization/i.test(response.headers.get("vary") ?? "") &&
      value.every((item) => (
        item && typeof item.id === "string" &&
        ["pending", "approved"].includes(item.status) &&
        typeof item.name === "string" &&
        !("raw_share_text" in item) && !("email" in item)
      ));
  return false;
}

export async function runPublicBetaPreflight({
  base = BETA_ORIGIN,
  fetchImpl = fetch,
} = {}) {
  const target = new URL(base);
  if (target.protocol !== "https:" || target.pathname !== "/" ||
      target.search || target.hash || target.username || target.password)
    throw new Error("Public beta origin must be a bare HTTPS origin.");

  const checks = [];
  for (const item of CASES) {
    let passed = false;
    try {
      const response = await fetchImpl(new URL(item.path, target).toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(15_000),
      });
      passed = await responseMatches(response, item.type);
    } catch {
      // Never echo upstream body, URL query params, provider messages or tokens.
    }
    checks.push({ path: item.path.split("?")[0], type: item.type, passed });
  }
  return {
    passed: checks.every((entry) => entry.passed),
    checks,
  };
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invoked === import.meta.url) {
  if (!process.argv.includes("--live")) {
    console.error(
      "No request made. Use --live to run credential-free GET probes against the public beta origin.",
    );
    process.exitCode = 2;
  } else {
    try {
      const report = await runPublicBetaPreflight();
      for (const item of report.checks) {
        console.log(`${item.passed ? "PASS" : "FAIL"} ${item.path} (${item.type})`);
      }
      if (!report.passed) process.exitCode = 1;
      console.log(
        "These public checks do NOT verify hosted migrations, OAuth, administrator membership, backups, PWA on-device or beta approval.",
      );
    } catch {
      console.error("Public beta preflight failed without exposing any response content.");
      process.exitCode = 1;
    }
  }
}
