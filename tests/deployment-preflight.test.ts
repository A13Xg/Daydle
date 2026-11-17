import { describe, expect, it } from "vitest";
import { prepareWorkerRuntime } from "../scripts/ops/prepare-worker-runtime.mjs";
import { hasRequiredWorkerSecrets } from "../scripts/ops/check-worker-secrets.mjs";

const sample = {
  name: "daydle-app",
  assets: { run_worker_first: ["/api/*"] },
};
const options = {
  projectRef: "abcdefghijklmnopqrst",
  url: "https://abcdefghijklmnopqrst.supabase.co",
  publishableKey: "sb_publishable_synthetic_public_key",
};
describe("protected Daydle Worker release preflight", () => {
  it("injects only public runtime settings and preserves build configuration", () => {
    const configured = prepareWorkerRuntime(sample, options);
    expect(configured.vars).toEqual({
      SUPABASE_URL: options.url,
      SUPABASE_PUBLISHABLE_KEY: options.publishableKey,
    });
    expect(configured.assets).toEqual(sample.assets);
    expect(JSON.stringify(configured)).not.toContain("SERVICE_ROLE");
    expect(sample).not.toHaveProperty("vars");
  });
  it("rejects incorrect project, secret-like public values or broken routing", () => {
    expect(() =>
      prepareWorkerRuntime(sample, {
        ...options,
        url: "https://another.supabase.co",
      }),
    ).toThrow();
    expect(() =>
      prepareWorkerRuntime(sample, {
        ...options,
        publishableKey: "sb_secret_invalid",
      }),
    ).toThrow();
    expect(() =>
      prepareWorkerRuntime({ ...sample, assets: {} }, options),
    ).toThrow();
    expect(() =>
      prepareWorkerRuntime(
        { ...sample, vars: { SUPABASE_URL: "https://other.supabase.co" } },
        options,
      ),
    ).toThrow();
  });
  it("checks only required secret binding names; no secret values needed", () => {
    expect(
      hasRequiredWorkerSecrets(
        '[{"name":"SUPABASE_SERVICE_ROLE_KEY","type":"secret_text"}]',
      ),
    ).toBe(true);
    expect(
      hasRequiredWorkerSecrets(
        '[{"name":"SUPABASE_SECRET_KEY","type":"secret_text"}]',
      ),
    ).toBe(false);
    expect(
      hasRequiredWorkerSecrets(
        '[{"name":"SUPABASE_SERVICE_ROLE_KEY","type":"plain_text"}]',
      ),
    ).toBe(false);
    expect(hasRequiredWorkerSecrets("<html>not JSON</html>")).toBe(false);
  });
});
