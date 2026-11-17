import { describe, expect, it } from "vitest";
import { parseShare } from "../shared/parsers";
import {
  gameDisplayName,
  parsedPreview,
  puzzleDisplayName,
  resultDetails,
  resultOutcomeLabel,
  resultSummary,
  supportedResultGames,
} from "../src/lib/result-view";

describe("result presentation contracts", () => {
  it("uses the server's parser registry for the game filter, not a separate list", () => {
    expect(supportedResultGames.map(({ slug }) => slug)).toEqual([
      "wordle", "connections", "strands", "mini-crossword", "quordle",
    ]);
    expect(supportedResultGames.map(({ name }) => name)).toContain("The Mini");
    expect(gameDisplayName("unsupported-new-game")).toBe("unsupported-new-game");
  });

  it("presents canonical keys without leaking raw internal namespace", () => {
    expect(puzzleDisplayName("wordle:number:1406")).toBe("Puzzle #1,406");
    expect(puzzleDisplayName("mini-crossword:date:2025-04-28")).toBe("Puzzle 2025-04-28");
    expect(puzzleDisplayName("special-puzzle-key")).toBe("special-puzzle-key");
    expect(resultOutcomeLabel("win")).toBe("Solved");
    expect(resultOutcomeLabel("loss")).toBe("Not solved");
    expect(resultOutcomeLabel("complete")).toBe("Completed");
  });

  it("formats only meaningful metrics and retains game-specific scoring semantics", () => {
    expect(resultSummary({
      outcome: "win", attempts: 4, score: null, completion_time_ms: null, metrics: {},
    })).toBe("Solved · 4 attempts");
    expect(resultSummary({
      outcome: "complete", attempts: null, score: null, completion_time_ms: 62_000, metrics: {},
    })).toBe("Completed · 1:02");
    expect(resultDetails({
      game_slug: "connections", metrics: { mistakes: 2, solvedGroups: 4, injected: "<b>bad</b>" },
    })).toEqual([
      { label: "Groups solved", value: "4" },
      { label: "Mistakes", value: "2" },
    ]);
    expect(resultDetails({
      game_slug: "quordle", metrics: { boardAttempts: [3, null, 8, 9], failedBoards: 1 },
    })).toEqual([
      { label: "Board attempts", value: "3 · X · 8 · 9" },
      { label: "Unsolved boards", value: "1" },
    ]);
    expect(resultDetails({
      game_slug: "strands", metrics: { themeWords: 6, hints: 1, spangramPosition: 3 },
    })).toHaveLength(3);
    expect(resultDetails({
      game_slug: "wordle", metrics: { hardModeClaimed: true },
    })).toContainEqual({ label: "Hard mode (share claim)", value: "Yes" });
  });

  it("keeps local recognition explicitly derived from publisher share text", () => {
    const parsed = parseShare([
      "Wordle 1,406 4/6*",
      "⬛⬛⬛⬛🟩",
      "⬛⬛⬛🟨🟩",
      "⬛🟨⬛⬛🟩",
      "🟩🟩🟩🟩🟩",
    ].join("\n"));
    expect(parsed.status).toBe("parsed");
    if (parsed.status !== "parsed") return;
    expect(parsedPreview(parsed.result)).toEqual({
      game: "Wordle",
      puzzle: "Puzzle #1,406",
      summary: "Solved · 4 attempts",
    });
  });
});
