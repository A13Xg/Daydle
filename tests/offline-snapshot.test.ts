import { describe, expect, it } from "vitest";
import type { CatalogData } from "../src/lib/catalog-api";
import {
  readPublicCatalog,
  readSelectedSnapshot,
  savePublicCatalog,
  saveSelectedSnapshot,
  clearSelectedSnapshot,
} from "../src/lib/offline-snapshot";

function storage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

const publicCatalog = {
  games: [
    {
      id: "g1",
      slug: "wordle",
      name: "Wordle",
      description: "A word game",
      publisher: "NYT",
      canonicalUrl: "https://www.nytimes.com/",
      iconUrl: null,
      status: "active",
      cadence: "daily",
      timezoneName: null,
      parserStatus: "unsupported",
      linkStatus: "unverified",
      linkCheckedAt: null,
      categorySlugs: ["word"],
    },
  ],
  categories: [{ id: "c1", slug: "word", name: "Words" }],
} as CatalogData;

describe("safe offline snapshots", () => {
  it("persists only projected public catalog fields, not arbitrary server extras", () => {
    const s = storage();
    const extended = {
      ...publicCatalog,
      games: [
        {
          ...publicCatalog.games[0],
          email: "private@example.invalid",
          rawShareText: "DO NOT CACHE",
          access_token: "not-cached",
        },
      ],
    } as CatalogData;
    savePublicCatalog(s, extended, 1000);
    const restored = readPublicCatalog(s, 1001);
    expect(restored?.games).toHaveLength(1);
    expect(JSON.stringify(restored)).not.toContain("private@example.invalid");
    expect(JSON.stringify(restored)).not.toContain("DO NOT CACHE");
    expect(JSON.stringify(restored)).not.toContain("not-cached");
    expect(readPublicCatalog(s, 1000 + 8 * 24 * 3600 * 1000)).toBeNull();
  });

  it("requires the actual authenticated user to read cached ordered selections", () => {
    const s = storage();
    saveSelectedSnapshot(s, "user-a", ["g1", "g2"], 1000);
    expect(readSelectedSnapshot(s, null, 1001)).toBeNull();
    expect(readSelectedSnapshot(s, "user-b", 1001)).toBeNull();
    expect(readSelectedSnapshot(s, "user-a", 1001)).toEqual(["g1", "g2"]);
    clearSelectedSnapshot(s, "user-a");
    expect(readSelectedSnapshot(s, "user-a", 1001)).toBeNull();
  });

  it("rejects untrusted invalid snapshot data", () => {
    const s = storage();
    s.setItem("daydle:public-catalog:v1", "{garbage}");
    expect(readPublicCatalog(s)).toBeNull();
    savePublicCatalog(s, publicCatalog, 10_000);
    expect(readPublicCatalog(s, 9_999)).toBeNull();
  });

  it("works without localStorage permission", () => {
    expect(() => savePublicCatalog(undefined, publicCatalog)).not.toThrow();
    expect(readPublicCatalog(undefined)).toBeNull();
    expect(readSelectedSnapshot(undefined, "u")).toBeNull();
  });
});
