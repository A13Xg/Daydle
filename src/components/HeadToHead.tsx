import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RANKED_GAMES,
  formatComparisonMetric,
  type HeadToHead as HeadToHeadData,
} from "../../shared/comparisons";
import { comparisonErrorText, loadHeadToHead } from "../lib/comparisons-api";
import { ArcadeIcon } from "./ArcadeIcon";

type CompareState =
  | { status: "loading" }
  | { status: "error"; text: string }
  | { status: "ready"; data: HeadToHeadData };

export function HeadToHead({
  leftId,
  rightId,
  client,
  viewerId,
}: {
  leftId: string;
  rightId: string;
  client: SupabaseClient | null;
  viewerId: string | null;
}) {
  const [game, setGame] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<CompareState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadHeadToHead(
      leftId,
      rightId,
      game || null,
      { limit: 20, offset },
      client,
      viewerId,
      controller.signal,
    ).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", text: comparisonErrorText(cause) });
      },
    );
    return () => controller.abort();
  }, [leftId, rightId, game, offset, client, viewerId, refresh]);

  return (
    <section
      className="panel comparison-head-to-head"
      aria-labelledby="head-to-head-heading"
    >
      <div className="social-section-head">
        <ArcadeIcon name="friends" size={23} />
        <div>
          <p className="eyebrow">SHARED PUZZLES</p>
          <h2 id="head-to-head-heading">Head-to-head history</h2>
        </div>
      </div>
      <div className="comparison-control-row">
        <label htmlFor="h2h-game-select">Game</label>
        <select
          id="h2h-game-select"
          value={game}
          onChange={(event) => {
            setGame(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">All compatible games</option>
          {RANKED_GAMES.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {state.status === "loading" && (
        <p role="status">Checking mutually visible results…</p>
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
        <>
          <p className="fine-print">
            Only matching puzzle editions unlocked for this viewer appear.
            Results from other puzzles are excluded entirely.
          </p>
          {state.data.items.length ? (
            <ul className="h2h-list">
              {state.data.items.map((item) => (
                <li key={item.gameSlug + ":" + item.puzzleKey}>
                  <div className="h2h-title">
                    <strong>{item.gameName}</strong>
                    <span>{item.puzzleDate ?? item.puzzleKey}</span>
                  </div>
                  <div className="h2h-results">
                    <div
                      className={item.winner === "left" ? "h2h-winning" : ""}
                    >
                      <small>{state.data.leftName}</small>
                      <strong>
                        {formatComparisonMetric(item.leftMetric, item.gameSlug)}
                      </strong>
                    </div>
                    <span className="h2h-vs">vs</span>
                    <div
                      className={item.winner === "right" ? "h2h-winning" : ""}
                    >
                      <small>{state.data.rightName}</small>
                      <strong>
                        {formatComparisonMetric(
                          item.rightMetric,
                          item.gameSlug,
                        )}
                      </strong>
                    </div>
                  </div>
                  <span className="h2h-outcome">
                    {item.winner === null
                      ? "Not comparable"
                      : item.winner === "tie"
                        ? "Tie"
                        : (item.winner === "left"
                            ? state.data.leftName
                            : state.data.rightName) + " ahead"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No shared puzzle results are currently visible. This does not
              disclose locked puzzle activity.
            </p>
          )}
          {state.data.totalVisible > 20 && (
            <nav
              className="comparison-pagination"
              aria-label="Head-to-head pagination"
            >
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 20))}
              >
                Previous
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 20, state.data.totalVisible)} of{" "}
                {state.data.totalVisible}
              </span>
              <button
                type="button"
                disabled={offset + 20 >= state.data.totalVisible}
                onClick={() => setOffset((n) => n + 20)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
