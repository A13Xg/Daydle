import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogGame } from "../shared/catalog";
import { GameDetailPage } from "../src/components/GameDetailPage";
import { CatalogPage, SelectionNotice } from "../src/components/CatalogPage";

const game: CatalogGame = {
  id: "g1",
  slug: "wordle",
  name: "Wordle",
  description: "Word puzzle",
  publisher: "The New York Times",
  canonicalUrl: "https://www.nytimes.com/",
  iconUrl: null,
  status: "active",
  cadence: "daily",
  timezoneName: null,
  parserStatus: "unsupported",
  linkStatus: "unverified",
  linkCheckedAt: null,
  categorySlugs: ["word"],
};

describe("catalog accessibility / outbound-link states", () => {
  it("uses safe new-tab link with explicit unsupported-result disclosure", () => {
    const markup = renderToStaticMarkup(
      createElement(GameDetailPage, {
        game,
        selected: false,
        signedIn: true,
        saving: false,
        onToggle: vi.fn(),
      }),
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("Results not supported yet");
    expect(markup).toContain("Add to my games");
    expect(markup).toContain("Play at publisher");
  });

  it("does not launch broken links or offer unavailable games to save", () => {
    const markup = renderToStaticMarkup(
      createElement(GameDetailPage, {
        game: { ...game, linkStatus: "broken" },
        selected: false,
        signedIn: true,
        saving: false,
        onToggle: vi.fn(),
      }),
    );
    expect(markup).not.toContain('target="_blank"');
    expect(markup).toContain("Publisher link unavailable");
    expect(markup).toContain("disabled");
  });

  it("prompts signed-out visitors to authenticate, never impersonates login", () => {
    const markup = renderToStaticMarkup(
      createElement(GameDetailPage, {
        game,
        selected: false,
        signedIn: false,
        saving: false,
        onToggle: vi.fn(),
      }),
    );
    expect(markup).toContain("/auth");
    expect(markup).not.toContain("Add to my games");
  });

  it("reports missing public configuration instead of fictitious local catalog data", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogPage, {
        client: null,
        userId: null,
      }),
    );
    expect(markup).toContain("catalog is not configured");
  });
  it("renders an actionable retry when saved games fail to load on detail routes", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionNotice, {
        loading: false,
        error: "Your saved games could not be loaded.",
        onRetry: vi.fn(),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your saved games could not be loaded.");
    expect(html).toContain("Retry saved games");
  });

  it("shows a loading status rather than a disabled unexplained action", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionNotice, {
        loading: true,
        error: "",
        onRetry: vi.fn(),
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your games");
  });

});
