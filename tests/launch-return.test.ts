import { describe, expect, it } from "vitest";
import {
  clearPublisherLaunch,
  readPublisherLaunch,
  recordPublisherLaunch,
} from "../src/lib/launch-return";

function fakeSessionStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (i) => [...values.keys()][i] ?? null,
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, val) {
      values.set(key, val);
    },
  };
}

describe("safe publisher return hint", () => {
  it("keeps only a short-lived non-sensitive slug", () => {
    const s = fakeSessionStorage();
    recordPublisherLaunch(s, "wordle", 1000);
    expect(readPublisherLaunch(s, 2000)).toEqual({
      slug: "wordle",
      launchedAt: 1000,
    });
    expect(readPublisherLaunch(s, 1000 + 5 * 3600 * 1000)).toBeNull();
  });

  it("cannot persist arbitrary links or redirect data", () => {
    const s = fakeSessionStorage();
    recordPublisherLaunch(s, "https://evil.example", 1000);
    expect(s.length).toBe(0);
    recordPublisherLaunch(s, "wordle", 1000);
    clearPublisherLaunch(s);
    expect(readPublisherLaunch(s, 1000)).toBeNull();
  });
});
