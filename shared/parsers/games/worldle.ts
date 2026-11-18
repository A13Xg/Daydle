import { parsePuzzleNumber, parseUSDate } from "../common";
import type { ParsedShare, ShareParser } from "../types";

// Publisher sample: #Worldle #1761 (17.11.2026) X/6 (81%).
const HEADER =
  /^#Worldle #([0-9][0-9,]*) \((\d{1,2})\.(\d{1,2})\.(\d{4})\) ([1-6X])\/6 \((\d{1,3})%\)$/iu;
const GUESS = /^([🟩🟨⬜⬛]{5})([⬆⬇⬅➡↖↗↘↙])$/u;
const STREAK = /^🔥 Current Win Streak: \d{1,5} days?$/iu;
const SHARE_URL = /^https:\/\/worldle\.teuteuf\.fr\/share\/?$/iu;

export const worldleParser: ShareParser = {
  gameSlug: "worldle",
  parserVersion: "1.0.0",
  formatVersion: "worldle-share-v1",
  detect(lines): number {
    return lines.some((line) => HEADER.test(line)) ? 0.99 : 0;
  },
  parse(lines): ParsedShare | null {
    const match = HEADER.exec(lines[0] ?? "");
    if (!match) return null;
    const number = parsePuzzleNumber(match[1]!);
    const puzzleDate = parseUSDate(match[3]!, match[2]!, match[4]!);
    const percentage = Number(match[6]);
    if (number === null || !puzzleDate || percentage > 100) return null;

    const lost = match[5]!.toUpperCase() === "X";
    const attempts = lost ? 6 : Number(match[5]);
    const body = lines.slice(1);
    if (STREAK.test(body[0] ?? "")) body.shift();
    if (SHARE_URL.test(body.at(-1) ?? "")) body.pop();
    if (body.length !== attempts) return null;

    let greenClues = 0;
    let yellowClues = 0;
    for (const row of body) {
      const parsed = GUESS.exec(row);
      if (!parsed) return null;
      greenClues += Array.from(parsed[1]!).filter((c) => c === "🟩").length;
      yellowClues += Array.from(parsed[1]!).filter((c) => c === "🟨").length;
    }

    return {
      gameSlug: this.gameSlug,
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "worldle:number:" + number,
      puzzleNumber: number,
      puzzleDate,
      outcome: lost ? "loss" : "win",
      attempts,
      // Publisher proximity percentage is not the same as a game score.
      score: null,
      completionTimeMs: null,
      metrics: { sharePercent: percentage, greenClues, yellowClues },
    };
  },
};
