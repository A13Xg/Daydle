import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicPerformance } from "../../shared/comparisons";
import {
  comparisonErrorText,
  loadVisiblePerformance,
} from "../lib/comparisons-api";
import { ArcadeIcon } from "./ArcadeIcon";

type PerformanceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PublicPerformance };

export function PlayerPerformance({
  profileId,
  client,
  viewerId,
}: {
  profileId: string;
  client: SupabaseClient | null;
  viewerId: string | null;
}) {
  const [state, setState] = useState<PerformanceState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadVisiblePerformance(profileId, client, viewerId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: comparisonErrorText(cause) });
      },
    );
    return () => controller.abort();
  }, [profileId, client, viewerId, reload]);

  return (
    <section className="panel public-performance" aria-labelledby="player-performance-heading">
      <div className="social-section-head">
        <ArcadeIcon name="statistics" size={22} />
        <div>
          <p className="eyebrow">SPOILER-SAFE PERFORMANCE</p>
          <h2 id="player-performance-heading">Visible game statistics</h2>
        </div>
      </div>
      {state.status === "loading" && <p role="status">Checking released and unlocked puzzles…</p>}
      {state.status === "error" && (
        <div className="notice error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => setReload((n) => n + 1)}>Retry</button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <div className="performance-overview">
            <div><span>Visible results</span><strong>{state.data.visibleResults}</strong></div>
            <div><span>Completed</span><strong>{state.data.visibleWins}</strong></div>
          </div>
          {state.data.games.length ? (
            <ul className="performance-game-list">
              {state.data.games.map((game) => (
                <li key={game.slug}>
                  <div><strong>{game.name}</strong>
                    <small>{game.visibleResults} visible · {game.completed} completed</small>
                  </div>
                  <a href={`/compare?game=${game.slug}`}>Compare</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              There are no results visible to you yet. This does not indicate
              whether the player has saved results for locked puzzles.
            </p>
          )}
          <p className="fine-print">
            These totals include only results you may view for released puzzles
            or puzzles you have personally completed. They are not the player's
            private all-time totals. Hidden attempts and achievements are not counted.
          </p>
        </>
      )}
    </section>
  );
}
