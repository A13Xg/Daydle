import {
  COMPARISON_PATH,
  validComparisonBoard,
  validHeadToHead,
  validPublicPerformance,
  validPublicResult,
  validPuzzlesResponse,
  type ComparisonBoard,
  type HeadToHead,
  type PublicPerformance,
  type PublicPuzzleResult,
  type PuzzlesResponse,
} from "../shared/comparisons";
import { GAME_SLUG_PATTERN, RESULT_ID_PATTERN } from "../shared/results";
import {
  authenticate,
  configuration,
  errorResponse,
  isResponse,
  responseJson,
  rpc,
  type ResultsEnvironment,
} from "./results";

type Config = NonNullable<ReturnType<typeof configuration>>;
type VerifiedViewer = { config: Config; viewer: string | null };

async function viewerFor(
  request: Request,
  env: ResultsEnvironment | undefined,
): Promise<VerifiedViewer | Response> {
  // A bad token is never silently downgraded to anonymous.
  if (request.headers.has("authorization")) {
    const verified = await authenticate(request, env);
    if (isResponse(verified)) return verified;
    return { config: verified, viewer: verified.userId };
  }
  const config = configuration(env);
  if (!config) return errorResponse("service_unavailable", 503);
  return { config, viewer: null };
}
function pageBounds(url: URL): { limit: number; offset: number } | null {
  const l = url.searchParams.get("limit") ?? "20";
  const o = url.searchParams.get("offset") ?? "0";
  if (!/^\d{1,2}$/.test(l) || !/^\d{1,4}$/.test(o)) return null;
  const limit = Number(l);
  const offset = Number(o);
  return limit >= 1 && limit <= 50 && offset >= 0 && offset <= 5000
    ? { limit, offset }
    : null;
}
const isGame = (value: string | null): value is string =>
  typeof value === "string" && GAME_SLUG_PATTERN.test(value);
function uuidAfter(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const candidate = path.slice(prefix.length);
  return RESULT_ID_PATTERN.test(candidate) ? candidate : null;
}

function cleanPuzzles(result: PuzzlesResponse) {
  return {
    status: "ready",
    gameSlug: result.gameSlug,
    gameName: result.gameName,
    items: result.items.map(({ puzzleKey, puzzleDate, released }) => ({
      puzzleKey,
      puzzleDate,
      released,
    })),
  };
}
function cleanBoard(result: ComparisonBoard) {
  const common = {
    status: result.status,
    gameSlug: result.gameSlug,
    gameName: result.gameName,
    puzzleKey: result.puzzleKey,
    puzzleDate: result.puzzleDate,
  };
  if (result.status === "locked") return common;
  return {
    ...common,
    released: result.released,
    metricLabel: result.metricLabel,
    scope: result.scope,
    totalVisible: result.totalVisible,
    rankedCount: result.rankedCount,
    items: result.items.map(
      ({ resultId, userId, displayName, outcome, metricValue, rank }) => ({
        resultId,
        userId,
        displayName,
        outcome,
        metricValue,
        rank,
      }),
    ),
  };
}
function cleanPerformance(result: PublicPerformance) {
  return {
    status: "ready",
    profileId: result.profileId,
    visibleResults: result.visibleResults,
    visibleWins: result.visibleWins,
    games: result.games.map(
      ({ slug, name, visibleResults, completed, bestMetric }) => ({
        slug,
        name,
        visibleResults,
        completed,
        bestMetric,
      }),
    ),
  };
}
function cleanPublicResult(result: PublicPuzzleResult) {
  const {
    resultId,
    userId,
    displayName,
    gameSlug,
    gameName,
    puzzleKey,
    puzzleDate,
    outcome,
    metricLabel,
    metricValue,
  } = result;
  return {
    resultId,
    userId,
    displayName,
    gameSlug,
    gameName,
    puzzleKey,
    puzzleDate,
    outcome,
    metricLabel,
    metricValue,
  };
}
function cleanHeadToHead(result: HeadToHead) {
  return {
    status: "ready",
    leftUserId: result.leftUserId,
    leftName: result.leftName,
    rightUserId: result.rightUserId,
    rightName: result.rightName,
    totalVisible: result.totalVisible,
    items: result.items.map((row) => ({
      gameSlug: row.gameSlug,
      gameName: row.gameName,
      puzzleKey: row.puzzleKey,
      puzzleDate: row.puzzleDate,
      leftOutcome: row.leftOutcome,
      rightOutcome: row.rightOutcome,
      leftMetric: row.leftMetric,
      rightMetric: row.rightMetric,
      winner: row.winner,
    })),
  };
}

