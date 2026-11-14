import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authCallbackDestination,
  callbackUrl,
  changePassword,
  exchangeAuthCode,
  loginEmail,
  registerEmail,
  sendPasswordRecovery,
  startOAuth,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "../src/lib/auth-actions";

const origin = "https://daydle.example";
const fakeClient = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as SupabaseClient;

describe("auth input and redirect validation", () => {
  it("trims display names and emails but not passwords", () => {
    expect(validateDisplayName("  Alex  ")).toBe("Alex");
    expect(validateEmail("  alex@example.org ")).toBe("alex@example.org");
    expect(validatePassword("password-123")).toBe("password-123");
    expect(() => validateDisplayName(" ")).toThrow();
    expect(() => validateDisplayName("x".repeat(81))).toThrow();
    expect(() => validateEmail("no-address")).toThrow();
    expect(() => validatePassword("short")).toThrow();
  });

  it("uses a fixed, same-origin callback and rejects unsafe origins", () => {
    expect(callbackUrl(origin)).toBe(origin + "/auth/callback");
    expect(callbackUrl(origin, true)).toBe(
      origin + "/auth/callback?flow=recovery",
    );
    expect(callbackUrl("http://localhost:5173")).toBe(
      "http://localhost:5173/auth/callback",
    );
    expect(() => callbackUrl("http://thirdparty.example")).toThrow(
      "secure origin",
    );
    expect(
      authCallbackDestination("?flow=recovery&next=https://evil.example"),
    ).toBe("/account?reset=1");
    expect(authCallbackDestination("?next=https://evil.example")).toBe(
      "/account",
    );
  });
});

describe("Supabase Auth operation contracts", () => {
  it("registers with display-name metadata and preserves email verification", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    const client = fakeClient({ signUp });
    expect(
      await registerEmail(
        client,
        "a@example.org",
        "Password123!",
        "  New Player ",
        origin,
      ),
    ).toBe("verify-email");
    expect(signUp).toHaveBeenCalledWith({
      email: "a@example.org",
      password: "Password123!",
      options: {
        data: { display_name: "New Player" },
        emailRedirectTo: origin + "/auth/callback",
      },
    });
  });

  it("only calls signup when all inputs are valid", async () => {
    const signUp = vi.fn();
    const client = fakeClient({ signUp });
    await expect(
      registerEmail(client, "bad", "okpassword", "Someone", origin),
    ).rejects.toThrow();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("accepts a real login session and rejects missing sessions", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: "private-token" } },
      error: null,
    });
    const client = fakeClient({ signInWithPassword });
    await expect(
      loginEmail(client, " a@example.org ", "pass"),
    ).resolves.toBeUndefined();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.org",
      password: "pass",
    });
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(loginEmail(client, "a@example.org", "pass")).rejects.toThrow(
      "session",
    );
  });

  it("generates recovery redirect and updates password via Supabase Auth only", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = fakeClient({ resetPasswordForEmail, updateUser });
    await sendPasswordRecovery(client, "a@example.org", origin);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@example.org", {
      redirectTo: origin + "/auth/callback?flow=recovery",
    });
    await changePassword(client, "new-password-123");
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
  });

  it("uses Apple/Google PKCE callback without an open redirect", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    const client = fakeClient({ signInWithOAuth });
    const url = await startOAuth(client, "google", origin);
    expect(url).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: origin + "/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    signInWithOAuth.mockResolvedValueOnce({
      data: { url: "javascript:alert(1)" },
      error: null,
    });
    await expect(startOAuth(client, "apple", origin)).rejects.toThrow(
      "unsafe URL",
    );
  });

  it("exchanges authorization codes and propagates errors", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "test-only" } },
      error: null,
    });
    const client = fakeClient({ exchangeCodeForSession });
    await expect(
      exchangeAuthCode(client, "test-code"),
    ).resolves.toBeUndefined();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error("Expired"),
    });
    await expect(exchangeAuthCode(client, "expired")).rejects.toThrow(
      "Expired",
    );
  });
});
