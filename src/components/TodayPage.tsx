import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canLaunchGame,
  gameAvailabilityLabel,
  safePublisherUrl,
} from "../../shared/catalog";
import type { CatalogGame } from "../../shared/catalog";
import { localDayString, manualPlayedLabel } from "../../shared/today";
import { loadCatalog, loadSelectedGames } from "../lib/catalog-api";
import type { CatalogData } from "../lib/catalog-api";
import { loadManualPlayed, updateAndReconcilePlayed } from "../lib/today-api";
import {
  readPublicCatalog,
  readSelectedSnapshot,
  savePublicCatalog,
  saveSelectedSnapshot,
} from "../lib/offline-snapshot";
import { recordPublisherLaunch } from "../lib/launch-return";
import { ArcadeIcon } from "./ArcadeIcon";

interface TodaySnapshot {
  data: CatalogData;
  selectedIds: string[];
  playedIds: string[] | null;
  offline: boolean;
}

type TodayState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: TodaySnapshot };

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function launchStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function TodayPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [day, setDay] = useState(() => localDayString(new Date()));
  const [state, setState] = useState<TodayState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const markLock = useRef(false);

  useEffect(() => {
    function onReturn() {
      const current = localDayString(new Date());
      if (current !== day) {
        setDay(current);
        setRetry((value) => value + 1);
      }
    }
    function onOnline() {
      setOnline(true);
      setRetry((value) => value + 1);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [day]);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    setState({ status: "loading" });
    setStatusError("");
    const storage = browserStorage();
    void (async () => {
      const [catalogResult, selectedResult, marksResult] =
        await Promise.allSettled([
          loadCatalog(client),
          loadSelectedGames(client, userId),
          loadManualPlayed(client, userId, day),
        ]);
      if (!active) return;
      const liveCatalog =
        catalogResult.status === "fulfilled" ? catalogResult.value : null;
      const liveSelected =
        selectedResult.status === "fulfilled" ? selectedResult.value : null;
      const livePlayed =
        marksResult.status === "fulfilled" ? marksResult.value : null;
      if (liveCatalog) savePublicCatalog(storage, liveCatalog);
      if (liveSelected) saveSelectedSnapshot(storage, userId, liveSelected);
      const data = liveCatalog ?? readPublicCatalog(storage);
      const selectedIds = liveSelected ?? readSelectedSnapshot(storage, userId);
      if (!data || !selectedIds) {
        setState({ status: "error" });
      } else {
        setState({
          status: "ready",
          snapshot: {
            data,
            selectedIds,
            // No private manual flags are stored offline. Show unavailable
            // rather than pretending a game was never played.
            playedIds: livePlayed,
            offline: !liveCatalog || !liveSelected || !livePlayed,
          },
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [client, userId, day, retry]);

  async function togglePlayed(gameId: string, mark: boolean) {
    if (
      !client ||
      !userId ||
      state.status !== "ready" ||
      state.snapshot.offline ||
      !online ||
      markLock.current
    )
      return;
    markLock.current = true;
    setSavingId(gameId);
    setStatusError("");
    try {
      const next = await updateAndReconcilePlayed(
        client,
        userId,
        gameId,
        day,
        mark,
      );
      setState((previous) =>
        previous.status === "ready"
          ? {
              ...previous,
              snapshot: { ...previous.snapshot, playedIds: next.ids },
            }
          : previous,
      );
      if (!next.confirmed) {
        setStatusError(
          "The change was not confirmed. We reloaded your status; check it before continuing.",
        );
      }
    } catch {
      setState((previous) =>
        previous.status === "ready"
          ? {
              ...previous,
              snapshot: {
                ...previous.snapshot,
                playedIds: null,
                offline: true,
              },
            }
          : previous,
      );
      setStatusError(
        "The last change could not be verified. Retry to reload status before editing.",
      );
    } finally {
      setSavingId(null);
      markLock.current = false;
    }
  }

  if (!userId)
    return (
      <div className="today-page today-guest">
        <div className="today-guest-status">
          <span className="status-pill"><ArcadeIcon name="today" size={17} /> YOUR DAILY HUB</span>
          <span className="muted">Always your choice to play</span>
        </div>
        <header className="today-heading today-guest-heading">
          <p className="eyebrow">YOUR PERSONAL PUZZLE ROTATION</p>
          <h1 id="today-title">Build your daily puzzle lineup.</h1>
          <p className="lead">
            Collect the games you love, open them at their publisher, and return whenever you're ready for another round.
          </p>
          <div className="welcome-actions">
            <a className="action-link" href="/games">Discover daily games <ArcadeIcon name="arrow" size={18} /></a>
            <a className="secondary-link" href="/auth">Sign in to save a lineup</a>
          </div>
          <p className="muted welcome-note">Your lineup and manual played marks stay private. Result saving is coming in a later phase.</p>
        </header>
        <section className="today-guest-grid" aria-label="How Daydle works">
          <article className="panel today-guest-card">
            <span className="guest-card-number">01</span>
            <h2>Choose your puzzles</h2>
            <p>Browse the catalog and set your preferred order.</p>
          </article>
          <article className="panel today-guest-card">
            <span className="guest-card-number">02</span>
            <h2>Play your way</h2>
            <p>Follow each publisher link. No forced schedule.</p>
          </article>
        </section>
        <a className="today-guide-link" href="/how-it-works">How the daily ritual works <ArcadeIcon name="arrow" size={18} /></a>
      </div>
    );

  const reload = () => setRetry((value) => value + 1);
  if (!client)
    return (
      <section className="panel">
        <h1>Today</h1>
        <p role="alert">The Supabase project is not configured.</p>
      </section>
    );
  if (state.status === "loading")
    return (
      <section className="panel">
        <h1>Today</h1>
        <p role="status">Loading your selected daily games…</p>
      </section>
    );
  if (state.status === "error")
    return (
      <section className="panel">
        <h1>Today</h1>
        <p role="alert">
          Your games are unavailable. Connect to the internet or open games once
          online to prepare an offline snapshot.
        </p>
        <button type="button" onClick={reload}>
          Retry Today
        </button>
      </section>
    );

  const { data, selectedIds, playedIds, offline } = state.snapshot;
  const byId = new Map(data.games.map((game) => [game.id, game]));
  const games = selectedIds
    .map((id) => byId.get(id))
    .filter((game): game is CatalogGame => game !== undefined);
  const canEdit = online && !offline && playedIds !== null;
  const numberPlayed =
    playedIds?.filter((id) => selectedIds.includes(id)).length ?? 0;

  return (
    <div className="today-page">
      <header className="today-heading">
        <p className="eyebrow">YOUR DAILY RITUAL</p>
        <h1>Today in your arcade.</h1>
        <p className="today-date">{day}</p>
        <p>
          Your selected puzzles, in your own order. Play as many or as few as
          you like.
        </p>
        {playedIds !== null && !offline && games.length > 0 && (
          <div
            className="today-summary"
            role="group"
            aria-label="Manually marked played today"
          >
            <span>
              {numberPlayed} / {games.length} marked played
            </span>
            <progress
              value={numberPlayed}
              max={games.length}
              aria-label="Manual played marks, not verified results"
            />
          </div>
        )}
      </header>

      {(!online || offline) && (
        <div className="notice" role="status">
          {offline
            ? "Showing previously viewed games where available. Manual played status is unavailable; changes require a connection."
            : "You appear to be offline. You can view saved games, but marking played requires a connection."}
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
      )}
      {statusError && (
        <p className="notice error" role="alert">
          {statusError}
        </p>
      )}
      <section className="panel" aria-labelledby="today-rotation">
        <div className="today-toolbar">
          <h2 id="today-rotation">My daily rotation</h2>
          <a href="/lineup">Edit lineup</a>
        </div>
        {games.length === 0 ? (
          <div>
            <p>
              No games selected yet. Add your favorites to build a daily
              rotation.
            </p>
            <a href="/games">Find games</a>
          </div>
        ) : (
          <>
            {playedIds !== null && !offline && (
              <p className="muted" role="status">
                Progress is based only on manual played marks, not verified
                puzzle results.
              </p>
            )}
            <ol className="today-list">
              {games.map((game) => {
                const link = safePublisherUrl(game.canonicalUrl);
                const launchable = canLaunchGame(game) && Boolean(link);
                const marked = playedIds?.includes(game.id) ?? false;
                return (
                  <li key={game.id} className="today-game">
                    <div className="today-game-info">
                      <span
                        className={"game-avatar " + game.slug}
                        aria-hidden="true"
                      >
                        {game.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="today-game-copy">
                        <h3>{game.name}</h3>
                        <p>{game.publisher ?? "External game publisher"}</p>
                        <span
                          className={
                            "status-pill" +
                            (marked && playedIds !== null && !offline
                              ? " marked"
                              : "")
                          }
                        >
                          {manualPlayedLabel(
                            marked,
                            playedIds !== null && !offline,
                          )}
                        </span>
                        <small>
                          {gameAvailabilityLabel(game)} · Scores not saved yet
                        </small>
                      </div>
                    </div>
                    <div className="today-actions">
                      {launchable && link ? (
                        <a
                          className="action-link"
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            recordPublisherLaunch(launchStorage(), game.slug)
                          }
                        >
                          Play at publisher
                        </a>
                      ) : (
                        <span className="muted">
                          Publisher link unavailable
                        </span>
                      )}
                      <button
                        type="button"
                        className={marked ? "marked" : ""}
                        disabled={!canEdit || savingId !== null}
                        aria-label={`${marked ? "Unmark" : "Mark"} ${game.name} played today`}
                        onClick={() => void togglePlayed(game.id, !marked)}
                      >
                        {savingId === game.id
                          ? "Saving…"
                          : marked
                            ? "Unmark played"
                            : "Mark played"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
      <section className="panel" aria-labelledby="today-help">
        <div className="today-toolbar">
          <h2 id="today-help">Returning from a publisher</h2>
          <a href="/how-it-works">How it works</a>
        </div>
        <p>
          Publisher games may open in a Safari tab or another browser context.
          Return to Daydle from the tab switcher or home screen, then choose
          <strong> Paste Results</strong>. The text can be pasted manually;
          result parsing and saving will be enabled in a later phase.
        </p>
        <p className="muted">
          On iPhone Safari, Share → Add to Home Screen installs Daydle. An
          installed web app can maintain separate browser storage and may not
          receive external page redirects automatically.
        </p>
      </section>
    </div>
  );
}