/** All comparisons are filtered in PostgreSQL before rankings and pagination. */
export async function handleComparisonRequest(
  request: Request,
  env?: ResultsEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method !== "GET")
    return errorResponse("method_not_allowed", 405, { allow: "GET" });
  const resultId = uuidAfter(path, COMPARISON_PATH + "/result/");
  const profileId = uuidAfter(path, COMPARISON_PATH + "/profile/");
  const options = [
    COMPARISON_PATH + "/puzzles",
    COMPARISON_PATH + "/board",
    COMPARISON_PATH + "/head-to-head",
  ];
  if (!options.includes(path) && !resultId && !profileId)
    return errorResponse("not_found", 404);

  const game = url.searchParams.get("game");
  const pagination = pageBounds(url);
  if (
    (path === COMPARISON_PATH + "/puzzles" ||
      path === COMPARISON_PATH + "/board") &&
    !isGame(game)
  )
    return errorResponse("invalid_game", 400);
  if (
    path === COMPARISON_PATH + "/head-to-head" &&
    game !== null &&
    !isGame(game)
  )
    return errorResponse("invalid_game", 400);
  if (
    (path === COMPARISON_PATH + "/board" ||
      path === COMPARISON_PATH + "/head-to-head") &&
    !pagination
  )
    return errorResponse("invalid_pagination", 400);

  let method: string;
  let args: Record<string, unknown>;
  if (path === COMPARISON_PATH + "/puzzles") {
    method = "comparison_puzzles";
    args = { p_game_slug: game };
  } else if (path === COMPARISON_PATH + "/board") {
    const puzzle = url.searchParams.get("puzzle");
    const scope = url.searchParams.get("scope") ?? "global";
    if (!puzzle || puzzle.length > 160)
      return errorResponse("invalid_puzzle", 400);
    if (scope !== "global" && scope !== "friends")
      return errorResponse("invalid_scope", 400);
    method = "comparison_board";
    args = {
      p_game_slug: game,
      p_puzzle_key: puzzle,
      p_scope: scope,
      p_limit: pagination!.limit,
      p_offset: pagination!.offset,
    };
  } else if (resultId) {
    method = "comparison_public_result";
    args = { p_result: resultId };
  } else if (profileId) {
    method = "comparison_profile_summary";
    args = { p_profile: profileId };
  } else {
    const left = url.searchParams.get("left");
    const right = url.searchParams.get("right");
    if (
      !left ||
      !right ||
      !RESULT_ID_PATTERN.test(left) ||
      !RESULT_ID_PATTERN.test(right) ||
      left.toLowerCase() === right.toLowerCase()
    )
      return errorResponse("invalid_players", 400);
    method = "comparison_head_to_head";
    args = {
      p_left: left,
      p_right: right,
      p_game_slug: game,
      p_limit: pagination!.limit,
      p_offset: pagination!.offset,
    };
  }

  const verified = await viewerFor(request, env);
  if (isResponse(verified)) return verified;
  if (
    method === "comparison_board" &&
    args.p_scope === "friends" &&
    !verified.viewer
  )
    return errorResponse("authentication_required", 401);
  args.p_viewer = verified.viewer; // Server-derived identity, never a query/user ID.
  const value = await rpc(verified.config, method, args);
  if (isResponse(value)) return value;
  if (value === null) return errorResponse("not_found", 404);
  if (value && typeof value === "object" && "status" in value) {
    if (value.status === "not_found") return errorResponse("not_found", 404);
    if (value.status === "invalid_request")
      return errorResponse("invalid_request", 400);
  }
  if (method === "comparison_puzzles")
    return validPuzzlesResponse(value)
      ? responseJson(cleanPuzzles(value))
      : errorResponse("comparison_service_unavailable", 503);
  if (method === "comparison_board")
    return validComparisonBoard(value)
      ? responseJson(cleanBoard(value))
      : errorResponse("comparison_service_unavailable", 503);
  if (method === "comparison_public_result")
    return validPublicResult(value)
      ? responseJson(cleanPublicResult(value))
      : errorResponse("comparison_service_unavailable", 503);
  if (method === "comparison_profile_summary")
    return validPublicPerformance(value)
      ? responseJson(cleanPerformance(value))
      : errorResponse("comparison_service_unavailable", 503);
  return validHeadToHead(value)
    ? responseJson(cleanHeadToHead(value))
    : errorResponse("comparison_service_unavailable", 503);
}
