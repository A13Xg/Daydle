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
          "Your save response was interrupted. We reloaded your status; check it before continuing.",
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
      <section className="panel" aria-labelledby="today-title">
        <h1 id="today-title">Today</h1>
        <p>Choose your daily games, then return here to track your play.</p>
        <p>
          <a href="/auth">Sign in with Apple or Google</a> to see your saved
          games.
        </p>
        <a href="/games">Browse games without signing in</a>
      </section>
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
        <h1>Today</h1>
        <p>{day} · Your selected games, in your preferred order</p>
        <p>Participation is optional. Missing a day is not a failure.</p>
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
          <a href="/games">Manage games</a>
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
                {numberPlayed} of {games.length} manually marked played. This is
                not a count of verified results.
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
                      <h3>{game.name}</h3>
                      <p>{game.publisher ?? "External game publisher"}</p>
                      <small>{gameAvailabilityLabel(game)}</small>
                      <small>
                        {manualPlayedLabel(
                          marked,
                          playedIds !== null && !offline,
                        )}
                      </small>
                      <small>Result saving is not available yet.</small>
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
        <h2 id="today-help">Returning from a publisher</h2>
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
