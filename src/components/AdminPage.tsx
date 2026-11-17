import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminView, AdminAction } from "../../shared/administration";
import {
  administrationErrorText,
  loadAdminView,
  mutateAdmin,
} from "../lib/administration-api";

type AdminSection = Exclude<AdminView, "sample">;
interface AdminRow {
  id?: string;
  slug?: string;
  name?: string;
  url?: string;
  description?: string;
  publisher?: string | null;
  cadence?: string;
  status?: string;
  parser_status?: string;
  link_status?: string;
  category_slugs?: string[];
  game_slug?: string;
  parser_version?: string;
  day?: string;
  notes?: string;
  vote_count?: number;
  reason?: string;
  review_status?: string;
  received_at?: string;
  expires_at?: string;
  disposition?: string;
  samples?: number;
  user_id?: string;
  created_at?: string;
}
interface SampleDetail {
  id: string;
  raw_text: string;
  disposition: string;
  diagnostics: Record<string, unknown>;
  expires_at: string;
}
interface GameForm {
  id: string;
  slug: string;
  name: string;
  url: string;
  description: string;
  publisher: string;
  categories: string;
  cadence: string;
  status: string;
}
const EMPTY_GAME: GameForm = {
  id: "",
  slug: "",
  name: "",
  url: "",
  description: "",
  publisher: "",
  categories: "",
  cadence: "daily",
  status: "active",
};
const SECTIONS: readonly AdminSection[] = [
  "overview",
  "requests",
  "games",
  "samples",
  "diagnostics",
  "restrictions",
];

