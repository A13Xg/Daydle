import { countTiles, parsePuzzleNumber, parseUSDate } from "../common";
import type { ParsedShare, ShareParser } from "../types";

// Publisher sample: #Flagle #1730 (17.11.2026) 2/6 and three tiles per guess.
const HEADER =
  /^#Flagle #([0-9][0-9,]*) \((\d{1,2})\.(\d{1,2})\.(\d{4})\) ([1-6X])\/6$/iu;
const TILES = new Set(["🟩", "🟥"]);
const SHARE_URL = /^https:\/\/(?:www\.)?flagle\.io\/(?:\?[^\s]*)?$/iu;

export const flagleParser: ShareParser = {
  gameSlug: "flagle",
  parserVersion: "1.0.0",
  formatVersion: "flagle-share-v1",
  detect(lines): number {
    return lines.some((line) => HEADER.test(line)) ? 0.99 : 0;
  },
  parse(lines): ParsedShare | null {
    const match = HEADER.exec(lines[0] ?? "");
    if (!match) return null;
    const number = parsePuzzleNumber(match[1]!);
    const puzzleDate = parseUSDate(match[3]!, match[2]!, match[4]!);
    if (number === null || !puzzleDate) return null;

    const lost = match[5]!.toUpperCase() === "X";
    const attempts = lost ? 6 : Number(match[5]);
    const body = lines.slice(1);
    if (SHARE_URL.test(body.at(-1) ?? "")) body.pop();
    if (body.length !== attempts) return null;
    let greenClues = 0;
    for (const row of body) {
      const tiles = countTiles(row, TILES);
      if (!tiles || tiles.length !== 3) return null;
      greenClues += tiles.filter((tile) => tile === "🟩").length;
    }
    return {
      gameSlug: this.gameSlug,
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "flagle:number:" + number,
      puzzleNumber: number,
      puzzleDate,
      outcome: lost ? "loss" : "win",
      attempts,
      score: null,
      completionTimeMs: null,
      metrics: { greenClues },
    };
  },
};
