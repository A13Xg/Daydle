import { describe, expect, it } from "vitest";
import {
  canAddGame,
  canLaunchGame,
  filterCatalog,
  gameAvailabilityLabel,
  moveSelection,
  parserSupportLabel,
  safePublisherUrl,
  type CatalogGame,
} from "../shared/catalog";

const sample: CatalogGame = {
  id: "40000000-0000-4000-8000-000000000001",
  slug: "wordle",
  name: "Wordle",
  description: "Find the five-letter word.",
  publisher: "The New York Times",
  canonicalUrl: "https://www.nytimes.com/games/wordle/index.html",
  iconUrl: null,
  status: "active",
  cadence: "daily",
  timezoneName: null,
  parserStatus: "unsupported",
  linkStatus: "unverified",
  linkCheckedAt: null,
  categorySlugs: ["word"],
};

describe("catalog domain contracts", () => {
  it("accepts only credential-free external HTTPS hostnames", () => {
    expect(safePublisherUrl(sample.canonicalUrl)).toBe(sample.canonicalUrl);
    for (const invalid of [
      "javascript:alert(1)",
      "http://example.com/",
      "https://localhost/",
      "https://127.0.0.1/",
      "***example.com/",
      "https://real.com@evil.com/",
      "https://example.com\n.evil/",
      "data:text/html,hello",
      "not a URL",
    ])
      expect(safePublisherUrl(invalid)).toBeNull();
  });

  it("searches publisher, description, title, category and slug", () => {
    const games = [
      sample,
      {
        ...sample,
        id: "other",
        slug: "framed",
        name: "Framed",
        publisher: "Framed",
        description: "Movie stills",
        categorySlugs: ["movies"],
      },
    ];
    const options = {
      query: "new york",
      category: "",
      support: "all" as const,
      showArchived: false,
    };
    expect(filterCatalog(games, options).map((game) => game.slug)).toEqual([
      "wordle",
    ]);
    expect(
      filterCatalog(games, { ...options, query: "", category: "movies" }).map(
        (game) => game.slug,
      ),
    ).toEqual(["framed"]);
    expect(
      filterCatalog(games, { ...options, query: "MOVIE", category: "" }).map(
        (game) => game.slug,
      ),
    ).toEqual(["framed"]);
  });

  it("clearly differentiates parser support from playable publisher links", () => {
    expect(parserSupportLabel(sample.parserStatus)).toMatch(/not supported/);
    expect(canLaunchGame(sample)).toBe(true);
    expect(canAddGame(sample)).toBe(true);
    const retired = { ...sample, status: "retired" as const };
    const broken = { ...sample, linkStatus: "broken" as const };
    expect(canLaunchGame(retired)).toBe(false);
    expect(canAddGame(broken)).toBe(false);
    expect(gameAvailabilityLabel(retired)).toBe("Archived game");
    expect(gameAvailabilityLabel(broken)).toMatch(/unavailable/);
  });

  it("orders favorites immutably without losing identity or wrapping endpoints", () => {
    const items = ["a", "b", "c"];
    expect(moveSelection(items, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveSelection(items, "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveSelection(items, "a", -1)).toBe(items);
    expect(moveSelection(items, "unknown", 1)).toBe(items);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("does not leak retired catalog entries into default discovery", () => {
    const retired = {
      ...sample,
      id: "retired",
      slug: "retired",
      status: "retired" as const,
    };
    const filters = {
      query: "",
      category: "",
      support: "all" as const,
      showArchived: false,
    };
    expect(filterCatalog([sample, retired], filters)).toEqual([sample]);
    expect(
      filterCatalog([sample, retired], { ...filters, showArchived: true })
        .length,
    ).toBe(2);
    expect(
      filterCatalog([sample], { ...filters, support: "supported" }),
    ).toEqual([]);
  });
});
