/**
 * Canonical domain contracts. These are browser-safe types, not authorization
 * policy: the database and Worker always decide access and validity.
 */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" as const;
const FRIEND_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export function isFriendCode(value: unknown): value is string {
  return typeof value === "string" && FRIEND_CODE_PATTERN.test(value);
}

export type GameLifecycle = "active" | "inactive" | "retired";
export type ParserSupport = "unsupported" | "experimental" | "supported";
export type GameCadence = "daily" | "weekly" | "irregular" | "multiple_daily" | "unknown";
export type GameOutcome = "win" | "loss" | "complete" | "incomplete";

export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface GameMetadata {
  id: string;
  slug: string;
  name: string;
  canonicalUrl: string;
  status: GameLifecycle;
  cadence: GameCadence;
  parserStatus: ParserSupport;
}

export interface CanonicalPuzzle {
  id: string;
  gameId: string;
  key: string;
  puzzleDate: string | null;
  releasedAt: string | null;
  resetVerifiedAt: string | null;
}

export interface CanonicalResult {
  id: string;
  userId: string;
  gameId: string;
  puzzleId: string;
  outcome: GameOutcome | null;
  score: number | null;
  maxScore: number | null;
  attempts: number | null;
  completionTimeMs: number | null;
  metrics: Record<string, unknown>;
  parserVersion: string;
  formatVersion: string | null;
  submittedAt: string;
}

/** Only an opaque user/puzzle pair is permitted for result uniqueness. */
export function resultIdentity(userId: string, puzzleId: string): string {
  return userId + ":" + puzzleId;
}
