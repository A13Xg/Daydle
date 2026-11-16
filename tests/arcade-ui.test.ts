import { describe, expect, it } from "vitest";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { ArcadeHeader, ArcadeTabBar, selectedTab, shellForPath, stackBackPath, stackTitle } from "../src/components/ArcadeShell";
import { FeaturePendingPage, HowItWorksPage } from "../src/components/FeaturePendingPage";

function renderTab(path: string) {
  return renderToStaticMarkup(createElement(ArcadeTabBar, { pathname: path }));
}

describe("Obsidian Arcade route shells", () => {
  it.each([
    ["/", "tab"],
    ["/today", "tab"],
    ["/games", "tab"],
    ["/statistics", "tab"],
    ["/friends", "tab"],
    ["/account", "tab"],
    ["/lineup", "stack"],
    ["/games/wordle", "stack"],
    ["/how-it-works", "stack"],
    ["/notifications", "stack"],
    ["/auth", "blank"],
    ["/auth/callback", "blank"],
  ])("assigns %s to the %s shell", (path, kind) => {
    expect(shellForPath(path)).toBe(kind);
  });

  it.each([
    ["/", "/today"],
    ["/today", "/today"],
    ["/games", "/games"],
    ["/games/wordle", "/games"],
    ["/statistics", "/statistics"],
    ["/friends", "/friends"],
    ["/account", "/account"],
    ["/lineup", null],
  ])("resolves the active tab for %s", (path, expected) => {
    expect(selectedTab(path)).toBe(expected);
  });

  it("renders five accessible tabs, one active at a time", () => {
    for (const path of ["/today", "/games", "/statistics", "/friends", "/account"]) {
      const markup = renderTab(path);
      expect(markup).toContain('aria-label="Primary navigation"');
      expect((markup.match(/class="tabbar-link"/g) ?? [])).toHaveLength(5);
      expect((markup.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
      for (const label of ["Today", "Discover", "Statistics", "Friends", "Account"]) {
        expect(markup).toContain(">" + label + "</span>");
      }
    }
  });

  it("uses a distinct stack header with explicit back and Paste controls", () => {
    const markup = renderToStaticMarkup(
      createElement(ArcadeHeader, {
        pathname: "/lineup",
        signedIn: true,
        onPaste: () => undefined,
        pasteTrigger: createRef<HTMLButtonElement>(),
      }),
    );
    expect(markup).toContain("Edit lineup");
    expect(markup).toContain('aria-label="Go back"');
    expect(markup).toContain('href="/today"');
    expect(markup).toContain('aria-label="Paste Results"');
    expect(markup).not.toContain("brand-badge");
    expect(stackTitle("/games/wordle")).toBe("Game details");
    expect(stackBackPath("/games/wordle")).toBe("/games");
  });

  it("hides all shared chrome on authentication routes", () => {
    const markup = renderToStaticMarkup(
      createElement(ArcadeHeader, {
        pathname: "/auth",
        signedIn: false,
        onPaste: () => undefined,
        pasteTrigger: createRef<HTMLButtonElement>(),
      }),
    );
    expect(markup).toBe("");
  });

  it("keeps notifications explicitly unavailable rather than inventing a badge", () => {
    const markup = renderToStaticMarkup(
      createElement(ArcadeHeader, {
        pathname: "/today",
        signedIn: true,
        onPaste: () => undefined,
        pasteTrigger: createRef<HTMLButtonElement>(),
      }),
    );
    expect(markup).toContain('aria-label="Notifications (not yet available)"');
    expect(markup).not.toContain("14,280");
    expect(markup).not.toContain("unread");
  });
});

describe("feature previews and static onboarding", () => {
  it.each(["statistics", "friends", "notifications"] as const)(
    "renders %s as a truthful future state without fake results",
    (feature) => {
      const markup = renderToStaticMarkup(createElement(FeaturePendingPage, { feature }));
      expect(markup).toContain('href="/today"');
      expect(markup).not.toContain("Top 8%");
      expect(markup).not.toContain("14,280");
      expect(markup).not.toContain("Cheer");
    },
  );

  it("teaches the actual publisher/clipboard flow, not OCR or result saving", () => {
    const markup = renderToStaticMarkup(createElement(HowItWorksPage));
    expect(markup).toContain("Build your lineup");
    expect(markup).toContain("Play at the publisher");
    expect(markup).toContain("Bring your share text");
    expect(markup).toContain("nothing uploads yet");
    expect(markup).not.toContain("OCR");
  });
});

describe("dark-only offline design contract", () => {
  it("uses approved colors and local font without external font services", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const html = readFileSync("index.html", "utf8");
    const manifest = JSON.parse(readFileSync("public/app.webmanifest", "utf8"));
    expect(css).toContain("--surface: #051424");
    expect(css).toContain("--primary-container: #4d8eff");
    expect(css).toContain("--tertiary-container: #00a572");
    expect(css).toContain("/fonts/PlusJakartaSans.ttf");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("100dvh");
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).not.toContain("user-scalable=no");
    expect(html).not.toContain("maximum-scale");
    expect(manifest.theme_color).toBe("#051424");
    expect(readFileSync("public/fonts/PlusJakartaSans.ttf").length).toBeGreaterThan(10_000);
    expect(readFileSync("public/fonts/OFL.txt", "utf8")).toContain("SIL OPEN FONT LICENSE");
  });

  it("keeps PWA service-worker caching restricted to public assets", () => {
    const script = readFileSync("scripts/sw-template.js", "utf8");
    const build = readFileSync("scripts/build-pwa.mjs", "utf8");
    expect(script).toContain('url.pathname.startsWith("/fonts/")');
    expect(script).toContain('url.pathname.startsWith("/auth")');
    expect(script).toContain('url.pathname.startsWith("/account")');
    expect(build).toContain('"/arcade-emblem.svg"');
    expect(build).toContain('"/fonts/PlusJakartaSans.ttf"');
  });
});
