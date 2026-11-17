import { GAME_SLUG_PATTERN, RESULT_ID_PATTERN } from "./results";

export const COMPARISON_PATH = "/api/v1/comparisons";
export const RANKED_GAMES = [
  { slug: "wordle", name: "Wordle" },
  { slug: "connections", name: "Connections" },
  { slug: "strands", name: "Strands" },
  { slug: "mini-crossword", name: "Mini Crossword" },
  { slug: "quordle", name: "Daily Quordle" },
] as const;

export type BoardScope = "global" | "friends";
export type PublicOutcome = "win" | "complete" | "loss" | "incomplete" | null;

export interface PuzzleChoice {
  puzzleKey: string;
  puzzleDate: string | null;
  released: boolean;
}
export interface PuzzlesResponse {
  status: "ready";
  gameSlug: string;
  gameName: string;
  items: PuzzleChoice[];
}
export interface BoardItem {
  resultId: string;
  userId: string;
  displayName: string;
  outcome: PublicOutcome;
  metricValue: number | null;
  rank: number | null;
}
export interface LockedBoard {
  status: "locked";
  gameSlug: string;
  gameName: string;
  puzzleKey: string;
  puzzleDate: string | null;
}
export interface ReadyBoard {
  status: "ready";
  gameSlug: string;
  gameName: string;
  puzzleKey: string;
  puzzleDate: string | null;
  released: boolean;
  metricLabel: string;
  scope: BoardScope;
  totalVisible: number;
  rankedCount: number;
  items: BoardItem[];
}
export type ComparisonBoard = LockedBoard | ReadyBoard;

export interface VisibleGameSummary {
  slug: string;
  name: string;
  visibleResults: number;
  completed: number;
  bestMetric: number | null;
}
export interface PublicPerformance {
  status: "ready";
  profileId: string;
  visibleResults: number;
  visibleWins: number;
  games: VisibleGameSummary[];
}

export interface PublicPuzzleResult {
  resultId: string;
  userId: string;
  displayName: string;
  gameSlug: string;
  gameName: string;
  puzzleKey: string;
  puzzleDate: string | null;
  outcome: PublicOutcome;
  metricLabel: string;
  metricValue: number | null;
}

export interface HeadToHeadEntry {
  gameSlug: string;
  gameName: string;
  puzzleKey: string;
  puzzleDate: string | null;
  leftOutcome: PublicOutcome;
  rightOutcome: PublicOutcome;
  leftMetric: number | null;
  rightMetric: number | null;
  winner: "left" | "right" | "tie" | null;
}
export interface HeadToHead {
  status: "ready";
  leftUserId: string;
  leftName: string;
  rightUserId: string;
  rightName: string;
  totalVisible: number;
  items: HeadToHeadEntry[];
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string =>
  typeof v === "string" && RESULT_ID_PATTERN.test(v);
const slug = (v: unknown): v is string =>
  typeof v === "string" && GAME_SLUG_PATTERN.test(v);
const label = (v: unknown, max = 120): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const numberOrNull = (v: unknown): v is number | null =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
const dateOrNull = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
const puzzle = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 160;
const outcome = (v: unknown): v is PublicOutcome =>
  v === null ||
  v === "win" ||
  v === "complete" ||
  v === "loss" ||
  v === "incomplete";

export function validPuzzlesResponse(v: unknown): v is PuzzlesResponse {
  return (
    record(v) &&
    v.status === "ready" &&
    slug(v.gameSlug) &&
    label(v.gameName) &&
    Array.isArray(v.items) &&
    v.items.length <= 40 &&
    v.items.every(
      (p: unknown) =>
        record(p) &&
        puzzle(p.puzzleKey) &&
        dateOrNull(p.puzzleDate) &&
        typeof p.released === "boolean",
    )
  );
}
export function validComparisonBoard(v: unknown): v is ComparisonBoard {
  if (
    !record(v) ||
    !slug(v.gameSlug) ||
    !label(v.gameName) ||
    !puzzle(v.puzzleKey) ||
    !dateOrNull(v.puzzleDate)
  )
    return false;
  if (v.status === "locked") return true;
  if (v.status !== "ready") return false;
  return (
    typeof v.released === "boolean" &&
    label(v.metricLabel, 60) &&
    (v.scope === "global" || v.scope === "friends") &&
    count(v.totalVisible) &&
    count(v.rankedCount) &&
    v.rankedCount <= v.totalVisible &&
    Array.isArray(v.items) &&
    v.items.length <= 50 &&
    v.items.every(
      (item: unknown) =>
        record(item) &&
        uuid(item.resultId) &&
        uuid(item.userId) &&
        label(item.displayName, 80) &&
        outcome(item.outcome) &&
        numberOrNull(item.metricValue) &&
        (item.rank === null || (count(item.rank) && item.rank >= 1)),
    )
  );
}
export function validPublicPerformance(v: unknown): v is PublicPerformance {
  return (
    record(v) &&
    v.status === "ready" &&
    uuid(v.profileId) &&
    count(v.visibleResults) &&
    count(v.visibleWins) &&
    v.visibleWins <= v.visibleResults &&
    Array.isArray(v.games) &&
    v.games.length <= 300 &&
    v.games.every(
      (g: unknown) =>
        record(g) &&
        slug(g.slug) &&
        label(g.name) &&
        count(g.visibleResults) &&
        count(g.completed) &&
        g.completed <= g.visibleResults &&
        numberOrNull(g.bestMetric),
    )
  );
}
export function validPublicResult(v: unknown): v is PublicPuzzleResult {
  return (
    record(v) &&
    uuid(v.resultId) &&
    uuid(v.userId) &&
    label(v.displayName, 80) &&
    slug(v.gameSlug) &&
    label(v.gameName) &&
    puzzle(v.puzzleKey) &&
    dateOrNull(v.puzzleDate) &&
    outcome(v.outcome) &&
    label(v.metricLabel, 60) &&
    numberOrNull(v.metricValue)
  );
}
export function validHeadToHead(v: unknown): v is HeadToHead {
  return (
    record(v) &&
    v.status === "ready" &&
    uuid(v.leftUserId) &&
    uuid(v.rightUserId) &&
    label(v.leftName, 80) &&
    label(v.rightName, 80) &&
    count(v.totalVisible) &&
    Array.isArray(v.items) &&
    v.items.length <= 50 &&
    v.items.every(
      (item: unknown) =>
        record(item) &&
        slug(item.gameSlug) &&
        label(item.gameName) &&
        puzzle(item.puzzleKey) &&
        dateOrNull(item.puzzleDate) &&
        outcome(item.leftOutcome) &&
        outcome(item.rightOutcome) &&
        numberOrNull(item.leftMetric) &&
        numberOrNull(item.rightMetric) &&
        (item.winner === null ||
          ["left", "right", "tie"].includes(String(item.winner))),
    )
  );
}

/** No cross-game score or unverified completion metric is ever fabricated. */
export function formatComparisonMetric(
  value: number | null,
  gameSlug: string,
): string {
  if (value === null) return "Unranked";
  if (gameSlug === "mini-crossword") {
    const seconds = Math.round(value / 1000);
    return (
      Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0")
    );
  }
  return value.toLocaleString();
}

export function comparisonPuzzleLabel(choice: PuzzleChoice): string {
  if (choice.puzzleDate) return choice.puzzleDate;
  const number = choice.puzzleKey.match(/:number:(\d+)$/);
  return number ? "#" + number[1] : choice.puzzleKey;
}
