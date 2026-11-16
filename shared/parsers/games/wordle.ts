import { countTiles, parsePuzzleNumber } from "../common";
import type { ParsedShare, ShareParser } from "../types";

const HEADER = /^Wordle ([0-9][0-9,]*) ([1-6X])\/6(\*)?$/iu;
const TILES = new Set(["🟩", "🟨", "⬛", "⬜"]);
const WIN = "🟩🟩🟩🟩🟩";

export const wordleParser: ShareParser = {
  gameSlug: "wordle",
  parserVersion: "1.0.0",
  formatVersion: "nyt-share-v1",
  detect(lines): number {
    return lines.some((line) => HEADER.test(line)) ? 0.99 : 0;
  },
  parse(lines): ParsedShare | null {
    const match = HEADER.exec(lines[0] ?? "");
    if (!match) return null;
    const number = parsePuzzleNumber(match[1]!);
    if (number === null) return null;

    const isLoss = match[2]!.toUpperCase() === "X";
    const attempts = isLoss ? 6 : Number(match[2]);
    const rows = lines.slice(1).filter((line) => line.length > 0);
    if (rows.at(-1)?.startsWith("https://www.nytimes.com/games/wordle/")) rows.pop();
    if (rows.length !== attempts) return null;

    const parsed = rows.map((row) => countTiles(row, TILES));
    if (parsed.some((row) => row === null || row.length !== 5)) return null;
    const last = parsed.at(-1)!.join("");
    if ((!isLoss && last !== WIN) || (isLoss && last === WIN)) return null;
    if (parsed.slice(0, -1).some((row) => row!.join("") === WIN)) return null;

    return {
      gameSlug: "wordle",
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "wordle:number:" + number,
      puzzleNumber: number,
      puzzleDate: null,
      outcome: isLoss ? "loss" : "win",
      attempts,
      score: null,
      completionTimeMs: null,
      metrics: { hardModeClaimed: Boolean(match[3]), guessedRows: attempts },
    };
  },
};
