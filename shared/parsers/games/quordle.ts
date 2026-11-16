import { parsePuzzleNumber } from "../common";
import type { ParsedShare, ShareParser } from "../types";

const HEADER = /^(?:🙂\s*)?Daily Quordle #?([0-9][0-9,]*)$/iu;
const TOKEN = /[1-9]\u20e3|🟥/gu;
const PROGRESS = /^[🟩🟨⬛⬜\s]{4,32}$/u;
const LINKS = new Set([
  "m-w.com/games/quordle/",
  "https://www.merriam-webster.com/games/quordle/",
]);

function boardPair(line: string): (number | null)[] | null {
  const items = line.match(TOKEN);
  if (!items || items.length !== 2 || items.join("") !== line.replace(/\s/gu, ""))
    return null;
  return items.map((item) => item === "🟥" ? null : Number(item[0]));
}

export const quordleParser: ShareParser = {
  gameSlug: "quordle",
  parserVersion: "1.0.0",
  formatVersion: "daily-quordle-v1",
  detect(lines): number {
    return lines.some((line) => HEADER.test(line)) ? 0.99 : 0;
  },
  parse(lines): ParsedShare | null {
    const match = HEADER.exec(lines[0] ?? "");
    if (!match) return null;
    const number = parsePuzzleNumber(match[1]!);
    if (number === null || lines.length < 3) return null;
    const top = boardPair(lines[1]!);
    const bottom = boardPair(lines[2]!);
    if (!top || !bottom) return null;
    const boardAttempts = [...top, ...bottom];
    if (boardAttempts.length !== 4) return null;
    const extras = lines.slice(3);
    if (!extras.every((line) => LINKS.has(line) || PROGRESS.test(line))) return null;
    const failedBoards = boardAttempts.filter((n) => n === null).length;
    return {
      gameSlug: "quordle",
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "quordle:number:" + number,
      puzzleNumber: number,
      puzzleDate: null,
      outcome: failedBoards === 0 ? "win" : "loss",
      attempts: null,
      score: null,
      completionTimeMs: null,
      metrics: { boardAttempts, failedBoards },
    };
  },
};
