import { describe, expect, it, vi } from "vitest";
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


import {
  WorkerSecretPreflightError,
  inspectWorkerSecretMetadata,
  verifyCloudflareWorkerSecret,
} from "../scripts/ops/check-worker-secrets.mjs";

const workerSecretMetadata = {
  success: true,
  result: [
    { name: "SUPABASE_SERVICE_ROLE_KEY", type: "secret_text" },
  ],
};
const checkedAccount = "1234567890abcdef1234567890abcdef";
const checkedToken = "synthetic-unit-test-token";

describe("Cloudflare protected runtime secret lookup", () => {
  it("verifies exactly the required encrypted binding by metadata, never its value", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ...workerSecretMetadata, extra: "ignored" }));
    expect(
      await verifyCloudflareWorkerSecret({
        accountId: checkedAccount,
        apiToken: checkedToken,
        fetchImpl,
      }),
    ).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/" +
      checkedAccount +
      "/workers/scripts/daydle-app/secrets",
    );
    expect(options.method).toBe("GET");
    expect(options.redirect).toBe("error");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer " + checkedToken,
    });
  });

  it("distinguishes missing secret, wrong binding type, and invalid metadata", () => {
    const cases = [
      [{ success: true, result: [] }, "missing_binding"],
      [{ success: true, result: [{ name: "SUPABASE_SERVICE_ROLE_KEY", type: "plain_text" }] }, "wrong_binding_type"],
      [{ success: false, result: [] }, "invalid_response"],
      [{ success: true, result: "not an array" }, "invalid_response"],
    ] as const;
    for (const [payload, code] of cases) {
      try {
        inspectWorkerSecretMetadata(payload);
        expect.fail("Should reject " + code);
      } catch (error) {
        expect(error).toBeInstanceOf(WorkerSecretPreflightError);
        expect((error as WorkerSecretPreflightError).code).toBe(code);
      }
    }
  });

  it.each([
    [401, "permission_denied"],
    [403, "permission_denied"],
    [404, "worker_not_found"],
    [500, "lookup_failed"],
  ] as const)("reports Cloudflare HTTP %i distinctly (%s)", async (http, code) => {
    await expect(
      verifyCloudflareWorkerSecret({
        accountId: checkedAccount,
        apiToken: checkedToken,
        fetchImpl: vi.fn(async () => new Response(null, { status: http })),
      }),
    ).rejects.toMatchObject({ code });
  });

  it("rejects network failures, JSON corruption and invalid local credentials", async () => {
    await expect(
      verifyCloudflareWorkerSecret({
        accountId: checkedAccount,
        apiToken: checkedToken,
        fetchImpl: vi.fn(async () => { throw new Error("fake API error"); }),
      }),
    ).rejects.toMatchObject({ code: "lookup_failed" });
    await expect(
      verifyCloudflareWorkerSecret({
        accountId: checkedAccount,
        apiToken: checkedToken,
        fetchImpl: vi.fn(async () => new Response("<html>", { status: 200 })),
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const forbiddenFetch = vi.fn();
    await expect(
      verifyCloudflareWorkerSecret({
        accountId: "wrong",
        apiToken: checkedToken,
        fetchImpl: forbiddenFetch,
      }),
    ).rejects.toMatchObject({ code: "invalid_configuration" });
    expect(forbiddenFetch).not.toHaveBeenCalled();
  });

  it("never includes the Cloudflare token or arbitrary provider body in its error", async () => {
    const secret = "do-not-log-this-synthetic-token";
    try {
      await verifyCloudflareWorkerSecret({
        accountId: checkedAccount,
        apiToken: secret,
        fetchImpl: vi.fn(async () =>
          new Response('{"errors":[{"message":"private-value"}]}', { status: 403 })),
      });
    } catch (error) {
      const message = String(error);
      expect(message).not.toContain(secret);
      expect(message).not.toContain("private-value");
    }
  });
});
