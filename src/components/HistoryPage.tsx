import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedResult } from "../../shared/results";
import {
  deleteResult,
  getResultDetail,
  loadResultHistory,
  resultErrorText,
} from "../lib/results-api";
import { ArcadeIcon } from "./ArcadeIcon";

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: SavedResult[]; hasMore: boolean };

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: SavedResult };

const PAGE_SIZE = 20;

function niceDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString();
}

function metricSummary(item: SavedResult): string {
  const outcome = item.outcome === "win" ? "Solved" :
    item.outcome === "loss" ? "Not solved" :
    item.outcome === "complete" ? "Completed" : "Incomplete";
  if (item.attempts !== null) return outcome + " · " + item.attempts + " attempts";
  if (item.completion_time_ms !== null) return outcome + " · " + Math.round(item.completion_time_ms / 1000) + " seconds";
  return outcome;
}

export function HistoryPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [game, setGame] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [moreLoading, setMoreLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    function updateOnline() { setOnline(navigator.onLine); }
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!client || !userId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    setNotice("");
    void loadResultHistory(
      client, userId,
      { game: game.trim() || undefined, limit: PAGE_SIZE },
      controller.signal,
    ).then((items) => {
      if (!controller.signal.aborted) setState({
        status: "ready", items, hasMore: items.length === PAGE_SIZE,
      });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setState({
        status: "error", message: resultErrorText(cause),
      });
    });
    return () => controller.abort();
  }, [client, userId, game, refresh]);

  useEffect(() => {
    if (!client || !userId || !selectedId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetail({ status: "loading" });
    void getResultDetail(client, userId, selectedId, controller.signal).then((value) => {
      if (!controller.signal.aborted) setDetail({ status: "ready", value });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setDetail({
        status: "error", message: resultErrorText(cause),
      });
    });
    return () => controller.abort();
  }, [client, userId, selectedId, refresh]);

  async function loadMore() {
    if (!client || !userId || state.status !== "ready" || moreLoading || !online) return;
    setMoreLoading(true);
    setNotice("");
    try {
      const batch = await loadResultHistory(client, userId, {
        game: game.trim() || undefined,
        limit: PAGE_SIZE,
        offset: state.items.length,
      });
      setState((previous) => previous.status === "ready" ? {
        status: "ready",
        items: [...previous.items, ...batch],
        hasMore: batch.length === PAGE_SIZE,
      } : previous);
    } catch (cause) {
      setNotice(resultErrorText(cause));
    } finally {
      setMoreLoading(false);
    }
  }

  async function performDelete() {
    if (!client || !userId || !deleteId || deleting || !online) return;
    setDeleting(true);
    setNotice("");
    try {
      await deleteResult(client, userId, deleteId);
      setNotice("Your result was deleted. Your history has been refreshed.");
      setDeleteId(null);
      setSelectedId(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setNotice(resultErrorText(cause));
    } finally {
      setDeleting(false);
    }
  }

  if (!client || !userId) {
    return (
      <section className="panel" aria-labelledby="history-heading">
        <h1 id="history-heading">Result history</h1>
        <p>Your saved results are private until you sign in.</p>
        <a href="/auth">Sign in to view history</a>
      </section>
    );
  }

  return (
    <div className="history-page">
      <header className="history-intro">
        <p className="eyebrow">YOUR PUZZLE ARCHIVE</p>
        <h1 id="history-heading">Result history</h1>
        <p>Review your saved results, correct an entry by pasting a new share, or permanently delete an entry.</p>
      </header>
      {!online && (
        <p className="notice" role="status">
          You appear to be offline. History requires a connection; no private results are cached on this device.
        </p>
      )}
      <div className="panel history-controls">
        <div className="field">
          <label htmlFor="history-game">Filter by game slug</label>
          <input
            id="history-game"
            value={game}
            onChange={(event) => {
              setGame(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64));
              setSelectedId(null);
              setDeleteId(null);
            }}
            placeholder="All games (e.g. wordle)"
            autoComplete="off"
          />
        </div>
        <button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={!online}>
          <ArcadeIcon name="refresh" size={17} /> Refresh
        </button>
      </div>
      {state.status === "loading" ? (
        <section className="panel" role="status"><p>Loading your result history…</p></section>
      ) : state.status === "error" ? (
        <section className="panel" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => setRefresh((n) => n + 1)}>Retry</button>
        </section>
      ) : state.items.length === 0 ? (
        <section className="panel history-empty">
          <h2>No results here yet</h2>
          <p>Play a supported publisher puzzle and submit one complete share message through Paste Results.</p>
          <a href="/games">Discover supported games</a>
        </section>
      ) : (
        <section className="panel" aria-labelledby="saved-results-heading">
          <h2 id="saved-results-heading">Saved results</h2>
          <ol className="history-list">
            {state.items.map((item) => (
              <li key={item.id} className="history-card">
                <div>
                  <h3>{item.game_name}</h3>
                  <p className="muted">Puzzle {item.puzzle_key} · {niceDate(item.submitted_at)}</p>
                  <p>{metricSummary(item)}</p>
                </div>
                <button
                  type="button"
                  aria-expanded={selectedId === item.id}
                  aria-controls="history-detail"
                  onClick={() => {
                    setSelectedId((selected) => selected === item.id ? null : item.id);
                    setDeleteId(null);
                  }}
                >
                  {selectedId === item.id ? "Close details" : "View details"}
                </button>
              </li>
            ))}
          </ol>
          {state.hasMore && (
            <button type="button" disabled={moreLoading || !online} onClick={() => void loadMore()}>
              {moreLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </section>
      )}
      {selectedId && (
        <section id="history-detail" className="panel history-detail" aria-labelledby="detail-heading">
          <h2 id="detail-heading">Result details</h2>
          {detail?.status === "loading" ? <p role="status">Loading details…</p> :
            detail?.status === "error" ? <p role="alert">{detail.message}</p> :
              detail?.status === "ready" ? (
                <>
                  <p><strong>{detail.value.game_name}</strong> · {detail.value.puzzle_key}</p>
                  <p>{metricSummary(detail.value)}</p>
                  <dl className="history-facts">
                    <div><dt>Saved on</dt><dd>{niceDate(detail.value.submitted_at)}</dd></div>
                    <div><dt>Puzzle date</dt><dd>{detail.value.puzzle_date ?? "Not provided by publisher"}</dd></div>
                    <div><dt>Parser version</dt><dd>{detail.value.parser_version}</dd></div>
                    <div><dt>Recorded corrections</dt><dd>{detail.value.correction_count ?? 0}</dd></div>
                  </dl>
                  <p className="muted">To correct this entry, paste a newer share for the same puzzle and explicitly choose Replace if the result differs.</p>
                  <button type="button" onClick={() => setDeleteId(detail.value.id)}>
                    Delete this result
                  </button>
                </>
              ) : null}
          {deleteId === selectedId && (
            <div className="notice" role="group" aria-label="Confirm result deletion">
              <p>This permanently deletes the result and its retained raw submissions. This action cannot be undone.</p>
              <button type="button" disabled={deleting || !online} onClick={() => void performDelete()}>
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button type="button" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
            </div>
          )}
        </section>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}
      <p className="muted history-retention">
        Raw submitted share text expires within 90 days; saved structured results remain until deleted.
        History and detailed results require a live authenticated connection.
      </p>
    </div>
  );
}
