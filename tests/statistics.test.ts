import { describe, expect, it } from "vitest";
import {
  calculatePersonalStatistics,
  type StatisticsResult,
} from "../shared/statistics";

function result(
  submitted_at: string,
  changes: Partial<StatisticsResult> = {},
): StatisticsResult {
  return {
    game_slug: "wordle",
    game_name: "Wordle",
    outcome: "win",
    attempts: 4,
    score: null,
    completion_time_ms: null,
    submitted_at,
    ...changes,
  };
}

describe("canonical personal statistics", () => {
  it("uses local submission days, not UTC or puzzle numbers", () => {
    const rows = [
      result("2026-03-08T07:59:00Z"),
      result("2026-03-08T08:01:00Z"),
      result("2026-03-09T06:59:00Z"),
    ];
    const stats = calculatePersonalStatistics(
      rows,
      "America/Los_Angeles",
      new Date("2026-03-09T17:00:00Z"),
    );
    expect(stats.activityDays).toEqual(["2026-03-07", "2026-03-08"]);
    expect(stats.daysActive).toBe(2);
    expect(stats.longestStreak).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.totalResults).toBe(3);
  });

  it("accepts yesterday as a live streak but expires after missed days", () => {
    const rows = [result("2026-11-12T20:00:00Z")];
    expect(
      calculatePersonalStatistics(
        rows,
        "UTC",
        new Date("2026-11-13T20:00:00Z"),
      ).currentStreak,
    ).toBe(1);
    expect(
      calculatePersonalStatistics(
        rows,
        "UTC",
        new Date("2026-11-14T20:00:00Z"),
      ).currentStreak,
    ).toBe(0);
  });

  it("does not invent a universal score or compare undefined score directions", () => {
    const rows = [
      result("2026-11-12T20:00:00Z", { attempts: 5, score: 100 }),
      result("2026-11-13T20:00:00Z", { attempts: 3, score: 10 }),
      result("2026-11-13T22:00:00Z", {
        game_slug: "mini-crossword",
        game_name: "The Mini",
        attempts: null,
        score: null,
        completion_time_ms: 42000,
        outcome: "complete",
      }),
      result("2026-11-13T23:00:00Z", {
        outcome: "loss",
        attempts: null,
        score: null,
      }),
    ];
    const stats = calculatePersonalStatistics(
      rows,
      "UTC",
      new Date("2026-11-14T00:00:00Z"),
    );
    const wordle = stats.games.find((game) => game.slug === "wordle")!;
    expect(wordle.completed).toBe(2);
    expect(wordle.lost).toBe(1);
    expect(wordle.completionRate).toBeCloseTo(2 / 3);
    expect(wordle.bestAttempts).toBe(3);
    expect(wordle.attemptsDistribution).toEqual([
      { attempts: 3, count: 1 },
      { attempts: 5, count: 1 },
    ]);
    expect(
      stats.games.find((game) => game.slug === "mini-crossword")?.bestTimeMs,
    ).toBe(42000);
    expect(stats).not.toHaveProperty("universalScore");
  });

  it("recomputes eligibility and streaks after deletes or corrections", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      result("2026-11-" + String(index + 1).padStart(2, "0") + "T12:00:00Z"),
    );
    const old = calculatePersonalStatistics(
      rows,
      "UTC",
      new Date("2026-11-10T13:00:00Z"),
    );
    expect(old.achievements.map((item) => item.code)).toContain("ten_results");
    expect(old.achievements.map((item) => item.code)).toContain("seven_day_streak");
    const changed = calculatePersonalStatistics(
      rows.filter((_, index) => index !== 3),
      "UTC",
      new Date("2026-11-10T13:00:00Z"),
    );
    expect(changed.longestStreak).toBe(6);
    expect(changed.achievements.map((item) => item.code)).not.toContain(
      "ten_results",
    );
    expect(changed.achievements.map((item) => item.code)).not.toContain(
      "seven_day_streak",
    );
    expect(changed.totalResults).toBe(9);
  });

  it("handles empty and incomplete-only results without fabricated rates", () => {
    const empty = calculatePersonalStatistics(
      [],
      "UTC",
      new Date("2026-11-16T12:00:00Z"),
    );
    expect(empty).toMatchObject({
      totalResults: 0,
      currentStreak: 0,
      longestStreak: 0,
      games: [],
      achievements: [],
    });
    const incomplete = calculatePersonalStatistics(
      [result("2026-11-16T12:00:00Z", { outcome: "incomplete" })],
      "UTC",
      new Date("2026-11-16T12:00:00Z"),
    );
    expect(incomplete.games[0]?.completionRate).toBeNull();
    expect(incomplete.games[0]?.bestAttempts).toBeNull();
  });

  it("rejects invalid timezones and malformed timestamps", () => {
    expect(() => calculatePersonalStatistics([], "Not/A_Zone")).toThrow();
    expect(() =>
      calculatePersonalStatistics([result("not-a-date")], "UTC"),
    ).toThrow(RangeError);
  });
});
