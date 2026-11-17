import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RANKED_GAMES,
  comparisonPuzzleLabel,
  formatComparisonMetric,
  type BoardScope,
  type ComparisonBoard,
  type PuzzlesResponse,
} from "../../shared/comparisons";
import {
  comparisonErrorText,
  loadComparisonBoard,
  loadComparisonPuzzles,
  loadPublicPuzzleResult,
} from "../lib/comparisons-api";
import type { PublicPuzzleResult } from "../../shared/comparisons";
import { ArcadeIcon } from "./ArcadeIcon";

type Loading<T> =
  | { status: "loading" }
  | { status: "error"; text: string }
  | { status: "ready"; data: T };

const initialGame = () => {
  const param = new URLSearchParams(window.location.search).get("game");
  return RANKED_GAMES.some((g) => g.slug === param) ? param! : "wordle";
};

export function ComparisonsPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [game, setGame] = useState(initialGame);
  const [scope, setScope] = useState<BoardScope>(() =>
    userId &&
    new URLSearchParams(window.location.search).get("scope") === "friends"
      ? "friends"
      : "global",
  );
  const [puzzles, setPuzzles] = useState<Loading<PuzzlesResponse>>({
    status: "loading",
  });
  const [puzzleKey, setPuzzleKey] = useState<string | null>(null);
  const [board, setBoard] = useState<Loading<ComparisonBoard>>({
    status: "loading",
  });
  const [refresh, setRefresh] = useState(0);
  const [offset, setOffset] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!userId && scope === "friends") setScope("global");
  }, [scope, userId]);
  useEffect(() => {
    const controller = new AbortController();
    setPuzzles({ status: "loading" });
    setPuzzleKey(null);
    void loadComparisonPuzzles(game, client, userId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setPuzzles({ status: "ready", data });
          const requested = new URLSearchParams(window.location.search).get(
            "puzzle",
          );
          setPuzzleKey(
            data.items.some((p) => p.puzzleKey === requested)
              ? requested
              : (data.items[0]?.puzzleKey ?? null),
          );
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setPuzzles({ status: "error", text: comparisonErrorText(error) });
      },
    );
    return () => controller.abort();
  }, [game, client, userId, refresh]);

  useEffect(() => {
    if (!puzzleKey) return;
    const controller = new AbortController();
    setBoard({ status: "loading" });
    void loadComparisonBoard(
      game,
      puzzleKey,
      scope,
      { limit: 20, offset },
      client,
      userId,
      controller.signal,
    ).then(
      (data) => {
        if (!controller.signal.aborted) setBoard({ status: "ready", data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setBoard({ status: "error", text: comparisonErrorText(error) });
      },
    );
    return () => controller.abort();
  }, [game, puzzleKey, scope, offset, client, userId, refresh]);

  const readyPuzzles = puzzles.status === "ready" ? puzzles.data.items : [];
  const choice = readyPuzzles.find((p) => p.puzzleKey === puzzleKey);
  const visible = board.status === "ready" && puzzleKey ? board.data : null;
  const safeBoard = visible && visible.puzzleKey === puzzleKey && visible.gameSlug === game ? visible : null;

  return (
    <section className="comparison-page" aria-labelledby="comparison-heading">
      <header className="comparison-intro">
        <p className="eyebrow">DAYDLE COMPETITION</p>
        <h1 id="comparison-heading">Puzzle scoreboards</h1>
        <p>
          Every ranking compares results for the{" "}
          <strong>same game and puzzle</strong>. Scores unlock only when you've
          saved that puzzle's result or the publisher's next reset is verified.
        </p>
      </header>
      {!online && (
        <p className="notice" role="status">
          You are offline. Rankings are not cached and require a connection.
        </p>
      )}
      <section
        className="panel comparison-controls"
        aria-label="Choose comparison"
      >
        <div className="comparison-control-row">
          <label htmlFor="compare-game">Daily game</label>
          <select
            id="compare-game"
            value={game}
            disabled={!online}
            onChange={(event) => {
              setGame(event.target.value);
              setOffset(0);
            }}
          >
            {RANKED_GAMES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="comparison-control-row">
          <label htmlFor="compare-puzzle">Puzzle edition</label>
          <select
            id="compare-puzzle"
            value={puzzleKey ?? ""}
            disabled={
              !online || puzzles.status !== "ready" || readyPuzzles.length === 0
            }
            onChange={(event) => {
              setPuzzleKey(event.target.value);
              setOffset(0);
            }}
          >
            {!readyPuzzles.length && (
              <option value="">No puzzle editions yet</option>
            )}
            {readyPuzzles.map((item) => (
              <option key={item.puzzleKey} value={item.puzzleKey}>
                {comparisonPuzzleLabel(item)}
                {item.released ? " · Released" : " · Reset unverified"}
              </option>
            ))}
          </select>
        </div>
        <div
          className="comparison-scope"
          role="group"
          aria-label="Scoreboard scope"
        >
          <button
            type="button"
            aria-pressed={scope === "global"}
            className={scope === "global" ? "selected" : ""}
            onClick={() => {
              setScope("global");
              setOffset(0);
            }}
          >
            All players
          </button>
          <button
            type="button"
            aria-pressed={scope === "friends"}
            className={scope === "friends" ? "selected" : ""}
            disabled={!userId}
            onClick={() => {
              setScope("friends");
              setOffset(0);
            }}
          >
            My friends
          </button>
        </div>
        {!userId && (
          <p className="fine-print">
            Sign in for a friends-only comparison. Public released puzzles
            remain browseable.
          </p>
        )}
      </section>

      {puzzles.status === "loading" && (
        <div className="panel" role="status">
          Loading puzzle editions…
        </div>
      )}
      {puzzles.status === "error" && (
        <div className="notice error" role="alert">
          <p>{puzzles.text}</p>
          <button type="button" onClick={() => setRefresh((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {puzzles.status === "ready" && readyPuzzles.length === 0 && (
        <div className="panel comparison-empty">
          <ArcadeIcon name="info" size={25} />
          <h2>No puzzle editions recorded yet</h2>
          <p>
            Puzzles appear once the publisher edition is known to Daydle.
            Nothing is being inferred from today's date.
          </p>
          <a href="/games">Discover games</a>
        </div>
      )}
      {puzzleKey && (
        <section
          className="panel comparison-board"
          aria-labelledby="board-title"
        >
          <div className="comparison-board-head">
            <div>
              <p className="eyebrow">SAME-PUZZLE RANKINGS</p>
              <h2 id="board-title">
                {puzzles.status === "ready"
                  ? puzzles.data.gameName
                  : "Daily puzzle"}
                {choice && (
                  <span className="comparison-edition">
                    {" "}
                    {comparisonPuzzleLabel(choice)}
                  </span>
                )}
              </h2>
            </div>
            <button
              type="button"
              disabled={!online}
              onClick={() => setRefresh((n) => n + 1)}
            >
              <ArcadeIcon name="refresh" size={18} /> Refresh
            </button>
          </div>
          {board.status === "loading" && (
            <p role="status">Checking puzzle visibility…</p>
          )}
          {board.status === "error" && (
            <div role="alert" className="notice error">
              <p>{board.text}</p>
              <button
                type="button"
                disabled={!online}
                onClick={() => setRefresh((n) => n + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {safeBoard?.status === "locked" && (
            <div className="comparison-shield" role="status">
              <div className="comparison-shield-icon">
                <ArcadeIcon name="info" size={27} />
              </div>
              <h3>Spoiler shield active</h3>
              <p>
                This puzzle's outcomes, scores, rankings and participation
                counts are hidden. Record a valid result for this exact puzzle
                or return after a verified publisher reset.
              </p>
              <a href="/today" className="secondary-link">
                Go to Today
              </a>
            </div>
          )}
          {safeBoard?.status === "ready" && (
            <>
              <div className="comparison-board-summary">
                <span>
                  <ArcadeIcon name="statistics" size={18} />{" "}
                  {safeBoard.totalVisible} visible results
                </span>
                <span>{safeBoard.metricLabel} · Lower is better</span>
                <span>
                  {safeBoard.released
                    ? "Publisher reset verified"
                    : "Unlocked by your result"}
                </span>
              </div>
              {safeBoard.items.length === 0 ? (
                <div className="comparison-empty">
                  <ArcadeIcon name="friends" size={28} />
                  <p>
                    No results in this{" "}
                    {scope === "friends" ? "friend circle" : "scoreboard"} yet.
                  </p>
                </div>
              ) : (
                <ol className="comparison-rankings">
                  {safeBoard.items.map((entry) => (
                    <li
                      key={entry.resultId}
                      className={
                        entry.rank !== null && entry.rank <= 3
                          ? "comparison-entry top-entry"
                          : "comparison-entry"
                      }
                    >
                      <span
                        className="comparison-rank"
                        aria-label={
                          entry.rank === null
                            ? "Unranked"
                            : "Rank " + entry.rank
                        }
                      >
                        {entry.rank === null ? "—" : "#" + entry.rank}
                      </span>
                      <span className="comparison-avatar" aria-hidden="true">
                        {entry.displayName.trim().charAt(0).toUpperCase() ||
                          "P"}
                      </span>
                      <div className="comparison-player-name">
                        <a href={`/players/${entry.userId}`}>
                          {entry.displayName}
                        </a>
                        <small>
                          {entry.outcome === "win" ||
                          entry.outcome === "complete"
                            ? "Completed"
                            : entry.outcome === "loss"
                              ? "Not solved"
                              : "Unranked result"}
                        </small>
                      </div>
                      <div className="comparison-entry-score">
                        <strong>
                          {formatComparisonMetric(entry.metricValue, game)}
                        </strong>
                        <a
                          href={`/comparison-results/${entry.resultId}`}
                          aria-label={`Result details for ${entry.displayName}`}
                        >
                          Details
                        </a>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {safeBoard.totalVisible > 20 && (
                <nav
                  className="comparison-pagination"
                  aria-label="Scoreboard pagination"
                >
                  <button
                    type="button"
                    disabled={!online || offset === 0}
                    onClick={() => setOffset((n) => Math.max(0, n - 20))}
                  >
                    Previous
                  </button>
                  <span>
                    Showing {offset + 1}–
                    {Math.min(offset + 20, safeBoard.totalVisible)} of{" "}
                    {safeBoard.totalVisible}
                  </span>
                  <button
                    type="button"
                    disabled={!online || offset + 20 >= safeBoard.totalVisible}
                    onClick={() => setOffset((n) => n + 20)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}
      <aside className="social-privacy-note comparison-note">
        <ArcadeIcon name="info" size={20} />
        <p>
          Published result text is not proof of publisher-side verification.
          Ranking uses only supported, comparable metrics; unranked results do
          not receive artificial points.
        </p>
      </aside>
    </section>
  );
}

export function PublicResultDetail({
  id,
  client,
  userId,
}: {
  id: string;
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [state, setState] = useState<Loading<PublicPuzzleResult>>({
    status: "loading",
  });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadPublicPuzzleResult(id, client, userId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", text: comparisonErrorText(error) });
      },
    );
    return () => controller.abort();
  }, [id, client, userId, refresh]);
  return (
    <section className="public-player" aria-labelledby="public-result-heading">
      <header className="social-page-intro">
        <p className="eyebrow">SHARED GAME RESULT</p>
        <h1 id="public-result-heading">Puzzle result</h1>
        <p>Private and locked puzzle details are never published here.</p>
      </header>
      {state.status === "loading" && (
        <div className="panel" role="status">
          Checking result visibility…
        </div>
      )}
      {state.status === "error" && (
        <div className="notice error" role="alert">
          <p>{state.text}</p>
          <button type="button" onClick={() => setRefresh((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {state.status === "ready" && (
        <div className="panel comparison-result-card">
          <p className="eyebrow">
            {state.data.gameName} ·{" "}
            {state.data.puzzleDate ?? state.data.puzzleKey}
          </p>
          <h2>{state.data.displayName}</h2>
          <p>
            {state.data.outcome === "win" || state.data.outcome === "complete"
              ? "Completed"
              : "Not solved"}
          </p>
          <strong>
            {formatComparisonMetric(
              state.data.metricValue,
              state.data.gameSlug,
            )}
          </strong>
          <small>{state.data.metricLabel}</small>
          <a
            href={`/compare?game=${encodeURIComponent(state.data.gameSlug)}&puzzle=${encodeURIComponent(state.data.puzzleKey)}`}
          >
            View this puzzle's scoreboard
          </a>
        </div>
      )}
    </section>
  );
}
