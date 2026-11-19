import type { ParsedShare } from "../../shared/parsers";
import type { SavedResult } from "../../shared/results";
import { shareParsers } from "../../shared/parsers";

/** Labels only; the server parser registry remains authoritative. */
const names: Record<string, string> = {
  wordle: "Wordle",
  connections: "Connections",
  strands: "Strands",
  "mini-crossword": "The Mini",
  quordle: "Daily Quordle",
  worldle: "Worldle",
  flagle: "Flagle",
};

export const supportedResultGames = shareParsers.map(({ gameSlug }) => ({
  slug: gameSlug,
  name: names[gameSlug] ?? gameSlug,
}));

export type ResultDisplay = Pick<
  SavedResult,
  "outcome" | "attempts" | "score" | "completion_time_ms" | "metrics"
>;

export function gameDisplayName(slug: string): string {
  return names[slug] ?? slug;
}

export function puzzleDisplayName(key: string): string {
  const number = key.match(/^[a-z-]+:number:([1-9][0-9]*)$/);
  if (number) return "Puzzle #" + Number(number[1]).toLocaleString("en-US");
  const date = key.match(/^[a-z-]+:date:([0-9]{4}-[0-9]{2}-[0-9]{2})$/);
  if (date) return "Puzzle " + date[1];
  return key;
}

export function resultOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "win":
      return "Solved";
    case "loss":
      return "Not solved";
    case "complete":
      return "Completed";
    default:
      return "Incomplete";
  }
}

export function resultSummary(value: ResultDisplay): string {
  const state = resultOutcomeLabel(value.outcome);
  if (value.attempts !== null)
    return state + " · " + value.attempts + " attempts";
  if (value.completion_time_ms !== null) {
    const seconds = Math.round(value.completion_time_ms / 1000);
    return (
      state +
      " · " +
      Math.floor(seconds / 60) +
      ":" +
      String(seconds % 60).padStart(2, "0")
    );
  }
  if (value.score !== null) return state + " · score " + value.score;
  return state;
}

export function resultDetails(
  value: Pick<SavedResult, "game_slug" | "metrics">,
): { label: string; value: string }[] {
  const m = value.metrics ?? {};
  const details: { label: string; value: string }[] = [];
  const number = (key: string, label: string) => {
    const n = m[key];
    if (typeof n === "number" && Number.isFinite(n))
      details.push({ label, value: n.toLocaleString("en-US") });
  };
  switch (value.game_slug) {
    case "wordle":
      if (typeof m.hardModeClaimed === "boolean")
        details.push({
          label: "Hard mode (share claim)",
          value: m.hardModeClaimed ? "Yes" : "No",
        });
      break;
    case "connections":
      number("solvedGroups", "Groups solved");
      number("mistakes", "Mistakes");
      break;
    case "strands":
      number("themeWords", "Theme words");
      number("hints", "Hints used");
      number("spangramPosition", "Spangram position");
      break;
    case "worldle":
      number("sharePercent", "Publisher-reported proximity (%)");
      number("greenClues", "Green clues");
      number("yellowClues", "Yellow clues");
      break;
    case "flagle":
      number("greenClues", "Green clues");
      break;
    case "quordle": {
      const boards = m.boardAttempts;
      if (
        Array.isArray(boards) &&
        boards.length === 4 &&
        boards.every(
          (item) =>
            item === null ||
            (typeof item === "number" &&
              Number.isInteger(item) &&
              item >= 1 &&
              item <= 9),
        )
      )
        details.push({
          label: "Board attempts",
          value: boards.map((item) => item ?? "X").join(" · "),
        });
      number("failedBoards", "Unsolved boards");
      break;
    }
  }
  return details;
}

export function parsedPreview(result: ParsedShare) {
  return {
    game: gameDisplayName(result.gameSlug),
    puzzle: puzzleDisplayName(result.puzzleKey),
    summary: resultSummary({
      outcome: result.outcome,
      attempts: result.attempts,
      score: result.score,
      completion_time_ms: result.completionTimeMs,
      metrics: result.metrics,
    }),
  };
}
