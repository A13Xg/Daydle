import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exchangeCallbackOnce } from "../src/components/AuthCallback";

describe("OAuth callback under React StrictMode", () => {
  it("uses one code exchange for concurrent mounts", async () => {
    let complete!: (value: unknown) => void;
    const pending = new Promise((resolve) => { complete = resolve; });
    const exchangeCodeForSession = vi.fn().mockReturnValue(pending);
    const client = { auth: { exchangeCodeForSession } } as unknown as SupabaseClient;

    const first = exchangeCallbackOnce(client, "auth-code-1");
    const duplicate = exchangeCallbackOnce(client, "auth-code-1");
    expect(duplicate).toBe(first);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);

    complete({ data: { session: { access_token: "fixture" } }, error: null });
    await expect(first).resolves.toBeUndefined();
  });

  it("propagates failed exchanges without falsely producing a session", async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null }, error: new Error("invalid_grant"),
        }),
      },
    } as unknown as SupabaseClient;

    await expect(exchangeCallbackOnce(client, "expired-auth-code")).rejects.toThrow("invalid_grant");
  });
});
