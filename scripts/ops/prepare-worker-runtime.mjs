import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Inject only public Supabase settings into the generated deployment manifest.
 * Service-role credentials are Cloudflare-managed secrets and never enter the
 * build or this file.
 */
export function prepareWorkerRuntime(config, { projectRef, url, publishableKey }) {
  if (
    !config ||
    typeof config !== "object" ||
    config.name !== "daydle-app" ||
    !config.assets?.run_worker_first?.includes("/api/*")
  ) {
    throw new Error("Unexpected generated Worker deployment configuration.");
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) {
    throw new Error("Invalid protected Supabase project reference.");
  }
  if (
    url !== "https://" + projectRef + ".supabase.co" ||
    !/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(publishableKey ?? "")
  ) {
    throw new Error("Public project settings do not match the approved Supabase project.");
  }
  if (
    config.vars?.SUPABASE_URL &&
    config.vars.SUPABASE_URL !== url
  ) {
    throw new Error("Generated Worker configuration targets another Supabase project.");
  }
  return {
    ...config,
    vars: {
      ...(config.vars ?? {}),
      SUPABASE_URL: url,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const path = "dist/worker/wrangler.json";
    const value = prepareWorkerRuntime(JSON.parse(readFileSync(path, "utf8")), {
      projectRef: process.env.SUPABASE_PROJECT_ID,
      url: process.env.VITE_SUPABASE_URL,
      publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
    writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
    console.log("Verified public Supabase Worker bindings in generated deploy config.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Worker preflight failed.");
    process.exitCode = 1;
  }
}
