import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogGame } from "../shared/catalog";
import { GameDetailPage } from "../src/components/GameDetailPage";
import { CatalogPage } from "../src/components/CatalogPage";

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
});
