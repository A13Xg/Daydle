import type { SavedResult } from "./results";

export type StatisticsResult = Pick<
  SavedResult,
  | "game_slug"
  | "game_name"
  | "outcome"
  | "attempts"
  | "score"
  | "completion_time_ms"
  | "submitted_at"
>;

export interface GameStatistics {
  slug: string;
  name: string;
  recorded: number;
  completed: number;
  lost: number;
  incomplete: number;
  completionRate: number | null;
  bestAttempts: number | null;
  bestTimeMs: number | null;
  attemptsDistribution: { attempts: number; count: number }[];
}

export interface PersonalStatistics {
  timezone: string;
  totalResults: number;
  gamesRecorded: number;
  daysActive: number;
  currentStreak: number;
  longestStreak: number;
  activityDays: string[];
  games: GameStatistics[];
  achievements: { code: string; name: string; description: string }[];
}

export const ACHIEVEMENT_RULES = [
  {
    code: "first_result",
    name: "First entry",
    description: "Record your first puzzle result.",
    minimumResults: 1,
  },
  {
    code: "ten_results",
    name: "Regular player",
    description: "Record 10 puzzle results.",
    minimumResults: 10,
  },
  {
    code: "thirty_results",
    name: "Daily ritual",
    description: "Record 30 puzzle results.",
    minimumResults: 30,
  },
  {
    code: "three_day_streak",
    name: "On a roll",
    description: "Record results on three consecutive local days.",
    minimumStreak: 3,
  },
  {
    code: "seven_day_streak",
    name: "One full week",
    description: "Record results on seven consecutive local days.",
    minimumStreak: 7,
  },
] as const;

export function earnedAchievements(
  totalResults: number,
  longestStreak: number,
): PersonalStatistics["achievements"] {
  return ACHIEVEMENT_RULES.filter(
    (rule) =>
      (!("minimumResults" in rule) || totalResults >= rule.minimumResults) &&
      (!("minimumStreak" in rule) || longestStreak >= rule.minimumStreak),
  ).map(({ code, name, description }) => ({ code, name, description }));
}

function dayKey(date: Date, formatter: Intl.DateTimeFormat): string {
  if (!Number.isFinite(date.valueOf())) {
    throw new RangeError("Invalid statistics timestamp");
  }
  const components = formatter.formatToParts(date);
  const part = (type: string) =>
    components.find((value) => value.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function dayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000);
}

/**
 * Compute only from the complete set of authoritative canonical results.
 * The caller must NOT pass just the first page of a paginated history API.
 *
 * The IANA timezone is explicit. Activity day is the local date of submission,
 * not publisher puzzle date; changing timezones can change historical grouping.
 */
export function calculatePersonalStatistics(
  results: readonly StatisticsResult[],
  timezone: string,
  now: Date = new Date(),
): PersonalStatistics {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = dayNumber(dayKey(now, formatter));
  const days = new Set<string>();
  const byGame = new Map<
    string,
    {
      game: GameStatistics;
      distribution: Map<number, number>;
    }
  >();

  for (const result of results) {
    days.add(dayKey(new Date(result.submitted_at), formatter));
    let state = byGame.get(result.game_slug);
    if (!state) {
      state = {
        game: {
          slug: result.game_slug,
          name: result.game_name,
          recorded: 0,
          completed: 0,
          lost: 0,
          incomplete: 0,
          completionRate: null,
          bestAttempts: null,
          bestTimeMs: null,
          attemptsDistribution: [],
        },
        distribution: new Map<number, number>(),
      };
      byGame.set(result.game_slug, state);
    }
    const game = state.game;
    game.recorded++;
    const completed = result.outcome === "win" || result.outcome === "complete";
    if (completed) {
      game.completed++;
      if (
        result.attempts !== null &&
        Number.isInteger(result.attempts) &&
        result.attempts >= 1
      ) {
        state.distribution.set(
          result.attempts,
          (state.distribution.get(result.attempts) ?? 0) + 1,
        );
        game.bestAttempts =
          game.bestAttempts === null
            ? result.attempts
            : Math.min(game.bestAttempts, result.attempts);
      }
      if (
        result.completion_time_ms !== null &&
        Number.isFinite(result.completion_time_ms) &&
        result.completion_time_ms >= 0
      ) {
        game.bestTimeMs =
          game.bestTimeMs === null
            ? result.completion_time_ms
            : Math.min(game.bestTimeMs, result.completion_time_ms);
      }
    } else if (result.outcome === "loss") {
      game.lost++;
    } else {
      game.incomplete++;
    }
  }

  const activityDays = [...days].sort();
  const indexes = activityDays.map(dayNumber);
  let longestStreak = 0;
  let run = 0;
  let last: number | null = null;
  for (const index of indexes) {
    run = last !== null && index === last + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    last = index;
  }

  let currentStreak = 0;
  if (last !== null && (last === today || last === today - 1)) {
    currentStreak = 1;
    for (let index = indexes.length - 2; index >= 0; index--) {
      if (indexes[index] !== indexes[index + 1]! - 1) break;
      currentStreak++;
    }
  }

  const games = [...byGame.values()]
    .map(({ game, distribution }) => {
      const decided = game.completed + game.lost;
      game.completionRate = decided ? game.completed / decided : null;
      game.attemptsDistribution = [...distribution]
        .sort(([a], [b]) => a - b)
        .map(([attempts, count]) => ({ attempts, count }));
      return game;
    })
    .sort(
      (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    );

  const achievements = earnedAchievements(results.length, longestStreak);

  return {
    timezone: formatter.resolvedOptions().timeZone,
    totalResults: results.length,
    gamesRecorded: byGame.size,
    daysActive: days.size,
    currentStreak,
    longestStreak,
    activityDays,
    games,
    achievements,
  };
}
