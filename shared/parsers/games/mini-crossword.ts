import { parseUSDate } from "../common";
import type { ParsedShare, ShareParser } from "../types";

const RESULT =
  /^I solved the (\d{1,2})\/(\d{1,2})\/(\d{4}) New York Times Mini Crossword in ((?:\d{1,2}:)?\d{1,4}:\d{2})!(?:\s+https:\/\/www\.nytimes\.com\/crosswords\/game\/mini\/?)?$/iu;

function parseDuration(text: string): number | null {
  const units = text.split(":").map(Number);
  if (units.length !== 2 && units.length !== 3) return null;
  const seconds = units.at(-1)!;
  const minutes = units.at(-2)!;
  const hours = units.length === 3 ? units[0]! : 0;
  if (seconds >= 60 || (units.length === 3 && minutes >= 60)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 && total < 24 * 3600 ? total * 1000 : null;
}

export const miniCrosswordParser: ShareParser = {
  gameSlug: "mini-crossword",
  parserVersion: "1.0.0",
  formatVersion: "nyt-share-v1",
  detect(lines): number {
    return /I solved the \d{1,2}\/\d{1,2}\/\d{4} New York Times Mini Crossword/iu.test(
      lines.join(" "),
    )
      ? 0.99
      : 0;
  },
  parse(lines): ParsedShare | null {
    const match = RESULT.exec(lines.join(" "));
    if (!match) return null;
    const date = parseUSDate(match[1]!, match[2]!, match[3]!);
    const completionTimeMs = parseDuration(match[4]!);
    if (date === null || completionTimeMs === null) return null;
    return {
      gameSlug: "mini-crossword",
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "mini-crossword:date:" + date,
      puzzleNumber: null,
      puzzleDate: date,
      outcome: "complete",
      attempts: null,
      score: null,
      completionTimeMs,
      metrics: {},
    };
  },
};
