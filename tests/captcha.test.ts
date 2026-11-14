import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readTurnstileSiteKey } from "../src/lib/captcha";
import {
  loginEmail,
  registerEmail,
  sendPasswordRecovery,
} from "../src/lib/auth-actions";
import { AuthPage } from "../src/components/AuthPage";

const origin = "https://daydle.example";
const siteKey = "0xEXAMPLEexampleSiteKey123";
const fakeClient = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as SupabaseClient;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Turnstile site key configuration", () => {
  it("is optional so the app still renders without a CAPTCHA", () => {
    expect(readTurnstileSiteKey({})).toBeNull();
    expect(readTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: "  " })).toBeNull();
  });

  it("accepts real and documented test site keys", () => {
    expect(readTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: siteKey })).toBe(
      siteKey,
    );
    expect(
      readTurnstileSiteKey({
        VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      }),
    ).toBe("1x00000000000000000000AA");
  });

  it("rejects values that are not site keys, such as secrets or garbage", () => {
    for (const value of [
      "0x4AAAAAAA short",
      "sb_secret_1234",
      "<script>alert(1)</script>",
      "x",
    ]) {
      expect(
        readTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: value }),
      ).toBeNull();
    }
  });
});

describe("CAPTCHA token pass-through to Supabase Auth", () => {
  it("sends the token on sign-up, sign-in and recovery", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: { x: 1 } }, error: null });
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ data: { session: { x: 1 } }, error: null });
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const client = fakeClient({
      signUp,
      signInWithPassword,
      resetPasswordForEmail,
    });

    expect(
      await registerEmail(
        client,
        "a@example.org",
        "Password123!",
        "Player",
        origin,
        "token-1",
      ),
    ).toBe("signed-in");
    expect(signUp.mock.calls[0]?.[0].options.captchaToken).toBe("token-1");

    await loginEmail(client, "a@example.org", "pass", "token-2");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.org",
      password: "pass",
      options: { captchaToken: "token-2" },
    });

    await sendPasswordRecovery(client, "a@example.org", origin, "token-3");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@example.org", {
      redirectTo: origin + "/auth/callback?flow=recovery",
      captchaToken: "token-3",
    });
  });

  it("omits captchaToken entirely when none is supplied", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    await registerEmail(
      fakeClient({ signUp }),
      "a@example.org",
      "Password123!",
      "Player",
      origin,
    );
    expect(signUp.mock.calls[0]?.[0].options).not.toHaveProperty(
      "captchaToken",
    );
  });

  it("surfaces a rejected CAPTCHA instead of treating it as success", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("captcha verification process failed"),
    });
    await expect(
      registerEmail(
        fakeClient({ signUp }),
        "a@example.org",
        "Password123!",
        "Player",
        origin,
        "bad-token",
      ),
    ).rejects.toThrow("captcha");
  });
});

describe("auth form with CAPTCHA", () => {
  const render = (props: Record<string, unknown>) => {
    vi.stubGlobal("window", { location: { search: "?mode=signup" } });
    return renderToStaticMarkup(
      createElement(AuthPage, { client: null, signedIn: false, ...props }),
    );
  };

  it("renders the challenge container when a site key is configured", () => {
    expect(render({ captchaSiteKey: siteKey })).toContain('class="captcha"');
  });

  it("renders no challenge container without a site key", () => {
    expect(render({})).not.toContain("captcha");
  });
});
