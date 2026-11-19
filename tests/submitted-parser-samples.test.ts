import { describe, expect, it } from "vitest";
import { parseShare } from "../shared/parsers";

// Synthetic puzzle identifiers; layouts mirror the privately submitted formats.
const WORLDLE_LOSS = [
  "#Worldle #1701 (16.11.2026) X/6 (81%)",
  "🔥 Current Win Streak: 0 days",
  "🟩🟩🟩🟨⬜↘️",
  "🟩🟩🟩🟩⬜↙️",
  "🟩🟩🟨⬜⬜↘️",
  "🟩🟩⬜⬜⬜↘️",
  "🟩🟩⬜⬜⬜➡️",
  "🟩🟩🟩🟨⬜↘️",
  "https://worldle.teuteuf.fr/share",
].join("\n");
const FLAGLE_WIN = [
  "#Flagle #1700 (16.11.2026) 2/6",
  "🟩🟩🟩",
  "🟩🟥🟩",
  "https://www.flagle.io/?utm_source=share&utm_medium=native",
].join("\n");

describe("sample-derived Worldle parser", () => {
  it("recognizes numbered, dated, directional six-guess loss and proximity", () => {
    expect(parseShare(WORLDLE_LOSS)).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "worldle",
        puzzleKey: "worldle:number:1701",
        puzzleDate: "2026-11-16",
        puzzleNumber: 1701,
        outcome: "loss",
        attempts: 6,
        score: null,
        metrics: { sharePercent: 81, greenClues: 16, yellowClues: 3 },
      },
    });
  });

  it("accepts a bounded win without optional streak or URL", () => {
    expect(
      parseShare(
        [
          "#Worldle #1702 (17.11.2026) 2/6 (100%)",
          "🟨🟨🟩⬜⬜↗️",
          "🟩🟩🟩🟩🟩➡️",
        ].join("\n"),
      ),
    ).toMatchObject({
      status: "parsed",
      result: { outcome: "win", attempts: 2, puzzleDate: "2026-11-17" },
    });
  });

  it.each([
    WORLDLE_LOSS.replace("(81%)", "(101%)"),
    WORLDLE_LOSS.replace("16.11.2026", "31.02.2026"),
    WORLDLE_LOSS.replace("🟩🟩🟩🟨⬜↘️", "🟩🟩🟩🟨⬜"),
    WORLDLE_LOSS.replace(
      "https://worldle.teuteuf.fr/share",
      "https://evil.example/share",
    ),
    WORLDLE_LOSS.replace("🟩🟩⬜⬜⬜↘️\n", ""),
  ])("does not accept malformed or injected Worldle shares", (value) => {
    expect(parseShare(value).status).not.toBe("parsed");
  });
});

describe("sample-derived Flagle parser", () => {
  it("recognizes dated two-guess result with share URL and tile clues", () => {
    expect(parseShare(FLAGLE_WIN)).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "flagle",
        puzzleKey: "flagle:number:1700",
        puzzleDate: "2026-11-16",
        puzzleNumber: 1700,
        outcome: "win",
        attempts: 2,
        score: null,
        metrics: { greenClues: 5 },
      },
    });
  });

  it("supports a valid six-guess loss variant", () => {
    const rows = Array.from({ length: 6 }, () => "🟥🟥🟩");
    expect(
      parseShare(["#Flagle #1701 (17.11.2026) X/6", ...rows].join("\n")),
    ).toMatchObject({
      status: "parsed",
      result: { outcome: "loss", attempts: 6 },
    });
  });

  it.each([
    FLAGLE_WIN.replace("16.11.2026", "31.02.2026"),
    FLAGLE_WIN.replace("2/6", "0/6"),
    FLAGLE_WIN.replace("🟩🟥🟩", "🟩🟥🟩🟩"),
    FLAGLE_WIN.replace("🟩🟥🟩", "🟩🟨🟩"),
    FLAGLE_WIN.replace("https://www.flagle.io/", "https://evil.example/"),
  ])("rejects unknown or contradictory Flagle variants", (value) => {
    expect(parseShare(value).status).not.toBe("parsed");
  });
});

describe("regressions from accepted existing-game formats", () => {
  it("accepts Wordle share with a blank line after the header", () => {
    const result = [
      "Wordle 1,900 5/6",
      "",
      "🟨⬛⬛⬛🟨",
      "⬛🟩⬛🟨🟨",
      "🟩🟩⬛🟨⬛",
      "🟩🟩⬛⬛🟨",
      "🟩🟩🟩🟩🟩",
    ].join("\n");
    expect(parseShare(result)).toMatchObject({
      status: "parsed",
      result: { gameSlug: "wordle", attempts: 5, outcome: "win" },
    });
  });

  it("accepts Connections loss with one solved group and four mistakes", () => {
    expect(
      parseShare(
        [
          "Connections",
          "Puzzle #1300",
          "🟪🟩🟨🟦",
          "🟨🟨🟨🟨",
          "🟪🟦🟪🟩",
          "🟪🟩🟦🟦",
          "🟩🟩🟪🟩",
        ].join("\n"),
      ),
    ).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "connections",
        outcome: "loss",
        metrics: { mistakes: 4, solvedGroups: 1 },
      },
    });
  });

  it("accepts Strands with smart quotes and multiline hint/word rows", () => {
    expect(
      parseShare(
        [
          "Strands #995",
          "“A sample theme”",
          "💡🔵💡🔵",
          "💡🔵💡🔵",
          "💡🔵💡🔵",
          "🟡",
        ].join("\n"),
      ),
    ).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "strands",
        outcome: "complete",
        metrics: { hints: 6, themeWords: 6 },
      },
    });
  });
});
