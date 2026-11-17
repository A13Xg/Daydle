import { useEffect, useState } from "react";
import type { PublicPlayer } from "../../shared/social";
import { loadPublicPlayer, socialErrorText } from "../lib/social-api";
import { ArcadeIcon } from "./ArcadeIcon";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlayerPerformance } from "./PlayerPerformance";
import { HeadToHead } from "./HeadToHead";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: PublicPlayer };

export function PublicPlayerPage({
  id,
  client,
  viewerId,
}: {
  id: string;
  client: SupabaseClient | null;
  viewerId: string | null;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadPublicPlayer(id, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setState({ status: "ready", value });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: socialErrorText(cause) });
      },
    );
    return () => controller.abort();
  }, [id, attempt]);
  return (
    <section className="public-player" aria-labelledby="public-player-heading">
      <header className="social-page-intro">
        <p className="eyebrow">PUBLIC PLAYER CARD</p>
        <h1 id="public-player-heading">Player profile</h1>
        <p>Only information intentionally shared publicly is shown here.</p>
      </header>
      {state.status === "loading" && (
        <p role="status" className="panel">
          Loading player profile…
        </p>
      )}
      {state.status === "error" && (
        <div className="notice error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <section className="panel public-player-hero">
            <div className="social-avatar" aria-hidden="true">
              {state.value.display_name.trim().charAt(0).toUpperCase() || "P"}
            </div>
            <div>
              <p className="eyebrow">DAYDLE PLAYER</p>
              <h2>{state.value.display_name}</h2>
              <p className="muted">
                Playing on Daydle since{" "}
                {new Date(state.value.created_at).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "short" },
                )}
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="social-section-head">
              <ArcadeIcon name="discover" size={22} />
              <h2>Favorite games</h2>
            </div>
            {state.value.games.length ? (
              <ul className="social-public-games">
                {state.value.games.map((game) => (
                  <li key={game.slug}>
                    <a href={`/games/${game.slug}`}>
                      <ArcadeIcon name="discover" size={18} /> {game.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No games added to this player's lineup yet.
              </p>
            )}
          </section>
          <PlayerPerformance
            profileId={id}
            client={client}
            viewerId={viewerId}
          />
          {viewerId && viewerId !== id && (
            <HeadToHead
              leftId={viewerId}
              rightId={id}
              client={client}
              viewerId={viewerId}
            />
          )}
          <aside className="social-privacy-note">
            <ArcadeIcon name="info" size={20} />
            <p>
              Only unlocked puzzle results contribute to public statistics.
              Personal all-time totals and unverified current-puzzle performance
              remain private.
            </p>
          </aside>
          <a className="secondary-link" href="/friends">
            Friends and invitations
          </a>
        </>
      )}
    </section>
  );
}
