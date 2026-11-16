import type { GameOutcome } from "../domain";

export type ParserErrorCode =
  | "empty"
  | "too_long"
  | "too_many_lines"
  | "control_character"
  | "invalid_format";

export type ParserMetric = string | number | boolean | readonly number[];

export interface ParsedShare {
  gameSlug: string;
  parserVersion: string;
  formatVersion: string;
  /** Namespaced share identity; no calendar date is inferred from puzzle numbers. */
  puzzleKey: string;
  puzzleNumber: number | null;
  puzzleDate: string | null;
  outcome: GameOutcome;
  attempts: number | null;
  score: number | null;
  completionTimeMs: number | null;
  metrics: Readonly<Record<string, ParserMetric>>;
}

export type ParseDecision =
  | { status: "parsed"; result: ParsedShare }
  | { status: "invalid"; code: ParserErrorCode; gameSlug: string | null }
  | { status: "unknown" }
  | { status: "ambiguous"; gameSlugs: readonly string[] };

export interface ShareParser {
  readonly gameSlug: string;
  readonly parserVersion: string;
  readonly formatVersion: string;
  /** Detects publisher-specific share headers. Never treats a URL as identity. */
  detect(lines: readonly string[]): number;
  /** Returns null when the recognized share is incomplete or inconsistent. */
  parse(lines: readonly string[]): ParsedShare | null;
}
