import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedResult } from "../../shared/results";
import {
  deleteResult,
  getResultDetail,
  loadResultHistory,
  resultErrorText,
} from "../lib/results-api";
import {
  puzzleDisplayName,
  resultDetails,
  resultOutcomeLabel,
  resultSummary,
  supportedResultGames,
} from "../lib/result-view";
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
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
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
  const [detailRetry, setDetailRetry] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const generation = useRef(0);
  const nextPageRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    function updateOnline() {
      setOnline(navigator.onLine);
    }
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
    const current = ++generation.current;
    nextPageRequest.current?.abort();
    setMoreLoading(false);
    setState({ status: "loading" });
    void loadResultHistory(
      client,
      userId,
      { game: game || undefined, limit: PAGE_SIZE },
      controller.signal,
    )
      .then((items) => {
        if (!controller.signal.aborted && generation.current === current) {
          setState({
            status: "ready",
            items,
            hasMore: items.length === PAGE_SIZE,
          });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && generation.current === current) {
          setState({ status: "error", message: resultErrorText(cause) });
        }
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
    void getResultDetail(client, userId, selectedId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDetail({ status: "ready", value });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setDetail({ status: "error", message: resultErrorText(cause) });
        }
      });
    return () => controller.abort();
  }, [client, userId, selectedId, refresh, detailRetry]);

  function changeFilter(value: string) {
    generation.current += 1;
    nextPageRequest.current?.abort();
    setGame(value);
    setSelectedId(null);
    setDeleteId(null);
    setNotice("");
    setMoreLoading(false);
  }

  function reload() {
    generation.current += 1;
    nextPageRequest.current?.abort();
    setRefresh((n) => n + 1);
  }

  async function loadMore() {
    if (
      !client ||
      !userId ||
      state.status !== "ready" ||
      moreLoading ||
      !online
    )
      return;
    const request = new AbortController();
    nextPageRequest.current = request;
    const current = generation.current;
    setMoreLoading(true);
    setNotice("");
    try {
      const batch = await loadResultHistory(
        client,
        userId,
        {
          game: game || undefined,
          limit: PAGE_SIZE,
          offset: state.items.length,
        },
        request.signal,
      );
      if (request.signal.aborted || current !== generation.current) return;
      setState((previous) =>
        previous.status === "ready"
          ? {
              status: "ready",
              items: [...previous.items, ...batch],
              hasMore: batch.length === PAGE_SIZE,
            }
          : previous,
      );
    } catch (cause) {
      if (!request.signal.aborted && current === generation.current) {
        setNotice(resultErrorText(cause));
      }
    } finally {
      if (nextPageRequest.current === request) {
        nextPageRequest.current = null;
        setMoreLoading(false);
      }
    }
  }

  async function performDelete() {
    if (!client || !userId || !deleteId || deleting || !online) return;
    const requestedId = deleteId;
    setDeleting(true);
    setNotice("");
    try {
      await deleteResult(client, userId, requestedId);
      setNotice("Result deleted. The list has been refreshed.");
      setDeleteId(null);
      setSelectedId(null);
      reload();
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
        <p>
          Review each publisher result, see the recorded metrics and
          corrections, or permanently delete an entry.
        </p>
      </header>
      {!online && (
        <p className="notice" role="status">
          You appear to be offline. History requires a connection; no private
          results are cached on this device.
        </p>
      )}
      <div className="panel history-controls">
        <div className="field">
          <label htmlFor="history-game">Filter by game</label>
          <select
            id="history-game"
            value={game}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="">All supported games</option>
            {supportedResultGames.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={reload} disabled={!online}>
          <ArcadeIcon name="refresh" size={17} /> Refresh
        </button>
      </div>
      {state.status === "loading" ? (
        <section className="panel" role="status">
          <p>Loading your result history…</p>
        </section>
      ) : state.status === "error" ? (
        <section className="panel" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={reload} disabled={!online}>
            Retry
          </button>
        </section>
      ) : state.items.length === 0 ? (
        <section className="panel history-empty">
          <h2>No results {game ? "for this game" : "here yet"}</h2>
          <p>
            Play a supported publisher puzzle and submit one complete share
            message through Paste Results.
          </p>
          {game ? (
            <button type="button" onClick={() => changeFilter("")}>
              Show all games
            </button>
          ) : (
            <a href="/games">Discover supported games</a>
          )}
        </section>
      ) : (
        <section className="panel" aria-labelledby="saved-results-heading">
          <div className="history-list-heading">
            <h2 id="saved-results-heading">Saved results</h2>
            <p className="muted">
              {state.items.length} shown
              {state.hasMore ? " · More available" : ""}
            </p>
          </div>
          <ol className="history-list">
            {state.items.map((item) => {
              const expanded = selectedId === item.id;
              const detailId = "history-detail-" + item.id;
              return (
                <li key={item.id} className="history-entry">
                  <div className="history-card">
                    <span className={"history-outcome outcome-" + item.outcome}>
                      {resultOutcomeLabel(item.outcome)}
                    </span>
                    <div className="history-card-copy">
                      <h3>{item.game_name}</h3>
                      <p>{puzzleDisplayName(item.puzzle_key)}</p>
                      <p className="muted">
                        {resultSummary(item)} · Saved{" "}
                        {niceDate(item.submitted_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailId : undefined}
                      onClick={() => {
                        setSelectedId(expanded ? null : item.id);
                        setDeleteId(null);
                      }}
                    >
                      {expanded ? "Close details" : "View details"}
                    </button>
                  </div>
                  {expanded && (
                    <section
                      id={detailId}
                      className="history-detail"
                      aria-label={"Details for " + item.game_name}
                    >
                      {detail?.status === "loading" ? (
                        <p role="status">Loading details…</p>
                      ) : detail?.status === "error" ? (
                        <div role="alert">
                          <p>{detail.message}</p>
                          <button
                            type="button"
                            onClick={() => setDetailRetry((n) => n + 1)}
                          >
                            Retry details
                          </button>
                        </div>
                      ) : detail?.status === "ready" &&
                        detail.value.id === item.id ? (
                        <>
                          <dl className="history-facts">
                            <div>
                              <dt>Puzzle</dt>
                              <dd>
                                {puzzleDisplayName(detail.value.puzzle_key)}
                              </dd>
                            </div>
                            <div>
                              <dt>Puzzle date</dt>
                              <dd>
                                {detail.value.puzzle_date ?? "Not provided"}
                              </dd>
                            </div>
                            <div>
                              <dt>Recorded on</dt>
                              <dd>{niceDate(detail.value.submitted_at)}</dd>
                            </div>
                            <div>
                              <dt>Corrections</dt>
                              <dd>{detail.value.correction_count ?? 0}</dd>
                            </div>
                            <div>
                              <dt>Parser version</dt>
                              <dd>{detail.value.parser_version}</dd>
                            </div>
                          </dl>
                          {resultDetails(detail.value).length > 0 && (
                            <div className="history-metrics">
                              <h4>Game metrics</h4>
                              <dl className="history-facts">
                                {resultDetails(detail.value).map(
                                  ({ label, value }) => (
                                    <div key={label}>
                                      <dt>{label}</dt>
                                      <dd>{value}</dd>
                                    </div>
                                  ),
                                )}
                              </dl>
                            </div>
                          )}
                          <p className="muted">
                            Correct an entry by submitting a new share for the
                            same puzzle and explicitly confirming replacement.
                          </p>
                          <button
                            className="history-delete-trigger"
                            type="button"
                            onClick={() => setDeleteId(item.id)}
                            disabled={deleting}
                          >
                            Delete this result
                          </button>
                        </>
                      ) : null}
                      {deleteId === item.id && (
                        <div
                          className="history-delete-confirm"
                          role="group"
                          aria-label="Confirm result deletion"
                        >
                          <p>
                            Delete this result and its retained share text? This
                            cannot be undone.
                          </p>
                          <div className="history-confirm-actions">
                            <button
                              type="button"
                              disabled={deleting || !online}
                              onClick={() => void performDelete()}
                            >
                              {deleting ? "Deleting…" : "Confirm delete"}
                            </button>
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => setDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </li>
              );
            })}
          </ol>
          {state.hasMore && (
            <button
              type="button"
              disabled={moreLoading || !online}
              onClick={() => void loadMore()}
            >
              {moreLoading ? "Loading…" : "Load more results"}
            </button>
          )}
        </section>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <p className="muted history-retention">
        Raw submitted text has a 90-day expiry date; automated purge is
        scheduled for a later phase. Structured results remain until deleted.
        History requires an authenticated connection.
      </p>
    </div>
  );
}
