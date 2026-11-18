import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_LENGTH,
  MAX_SHARE_LINES,
  normalizeShare,
  parseShare,
  shareParsers,
} from "../shared/parsers";

const WORDLE_WIN = [
  "Wordle 1,406 4/6*",
  "⬛⬛⬛⬛🟩",
  "⬛⬛⬛🟨🟩",
  "⬛🟨⬛⬛🟩",
  "🟩🟩🟩🟩🟩",
].join("\n");

const CONNECTIONS_WIN = [
  "Connections",
  "Puzzle #687",
  "🟩🟦🟩🟩",
  "🟪🟪🟪🟪",
  "🟦🟦🟦🟦",
  "🟨🟨🟨🟨",
  "🟩🟩🟩🟩",
].join("\n");

const STRANDS = ["Strands #985", "“Not a good sign”", "🔵🔵💡🟡🔵🔵🔵"].join(
  "\n",
);

const MINI = [
  "I solved the 4/28/2025 New York Times",
  "Mini Crossword in 0:22!",
  "https://www.nytimes.com/crosswords/game/mini",
].join("\n");

const QUORDLE = [
  "🙂Daily Quordle 1190",
  "🟥8️⃣",
  "4️⃣5️⃣",
  "m-w.com/games/quordle/",
].join("\n");

describe("parser registry contracts", () => {
  it("registers seven distinct catalog slugs with stable versions", () => {
    expect(shareParsers.map((p) => p.gameSlug)).toEqual([
      "wordle",
      "connections",
      "strands",
      "mini-crossword",
      "quordle",
    ]);
    for (const p of shareParsers) {
      expect(p.parserVersion).toBe("1.0.0");
      expect(p.formatVersion).toMatch(/v1$/);
    }
  });

  it("normalizes CRLF, NBSP, BOM and emoji presentation safely", () => {
    const normalized = normalizeShare(
      "\ufeffWordle\u00a0123 1/6\r\n🟩️🟩️🟩️🟩️🟩️",
    );
    expect(normalized).toEqual({
      status: "valid",
      lines: ["Wordle 123 1/6", "🟩🟩🟩🟩🟩"],
    });
  });

  it.each([
    { input: "", code: "empty" },
    { input: " \n\t ", code: "empty" },
    { input: null, code: "empty" },
    { input: "x".repeat(MAX_SHARE_LENGTH + 1), code: "too_long" },
    { input: "Wordle 1 1/6\n🟩\u0000", code: "control_character" },
    { input: "Wordle 1 1/6\n🟩\u007f", code: "control_character" },
    {
      input: Array.from({ length: MAX_SHARE_LINES + 1 }, () => "x").join("\n"),
      code: "too_many_lines",
    },
  ])("rejects bounded or invalid input ($code)", ({ input, code }) => {
    expect(parseShare(input)).toEqual({
      status: "invalid",
      code,
      gameSlug: null,
    });
  });

  it("does not infer results from free-form text or stray grids", () => {
    expect(parseShare("I played Wordle yesterday\n🟩🟩🟩🟩🟩")).toEqual({
      status: "unknown",
    });
    expect(parseShare("Puzzle #687\n🟩🟩🟩🟩")).toEqual({ status: "unknown" });
    expect(parseShare("<script>alert(1)</script>")).toEqual({
      status: "unknown",
    });
  });

  it("rejects mixed shares rather than submitting two results", () => {
    expect(parseShare(WORDLE_WIN + "\n" + STRANDS)).toEqual({
      status: "ambiguous",
      gameSlugs: ["wordle", "strands"],
    });
    expect(parseShare(WORDLE_WIN + "\n" + WORDLE_WIN)).toEqual({
      status: "invalid",
      code: "invalid_format",
      gameSlug: "wordle",
    });
  });

  it("does not leak submitted clipboard text in diagnostic responses", () => {
    const result = parseShare("Wordle 777 3/6\nPRIVATE TOKEN XYZ");
    expect(JSON.stringify(result)).not.toContain("PRIVATE TOKEN");
    expect(result).toMatchObject({
      status: "invalid",
      code: "invalid_format",
      gameSlug: "wordle",
    });
  });
});

describe("Wordle", () => {
  it("parses solved hard-mode share with emoji grid and puzzle number", () => {
    const response = parseShare(WORDLE_WIN);
    expect(response.status).toBe("parsed");
    if (response.status !== "parsed") return;
    expect(response.result).toMatchObject({
      gameSlug: "wordle",
      puzzleNumber: 1406,
      puzzleDate: null,
      puzzleKey: "wordle:number:1406",
      outcome: "win",
      attempts: 4,
      score: null,
      metrics: { hardModeClaimed: true, guessedRows: 4 },
    });
  });

  it("accepts historical white-square presentation and a one-guess solve", () => {
    const response = parseShare("Wordle 196 1/6\r\n🟩️🟩️🟩️🟩️🟩️");
    expect(response).toMatchObject({
      status: "parsed",
      result: { attempts: 1, outcome: "win" },
    });
  });

  it("accepts six-guess loss without claiming a solved board", () => {
    const response = parseShare(
      ["Wordle 197 X/6", ...Array.from({ length: 6 }, () => "⬜⬜⬜🟨⬛")].join(
        "\n",
      ),
    );
    expect(response).toMatchObject({
      status: "parsed",
      result: { outcome: "loss", attempts: 6 },
    });
  });

  it.each([
    "Wordle 12 1/6",
    "Wordle 12 2/6\n🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩",
    "Wordle 12 3/6\n🟨🟩⬛⬛⬛\n🟩🟩🟩🟩🟩",
    "Wordle 12 X/6\n🟩🟩🟩🟩🟩",
    "Wordle 12 1/6\n🟩🟩🟩🟩🟥",
    "Wordle 0 1/6\n🟩🟩🟩🟩🟩",
  ])("rejects malformed Wordle records", (input) => {
    expect(parseShare(input).status).not.toBe("parsed");
  });
});

