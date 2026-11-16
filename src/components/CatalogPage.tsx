import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAddGame,
  canLaunchGame,
  filterCatalog,
  gameAvailabilityLabel,
  moveSelection,
  parserSupportLabel,
  safePublisherUrl,
  type CatalogFilters,
  type CatalogGame,
} from "../../shared/catalog";
import {
  loadCatalog,
  loadSelectedGames,
  saveAndReconcileSelectedGames,
  type CatalogData,
} from "../lib/catalog-api";
import { GameDetailPage } from "./GameDetailPage";
import {
  readPublicCatalog,
  readSelectedSnapshot,
  savePublicCatalog,
  saveSelectedSnapshot,
} from "../lib/offline-snapshot";

function optionalLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CatalogData };

export interface CatalogPageProps {
  client: SupabaseClient | null;
  userId: string | null;
  detailSlug?: string;
}

export interface SelectionNoticeProps {
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/** Visible on both the catalog and direct game-detail routes. */
export function SelectionNotice({
  loading,
  error,
  onRetry,
}: SelectionNoticeProps) {
  if (loading) {
    return <p role="status">Loading your games…</p>;
  }

  if (error) {
    return (
      <div className="notice error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          Retry saved games
        </button>
      </div>
    );
  }

  return null;
}

export function CatalogPage({ client, userId, detailSlug }: CatalogPageProps) {
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionLoading, setSelectionLoading] = useState(Boolean(userId));
  const [selectionError, setSelectionError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [catalogOffline, setCatalogOffline] = useState(false);
  const [selectionReadOnly, setSelectionReadOnly] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const saveLock = useRef(false);
  const [filters, setFilters] = useState<CatalogFilters>({
    query: "",
    category: "",
    support: "all",
    showArchived: false,
  });

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      setRetry((n) => n + 1);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const storage = optionalLocalStorage();
    setCatalogState({ status: "loading" });
    setSelectionLoading(Boolean(userId));
    setSelectionError("");
    setSaveError("");
    setSelectedIds([]);
    setCatalogOffline(false);
    setSelectionReadOnly(false);

    void loadCatalog(client)
      .then((data) => {
        if (!active) return;
        savePublicCatalog(storage, data);
        setCatalogState({ status: "ready", data });
      })
      .catch(() => {
        if (!active) return;
        const cached = readPublicCatalog(storage);
        if (cached) {
          setCatalogOffline(true);
          setCatalogState({ status: "ready", data: cached });
        } else {
          setCatalogState({
            status: "error",
            message: "The game catalog could not be loaded.",
          });
        }
      });

    if (userId) {
      void loadSelectedGames(client, userId)
        .then((ids) => {
          if (!active) return;
          saveSelectedSnapshot(storage, userId, ids);
          setSelectedIds(ids);
        })
        .catch(() => {
          if (!active) return;
          const cached = readSelectedSnapshot(storage, userId);
          if (cached) {
            setSelectedIds(cached);
            setSelectionReadOnly(true);
          } else {
            setSelectionError("Your saved games could not be loaded.");
          }
        })
        .finally(() => {
          if (active) setSelectionLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [client, userId, retry]);

  async function commitSelection(next: string[]) {
    if (
      !client ||
      !userId ||
      saveLock.current ||
      selectionLoading ||
      selectionError ||
      catalogOffline ||
      selectionReadOnly ||
      !online
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const outcome = await saveAndReconcileSelectedGames(client, userId, next);
      setSelectedIds(outcome.gameIds);
      saveSelectedSnapshot(optionalLocalStorage(), userId, outcome.gameIds);
      if (!outcome.confirmed) {
        setSaveError(
          "The save response was uncertain. We reloaded your games from the server; review the current selection before editing again.",
        );
      }
    } catch {
      // Never trust a stale local list after a possibly committed write.
      // Keep editing disabled until a new authoritative read succeeds.
      setSelectionError(
        "Your last save could not be verified. Reload your saved games before making further changes.",
      );
      setSaveError("");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function toggleGame(id: string) {
    if (
      !userId ||
      saveLock.current ||
      selectionLoading ||
      selectionError ||
      catalogOffline ||
      selectionReadOnly ||
      !online
    )
      return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id];
    void commitSelection(next);
  }

  const data = catalogState.status === "ready" ? catalogState.data : null;
  const games = data?.games ?? [];
  const selectedGames = useMemo(() => {
    const lookup = new Map(games.map((game) => [game.id, game]));
    return selectedIds
      .map((id) => lookup.get(id))
      .filter((game): game is CatalogGame => game !== undefined);
  }, [games, selectedIds]);

  const editingDisabled =
    !online ||
    catalogOffline ||
    selectionReadOnly ||
    selectionLoading ||
    Boolean(selectionError);

  if (!client) {
    return (
      <section className="panel" role="status">
        <h1>Game catalog</h1>
        <p>
          The game catalog is not configured. Supabase public project settings
          are required.
        </p>
      </section>
    );
  }

  if (catalogState.status === "loading") {
    return (
      <section className="panel">
        <h1>Game catalog</h1>
        <p role="status" aria-live="polite">
          Loading daily games…
        </p>
      </section>
    );
  }

  if (catalogState.status === "error") {
    return (
      <section className="panel">
        <h1>Game catalog</h1>
        <p role="alert">{catalogState.message}</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Retry catalog
        </button>
      </section>
    );
  }

  if (detailSlug) {
    const game = games.find((candidate) => candidate.slug === detailSlug);
    if (!game)
      return (
        <section className="panel">
          <h1>Game not found</h1>
          <p>This title is no longer in the catalog.</p>
          <a href="/games">Browse all games</a>
        </section>
      );
    return (
      <>
        {(!online || catalogOffline || selectionReadOnly) && (
          <p className="notice" role="status">
            Showing previously viewed game information read-only. Saving and
            reordering need a connection.
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Retry
            </button>
          </p>
        )}
        {userId && (
          <SelectionNotice
            loading={selectionLoading}
            error={selectionError}
            onRetry={() => setRetry((n) => n + 1)}
          />
        )}
        {saveError && (
          <p role="alert" className="notice error">
            {saveError}
          </p>
        )}
        <GameDetailPage
          game={game}
          selected={selectedIds.includes(game.id)}
          signedIn={Boolean(userId)}
          saving={saving || editingDisabled}
          onToggle={toggleGame}
        />
      </>
    );
  }

  const filtered = filterCatalog(games, filters);
  return (
    <div className="catalog-page">
      <header className="catalog-heading">
        <h1>Discover daily games</h1>
        <p>
          Explore games on their publishers' websites, save your favorites and
          return to track results when support is available.
        </p>
      </header>

      {(!online || catalogOffline || selectionReadOnly) && (
        <div role="status" className="notice">
          Previously viewed games are available read-only. Saving and reordering
          require a connection.
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {userId && (
        <section className="panel" aria-labelledby="my-games-heading">
          <h2 id="my-games-heading">My games</h2>
          {selectionLoading || selectionError ? (
            <SelectionNotice
              loading={selectionLoading}
              error={selectionError}
              onRetry={() => setRetry((n) => n + 1)}
            />
          ) : selectedGames.length === 0 ? (
            <p>No saved games yet. Browse below and add your favorites.</p>
          ) : (
            <ol className="selected-games">
              {selectedGames.map((game, index) => (
                <li key={game.id}>
                  <span className="selected-game-title">{game.name}</span>
                  {!canLaunchGame(game) && (
                    <span className="muted">
                      {" "}
                      — {gameAvailabilityLabel(game)}
                    </span>
                  )}
                  <div className="selected-actions">
                    <button
                      type="button"
                      disabled={saving || editingDisabled || index === 0}
                      aria-label={`Move ${game.name} up`}
                      onClick={() =>
                        void commitSelection(
                          moveSelection(selectedIds, game.id, -1),
                        )
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={
                        saving ||
                        editingDisabled ||
                        index === selectedGames.length - 1
                      }
                      aria-label={`Move ${game.name} down`}
                      onClick={() =>
                        void commitSelection(
                          moveSelection(selectedIds, game.id, 1),
                        )
                      }
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      disabled={saving || editingDisabled}
                      onClick={() => toggleGame(game.id)}
                      aria-label={`Remove ${game.name} from my games`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {saving && (
            <p role="status" aria-live="polite">
              Saving your games…
            </p>
          )}
        </section>
      )}

      <section className="panel catalog-filters" aria-label="Catalog filters">
        <div className="field">
          <label htmlFor="catalog-search">Search games</label>
          <input
            id="catalog-search"
            type="search"
            value={filters.query}
            placeholder="Game title, publisher, or category"
            onChange={(event) =>
              setFilters((f) => ({ ...f, query: event.target.value }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="catalog-category">Category</label>
          <select
            id="catalog-category"
            value={filters.category}
            onChange={(event) =>
              setFilters((f) => ({ ...f, category: event.target.value }))
            }
          >
            <option value="">All categories</option>
            {(data?.categories ?? []).map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="catalog-support">Result tracking</label>
          <select
            id="catalog-support"
            value={filters.support}
            onChange={(event) =>
              setFilters((f) => ({
                ...f,
                support: event.target.value as CatalogFilters["support"],
              }))
            }
          >
            <option value="all">All games</option>
            <option value="supported">Supported games</option>
            <option value="unsupported">Not yet supported</option>
          </select>
        </div>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(event) =>
              setFilters((f) => ({ ...f, showArchived: event.target.checked }))
            }
          />
          Include archived or inactive titles
        </label>
      </section>

      {saveError && (
        <p role="alert" className="notice error">
          {saveError}
        </p>
      )}
      {!userId && (
        <p className="notice">
          You can browse without an account.
          <a href="/auth"> Sign in</a> to save and reorder your favorite games.
        </p>
      )}
      <section aria-label="Catalog games">
        <h2>
          {filtered.length} {filtered.length === 1 ? "game" : "games"} found
        </h2>
        {filtered.length === 0 ? (
          <div className="panel">
            <p>No games match these filters.</p>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  query: "",
                  category: "",
                  support: "all",
                  showArchived: false,
                })
              }
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="catalog-grid">
            {filtered.map((game) => {
              const selected = selectedIds.includes(game.id);
              const href = safePublisherUrl(game.canonicalUrl);
              const launchable = canLaunchGame(game) && Boolean(href);
              return (
                <li key={game.id} className="catalog-card">
                  <article>
                    <h3>
                      <a href={`/games/${encodeURIComponent(game.slug)}`}>
                        {game.name}
                      </a>
                    </h3>
                    <p className="muted">
                      {game.publisher ?? "Independent publisher"}
                    </p>
                    <p>{game.description}</p>
                    <p className="game-status">
                      <span>{parserSupportLabel(game.parserStatus)}</span>
                      <span>{gameAvailabilityLabel(game)}</span>
                    </p>
                    <div className="game-actions">
                      {launchable && href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Play at publisher
                        </a>
                      ) : (
                        <span className="muted">
                          Publisher link unavailable
                        </span>
                      )}
                      {userId ? (
                        <button
                          type="button"
                          disabled={
                            saving ||
                            editingDisabled ||
                            selectionLoading ||
                            Boolean(selectionError) ||
                            (!selected && !canAddGame(game))
                          }
                          onClick={() => toggleGame(game.id)}
                        >
                          {selected ? "Remove" : "Add to my games"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
