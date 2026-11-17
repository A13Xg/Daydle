import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameRequest } from "../../shared/administration";
import {
  administrationErrorText,
  loadGameRequests,
  mutateGameRequest,
} from "../lib/administration-api";

export function GameRequestsPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [items, setItems] = useState<GameRequest[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    loadGameRequests(client ?? undefined, userId, offset, abort.signal).then(
      (rows) => {
        if (!abort.signal.aborted) {
          setItems(rows);
          setLoading(false);
        }
      },
      (cause: unknown) => {
        if (!abort.signal.aborted) {
          setError(administrationErrorText(cause));
          setLoading(false);
        }
      },
    );
    return () => abort.abort();
  }, [client, userId, offset, revision]);

  async function act(
    action: "create" | "vote" | "unvote",
    data: { id?: string; name?: string; url?: string; notes?: string },
  ) {
    if (!client || !userId || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await mutateGameRequest(client, userId, action, data);
      if (action === "create") {
        setName("");
        setUrl("");
        setNotes("");
        setOffset(0);
        setSuccess("Game request submitted for review.");
      } else {
        setSuccess("Vote updated.");
      }
      reload();
    } catch (cause) {
      setError(administrationErrorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">Community arcade</p>
        <h1>Request a game</h1>
        <p className="lead">
          Suggest publisher-hosted games for the catalog, or vote on existing
          requests. Approval does not guarantee result parsing support.
        </p>
      </header>
      {userId ? (
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void act("create", { name, url, notes });
          }}
        >
          <h2>Suggest a game</h2>
          <div className="field">
            <label htmlFor="suggestion-name">Game name</label>
            <input
              id="suggestion-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor="suggestion-url">Official game URL (HTTPS)</label>
            <input
              id="suggestion-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              maxLength={2048}
              placeholder="https://publisher.example/game"
            />
          </div>
          <div className="field">
            <label htmlFor="suggestion-notes">Why add it? (optional)</label>
            <textarea
              id="suggestion-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <button disabled={busy} type="submit">
            {busy ? "Submitting…" : "Submit request"}
          </button>
        </form>
      ) : (
        <section className="panel">
          <p>Sign in to submit a game or vote. You can browse requests below.</p>
          <a className="action-link" href="/auth">
            Sign in
          </a>
        </section>
      )}
      {success && <p className="notice" role="status">{success}</p>}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      <section aria-labelledby="request-list-heading">
        <h2 id="request-list-heading">Community requests</h2>
        {loading ? (
          <p role="status">Loading requests…</p>
        ) : !error && items.length === 0 ? (
          <div className="panel">
            <p>No requests on this page yet.</p>
          </div>
        ) : (
          <ul className="today-list">
            {items.map((item) => (
              <li className="panel" key={item.id}>
                <span className="status-pill">{item.status}</span>
                <h3>{item.name}</h3>
                {item.notes && <p>{item.notes}</p>}
                <p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    Publisher page
                  </a>
                </p>
                <div className="today-toolbar">
                  <span>
                    {item.vote_count} {item.vote_count === 1 ? "vote" : "votes"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !userId}
                    aria-pressed={item.voted_by_me}
                    onClick={() =>
                      void act(item.voted_by_me ? "unvote" : "vote", {
                        id: item.id,
                      })
                    }
                  >
                    {item.voted_by_me ? "Remove vote" : "Vote"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="today-toolbar">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - 20))}
            disabled={loading || offset === 0}
          >
            Previous
          </button>
          <span>Page {Math.floor(offset / 20) + 1}</span>
          <button
            type="button"
            onClick={() => setOffset(offset + 20)}
            disabled={loading || items.length < 20}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
