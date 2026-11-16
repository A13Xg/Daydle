import { parsePuzzleNumber } from "../common";
import type { ParsedShare, ShareParser } from "../types";

const HEADER = /^Strands #([0-9][0-9,]*)$/iu;
const MARKERS = new Set(["🔵", "🟡", "💡"]);

export const strandsParser: ShareParser = {
  gameSlug: "strands",
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
    const body = lines.slice(1);
    // The optional theme caption is publisher copy, not a puzzle identity.
    if (/^["“].{1,100}["”]$/u.test(body[0] ?? "")) body.shift();
    if (body.length === 0) return null;
    const sequence = Array.from(body.join("").replace(/\s/gu, ""));
    if (!sequence.every((marker) => MARKERS.has(marker))) return null;
    const spangramCount = sequence.filter((marker) => marker === "🟡").length;
    const themeWords = sequence.filter((marker) => marker === "🔵").length;
    const hints = sequence.filter((marker) => marker === "💡").length;
    if (spangramCount !== 1 || themeWords < 3 || themeWords > 12 || hints > 30)
      return null;
    return {
      gameSlug: "strands",
      parserVersion: this.parserVersion,
      formatVersion: this.formatVersion,
      puzzleKey: "strands:number:" + number,
      puzzleNumber: number,
      puzzleDate: null,
      outcome: "complete",
      attempts: null,
      score: null,
      completionTimeMs: null,
      metrics: {
        themeWords,
        hints,
        spangramPosition: sequence.indexOf("🟡") + 1,
      },
    };
  },
};