export function AdminPage({
  client,
  userId,
}: {
  client: SupabaseClient;
  userId: string | null;
}) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [game, setGame] = useState<GameForm>(EMPTY_GAME);
  const [targetUser, setTargetUser] = useState("");
  const [restrictionReason, setRestrictionReason] = useState("");
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [sampleGame, setSampleGame] = useState("");
  const [sampleNotes, setSampleNotes] = useState("");

  function reload() {
    setRevision((n) => n + 1);
  }

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setSample(null);
    setRows([]);
    setOverview({});
    setDenied(false);
    loadAdminView(
      client,
      userId,
      section,
      offset,
      undefined,
      abort.signal,
    ).then(
      (data) => {
        if (abort.signal.aborted) return;
        setRows(Array.isArray(data) ? (data as AdminRow[]) : []);
        setOverview(
          data && typeof data === "object" && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : {},
        );
        setDenied(false);
        setLoading(false);
      },
      (cause: unknown) => {
        if (abort.signal.aborted) return;
        if (cause instanceof Error && cause.message === "admin_required")
          setDenied(true);
        setError(administrationErrorText(cause));
        setLoading(false);
      },
    );
    return () => abort.abort();
  }, [client, userId, section, offset, revision]);

  async function submit(
    action: AdminAction,
    data: Record<string, string | null>,
  ) {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await mutateAdmin(client, userId, action, data);
      setMessage("Changes saved.");
      if (action === "save_game") setGame(EMPTY_GAME);
      if (action === "review_sample") setSample(null);
      reload();
    } catch (cause) {
      setError(administrationErrorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function inspectSample(id: string) {
    if (!userId) return;
    setError("");
    setSample(null);
    try {
      const result = await loadAdminView(client, userId, "sample", 0, id);
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        "raw_text" in result &&
        typeof result.raw_text === "string" &&
        "id" in result &&
        result.id === id
      ) {
        setSample(result as SampleDetail);
        setSampleGame("");
        setSampleNotes("");
      } else {
        setError("The sample is missing or expired.");
      }
    } catch (cause) {
      setError(administrationErrorText(cause));
    }
  }

  if (!userId)
    return (
      <section className="panel">
        <h1>Administration</h1>
        <p>Sign in with an authorized operator account to continue.</p>
        <a className="action-link" href="/auth">
          Sign in
        </a>
      </section>
    );

  if (denied)
    return (
      <section className="panel" role="alert">
        <h1>Access denied</h1>
        <p>Administrator access is not assigned to this account.</p>
        <a href="/today">Return to Daydle</a>
      </section>
    );

  return (
    <div className="catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">Restricted operations</p>
        <h1>Administration</h1>
        <p>Catalog maintenance, game requests and private parser triage.</p>
      </header>
      <div className="field">
        <label htmlFor="admin-section">Section</label>
        <select
          id="admin-section"
          value={section}
          onChange={(event) => {
            setSection(event.target.value as AdminSection);
            setOffset(0);
          }}
        >
          {SECTIONS.map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading {section}…</p>
      ) : (
        <>
          {section === "overview" && (
            <div className="panel">
              <h2>Operational summary</h2>
              <p>
                Pending game requests: {Number(overview.pending_requests ?? 0)}
              </p>
              <p>
                Unexpired unparsed samples:{" "}
                {Number(overview.unparsed_samples ?? 0)}
              </p>
              <p>
                Suggestion-restricted users:{" "}
                {Number(overview.restricted_users ?? 0)}
              </p>
              <p className="fine-print">
                Raw clipboard text is available only through an explicit sample
                inspection. These controls do not enable production deployment
                or migrations.
              </p>
            </div>
          )}

          {section === "requests" && (
            <ul className="today-list">
              {rows.map((row) => (
                <li className="panel" key={row.id}>
                  <span className="status-pill">{row.status}</span>
                  <h3>{row.name}</h3>
                  <p>{row.notes}</p>
                  <p>{row.vote_count ?? 0} votes</p>
                  {row.url && (
                    <a href={row.url} target="_blank" rel="noopener noreferrer">
                      Publisher page
                    </a>
                  )}
                  <div className="today-actions">
                    {(["approved", "rejected", "pending"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={busy || row.status === status}
                          onClick={() =>
                            void submit("moderate", {
                              id: row.id ?? "",
                              status,
                            })
                          }
                        >
                          {status}
                        </button>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {section === "games" && (
            <>
              <form
                className="panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit("save_game", {
                    ...game,
                    id: game.id || null,
                  });
                }}
              >
                <h2>{game.id ? "Edit game" : "Add catalog game"}</h2>
                {(
                  ["slug", "name", "url", "description", "publisher"] as const
                ).map((field) => (
                  <div className="field" key={field}>
                    <label htmlFor={"admin-" + field}>{field}</label>
                    <input
                      id={"admin-" + field}
                      required={
                        field === "slug" || field === "name" || field === "url"
                      }
                      readOnly={field === "slug" && Boolean(game.id)}
                      value={game[field]}
                      onChange={(event) =>
                        setGame((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="field">
                  <label htmlFor="admin-cadence">Cadence</label>
                  <select
                    id="admin-cadence"
                    value={game.cadence}
                    onChange={(event) =>
                      setGame((g) => ({ ...g, cadence: event.target.value }))
                    }
                  >
                    {[
                      "daily",
                      "weekly",
                      "irregular",
                      "multiple_daily",
                      "unknown",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="admin-status">Status</label>
                  <select
                    id="admin-status"
                    value={game.status}
                    onChange={(event) =>
                      setGame((g) => ({ ...g, status: event.target.value }))
                    }
                  >
                    {["active", "inactive", "retired"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={busy}>
                  Save game
                </button>
                {game.id && (
                  <button type="button" onClick={() => setGame(EMPTY_GAME)}>
                    Cancel editing
                  </button>
                )}
              </form>
              <ul className="today-list">
                {rows.map((row) => (
                  <li key={row.id} className="panel">
                    <h3>{row.name}</h3>
                    <p>
                      {row.slug} · {row.status} · Parser: {row.parser_status}
                    </p>
                    <div className="today-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setGame({
                            id: row.id ?? "",
                            slug: row.slug ?? "",
                            name: row.name ?? "",
                            url: row.url ?? "",
                            description: row.description ?? "",
                            publisher: row.publisher ?? "",
                            categories: row.category_slugs?.join(", ") ?? "",
                            cadence: row.cadence ?? "daily",
                            status: row.status ?? "active",
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy || row.status === "retired"}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Retire this game? Saved results will remain.",
                            )
                          )
                            void submit("retire_game", { id: row.id ?? "" });
                        }}
                      >
                        Retire
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {section === "samples" && (
            <>
              <p className="fine-print">
                Only unexpired unknown/invalid shares are listed. Raw text
                requires explicit inspection.
              </p>
              <ul className="today-list">
                {rows.map((row) => (
                  <li className="panel" key={row.id}>
                    <h3>{row.reason || "Unknown format"}</h3>
                    <p>
                      {row.disposition} · Review:{" "}
                      {row.review_status ?? "pending"}
                    </p>
                    <p>Expires: {row.expires_at}</p>
                    <button
                      type="button"
                      onClick={() => void inspectSample(row.id ?? "")}
                    >
                      Inspect raw sample
                    </button>
                  </li>
                ))}
              </ul>
              {sample && (
                <section className="panel" aria-label="Private sample review">
                  <h2>Private retained sample</h2>
                  <p>Expires {sample.expires_at}</p>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {sample.raw_text}
                  </pre>
                  <div className="field">
                    <label htmlFor="sample-game">
                      Catalog game slug (optional)
                    </label>
                    <input
                      id="sample-game"
                      value={sampleGame}
                      onChange={(e) => setSampleGame(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sample-notes">Review notes</label>
                    <textarea
                      id="sample-notes"
                      rows={3}
                      maxLength={240}
                      value={sampleNotes}
                      onChange={(e) => setSampleNotes(e.target.value)}
                    />
                  </div>
                  <div className="today-actions">
                    <button
                      type="button"
                      disabled={busy || !sampleGame.trim()}
                      onClick={() =>
                        void submit("review_sample", {
                          id: sample.id,
                          status: "classified",
                          gameSlug: sampleGame || null,
                          notes: sampleNotes,
                        })
                      }
                    >
                      Classify
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void submit("review_sample", {
                          id: sample.id,
                          status: "ignored",
                          gameSlug: null,
                          notes: sampleNotes,
                        })
                      }
                    >
                      Ignore
                    </button>
                    <button type="button" onClick={() => setSample(null)}>
                      Close
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {section === "diagnostics" && (
            <div className="panel">
              <h2>Last 30 days · unexpired samples</h2>
              <ul>
                {rows.map((row, index) => (
                  <li key={index}>
                    {row.day ?? "unknown day"} · {row.game_slug ?? "unknown game"} · {row.parser_version ?? "unknown version"} · {row.reason ?? "parsed"} / {row.disposition}:{" "}
                    {row.samples ?? 0}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section === "restrictions" && (
            <>
              <form
                className="panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit("restrict", {
                    userId: targetUser,
                    reason: restrictionReason,
                  });
                }}
              >
                <h2>Restrict request and voting privileges</h2>
                <p className="fine-print">
                  This does not disable login, results or friendships.
                </p>
                <div className="field">
                  <label htmlFor="restrict-user">User UUID</label>
                  <input
                    id="restrict-user"
                    required
                    value={targetUser}
                    onChange={(event) => setTargetUser(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="restrict-reason">Internal reason</label>
                  <input
                    id="restrict-reason"
                    required
                    maxLength={240}
                    value={restrictionReason}
                    onChange={(event) =>
                      setRestrictionReason(event.target.value)
                    }
                  />
                </div>
                <button type="submit" disabled={busy}>
                  Apply restriction
                </button>
              </form>
              <ul className="today-list">
                {rows.map((row) => (
                  <li className="panel" key={row.user_id}>
                    <h3>{row.user_id}</h3>
                    <p>{row.reason}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void submit("unrestrict", { userId: row.user_id ?? "" })
                      }
                    >
                      Remove restriction
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {section !== "overview" && rows.length === 0 && (
            <p className="panel">No records in this section.</p>
          )}
          {section !== "overview" && section !== "diagnostics" && (
            <div className="today-toolbar">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Previous
              </button>
              <span>Page {Math.floor(offset / 20) + 1}</span>
              <button
                type="button"
                disabled={rows.length < 20}
                onClick={() => setOffset(offset + 20)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
