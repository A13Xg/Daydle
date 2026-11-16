import { countTiles, parsePuzzleNumber } from "../common";
import type { ParsedShare, ShareParser } from "../types";

const HEADER = /^Connections$/iu;
const PUZZLE = /^Puzzle #([0-9][0-9,]*)$/iu;
const COLORS = new Set(["🟨", "🟩", "🟦", "🟪"]);

export const connectionsParser: ShareParser = {
  gameSlug: "connections",
  parserVersion: "1.0.0",
  formatVersion: "nyt-share-v1",
  detect(lines): number {
    return lines.some((line) => HEADER.test(line)) ? 0.98 : 0;
  },
  parse(lines): ParsedShare | null {
    if (lines[0] !== "Connections") return null;
    const puzzle = PUZZLE.exec(lines[1] ?? "");
    if (!puzzle) return null;
    const number = parsePuzzleNumber(puzzle[1]!);
    if (number === null) return null;
    const rows = lines.slice(2);
    if (rows.length < 4 || rows.length > 7) return null;
    const groups = new Set<string>();
    let mistakes = 0;
    for (const row of rows) {
      const tiles = countTiles(row, COLORS);
      if (tiles === null || tiles.length !== 4) return null;
      const uniform = tiles.every((tile) => tile === tiles[0]);
      if (uniform) {
        if (groups.has(tiles[0]!)) return null;
        groups.add(tiles[0]!);
      } else {
        mistakes++;
      }
    }
    const won = groups.size === 4 && mistakes <= 3 &&
      rows.length === groups.size + mistakes &&
      countTiles(rows.at(-1)!, COLORS)!.every(
        (tile) => tile === Array.from(rows.at(-1)!)[0],
      );
    const lost = groups.size < 4 && mistakes === 4 &&
      rows.length === groups.size + mistakes &&
      !countTiles(rows.at(-1)!, COLORS)!.every(
        (tile) => tile === Array.from(rows.at(-1)!)[0],
      );
    if (!won && !lost) return null;
    return {
      gameSlug: "connections",
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "connections:number:" + number,
      puzzleNumber: number,
      puzzleDate: null,
      outcome: won ? "win" : "loss",
      attempts: rows.length,
      score: null,
      completionTimeMs: null,
      metrics: { mistakes, solvedGroups: groups.size },
    };
  },
};
