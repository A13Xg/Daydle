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

describe("account interaction surfaces", () => {
  it("renders semantic sign-in and OAuth options when Supabase isn't configured", () => {
    const markup = withBrowserLocation("", () =>
      renderToStaticMarkup(
        createElement(AuthPage, { client: null, signedIn: false }),
      ),
    );
    expect(markup).toContain("Sign in to Daydle");
    expect(markup).toContain("Authentication is not configured");
    expect(markup).toContain('type="email"');
    expect(markup).toContain('type="password"');
    expect(markup).toContain("Apple");
    expect(markup).toContain("Google");
  });

  it("renders display-name signup without exposing a friend-code edit field", () => {
    const markup = withBrowserLocation("?mode=signup", () =>
      renderToStaticMarkup(
        createElement(AuthPage, { client: null, signedIn: false }),
      ),
    );
    expect(markup).toContain("Create your account");
    expect(markup).toContain("Display name");
    expect(markup).toContain("Email");
    expect(markup).not.toContain('name="friendCode"');
  });

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
