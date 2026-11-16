import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthPage } from "../src/components/AuthPage";
import { AccountPage } from "../src/components/AccountPage";
import { AuthCallback } from "../src/components/AuthCallback";

afterEach(() => {
  vi.unstubAllGlobals();
});

function withBrowserLocation<T>(search: string, run: () => T): T {
  vi.stubGlobal("window", { location: { search } });
  return run();
}

const renderAuth = (search: string, props = {}) =>
  withBrowserLocation(search, () =>
    renderToStaticMarkup(
      createElement(AuthPage, { client: null, signedIn: false, ...props }),
    ),
  );

describe("auth page", () => {
  it("offers Apple and Google only, with no email or password form", () => {
    const markup = renderAuth("");
    expect(markup).toContain("Master Your Daily Ritual.");
    expect(markup).toContain("Daydle");
    expect(markup).toContain("ARCADE");
    expect(markup).toContain("Sign in with Apple");
    expect(markup.match(/class="provider-mark"/g)).toHaveLength(2);
    expect(markup).toContain("Your daily puzzles");
    expect(markup).toContain("Continue with Google");
    expect(markup).not.toContain('type="email"');
    expect(markup).not.toContain('type="password"');
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Forgot password");
    expect(markup).not.toContain("Create your account");
  });

  it("disables the provider buttons and explains when auth is unconfigured", () => {
    const markup = renderAuth("");
    expect(markup).toContain("Authentication is not configured");
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });

  it("exposes the provider choices as a labelled group of real buttons", () => {
    const markup = renderAuth("");
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Sign-in options"');
    expect(markup.match(/<button[^>]*type="button"/g)).toHaveLength(2);
  });

  it("discloses that the provider name becomes a public display name", () => {
    const markup = renderAuth("");
    expect(markup).toContain("becomes your public display name");
    expect(markup).toContain("Your email is never shown");
    expect(markup).not.toContain('name="friendCode"');
  });

  it("ignores old email-mode links and still shows the provider page", () => {
    for (const search of ["?mode=signup", "?mode=recover"]) {
      const markup = renderAuth(search);
      expect(markup).toContain("Continue with Google");
      expect(markup).not.toContain("Display name");
    }
  });

  it("points signed-in visitors to their account instead of sign-in buttons", () => {
    const markup = renderAuth("", { signedIn: true });
    expect(markup).toContain("You are signed in");
    expect(markup).toContain('href="/account"');
    expect(markup).not.toContain("Continue with");
  });
});

describe("account interaction surfaces", () => {
  it("provides explicit unauthenticated and callback failure states", () => {
    const account = withBrowserLocation("", () =>
      renderToStaticMarkup(
        createElement(AccountPage, {
          client: null,
          user: null,
          loadingSession: false,
        }),
      ),
    );
    expect(account).toContain("Authentication is not configured");

    const callback = withBrowserLocation("", () =>
      renderToStaticMarkup(createElement(AuthCallback, { client: null })),
    );
    expect(callback).toContain("Contact the site administrator");
  });
});
