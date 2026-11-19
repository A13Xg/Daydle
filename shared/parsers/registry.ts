import { connectionsParser } from "./games/connections";
import { flagleParser } from "./games/flagle";
import { miniCrosswordParser } from "./games/mini-crossword";
import { quordleParser } from "./games/quordle";
import { strandsParser } from "./games/strands";
import { wordleParser } from "./games/wordle";
import { worldleParser } from "./games/worldle";
import { normalizeShare } from "./normalize";
import type { ParseDecision, ShareParser } from "./types";

export const shareParsers: readonly ShareParser[] = Object.freeze([
  wordleParser,
  connectionsParser,
  strandsParser,
  miniCrosswordParser,
  quordleParser,
  worldleParser,
  flagleParser,
]);

/**
 * Deliberately synchronous, side-effect-free and bounded for Worker usage.
 * Does not authorize or persist a submission; Phase 7 owns those concerns.
 */
export function parseShare(input: unknown): ParseDecision {
  const normalized = normalizeShare(input);
  if (normalized.status === "invalid") {
    return { status: "invalid", code: normalized.code, gameSlug: null };
  }

  const matches = shareParsers.filter(
    (parser) => parser.detect(normalized.lines) >= 0.8,
  );
  if (matches.length === 0) return { status: "unknown" };
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      gameSlugs: matches.map((parser) => parser.gameSlug),
    };
  }

  const parser = matches[0]!;
  const parsed = parser.parse(normalized.lines);
  return parsed
    ? { status: "parsed", result: parsed }
    : { status: "invalid", code: "invalid_format", gameSlug: parser.gameSlug };
}