describe("Connections", () => {
  it("parses a completed puzzle and tracks mistakes independently", () => {
    const response = parseShare(CONNECTIONS_WIN);
    expect(response).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "connections",
        puzzleNumber: 687,
        puzzleDate: null,
        outcome: "win",
        attempts: 5,
        metrics: { mistakes: 1, solvedGroups: 4 },
      },
    });
  });

  it("recognizes loss after four incorrect guesses", () => {
    const response = parseShare(
      [
        "Connections",
        "Puzzle #688",
        "🟨🟩🟦🟪",
        "🟪🟩🟦🟨",
        "🟦🟨🟩🟪",
        "🟩🟦🟪🟨",
      ].join("\n"),
    );
    expect(response).toMatchObject({
      status: "parsed",
      result: { outcome: "loss", metrics: { mistakes: 4, solvedGroups: 0 } },
    });
  });

  it.each([
    "Connections\nPuzzle #1\n🟩🟩🟩🟩",
    "Connections\nPuzzle #1\n🟩🟩🟩🟩\n🟩🟩🟩🟩\n🟨🟨🟨🟨\n🟦🟦🟦🟦",
    "Connections\nPuzzle #1\n🟪🟪🟪🟪\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟨🟨🟨🟨\n🟩🟦🟨🟪",
    "Connections\nPuzzle #0\n🟪🟪🟪🟪\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟨🟨🟨🟨",
  ])("rejects impossible or incomplete grids", (input) => {
    expect(parseShare(input).status).not.toBe("parsed");
  });
});

describe("Strands", () => {
  it("parses the blue/yellow/hint share sequence without invented score", () => {
    const response = parseShare(STRANDS);
    expect(response).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "strands",
        puzzleKey: "strands:number:985",
        outcome: "complete",
        attempts: null,
        score: null,
        metrics: { hints: 1, themeWords: 5, spangramPosition: 4 },
      },
    });
  });

  it.each([
    "Strands #985\n🔵🔵🔵🔵",
    "Strands #985\n🟡🟡🔵🔵🔵",
    "Strands #985\n🟡🔵",
    "Strands #985\n🟡🔵🔵🔵X",
  ])("rejects invalid Strands glyph sequences", (input) => {
    expect(parseShare(input)).toMatchObject({
      status: "invalid",
      gameSlug: "strands",
    });
  });
});

describe("NYT Mini Crossword", () => {
  it("parses publisher-provided date and duration, without guessing local day", () => {
    expect(parseShare(MINI)).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "mini-crossword",
        puzzleDate: "2025-04-28",
        puzzleKey: "mini-crossword:date:2025-04-28",
        puzzleNumber: null,
        outcome: "complete",
        completionTimeMs: 22000,
      },
    });
  });

  it("handles leap day and an hours/minutes/seconds clock", () => {
    expect(
      parseShare(
        "I solved the 2/29/2024 New York Times Mini Crossword in 1:02:03!",
      ),
    ).toMatchObject({
      status: "parsed",
      result: { completionTimeMs: 3723000 },
    });
  });

  it.each([
    "I solved the 2/29/2025 New York Times Mini Crossword in 0:22!",
    "I solved the 4/31/2025 New York Times Mini Crossword in 0:22!",
    "I solved the 4/28/2025 New York Times Mini Crossword in 0:60!",
    "I solved the 4/28/2025 New York Times Mini Crossword in 0:00!",
    "I solved the 4/28/2025 New York Times Mini Crossword in 9999:59!",
  ])("rejects impossible date/time", (input) => {
    expect(parseShare(input).status).not.toBe("parsed");
  });
});

describe("Daily Quordle", () => {
  it("parses four keycap results and distinguishes red failed boards", () => {
    expect(parseShare(QUORDLE)).toMatchObject({
      status: "parsed",
      result: {
        gameSlug: "quordle",
        puzzleNumber: 1190,
        outcome: "loss",
        attempts: null,
        metrics: { boardAttempts: [null, 8, 4, 5], failedBoards: 1 },
      },
    });
  });

  it("accepts a fully solved classic Daily share and optional progress rows", () => {
    const result = parseShare("Daily Quordle 1191\n3️⃣5️⃣\n6️⃣9️⃣\n🟩🟩🟩🟩");
    expect(result).toMatchObject({
      status: "parsed",
      result: {
        outcome: "win",
        metrics: { boardAttempts: [3, 5, 6, 9], failedBoards: 0 },
      },
    });
  });

  it.each([
    "Daily Quordle 1191\n3️⃣5️⃣\n6️⃣9️⃣",
    "Daily Quordle 1191\n3️⃣5️⃣\n6️⃣0️⃣",
    "Daily Quordle 1191\n3️⃣5️⃣\n6️⃣9️⃣\nunknown metadata",
    "Daily Quordle 0\n3️⃣5️⃣\n6️⃣9️⃣",
  ])("rejects ambiguous or unsupported matrix variants", (input) => {
    const response = parseShare(input);
    if (
      input.includes("0️⃣") ||
      input.includes("unknown") ||
      input.includes(" 0\n")
    ) {
      expect(response.status).not.toBe("parsed");
    }
  });

  it("does not confuse Sequence/Extreme share headers with classic Daily", () => {
    expect(parseShare("Daily Sequence Quordle 1190\n3️⃣5️⃣\n6️⃣9️⃣")).toEqual({
      status: "unknown",
    });
    expect(parseShare("🥵Daily Extreme 273\n3️⃣5️⃣\n6️⃣9️⃣")).toEqual({
      status: "unknown",
    });
  });
});
