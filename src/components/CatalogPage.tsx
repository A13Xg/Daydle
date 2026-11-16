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
  saveSelectedGames,
  type CatalogData,
} from "../lib/catalog-api";
import { GameDetailPage } from "./GameDetailPage";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CatalogData };

export interface CatalogPageProps {
  client: SupabaseClient | null;
  userId: string | null;
  detailSlug?: string;
}

export function CatalogPage({ client, userId, detailSlug }: CatalogPageProps) {
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionLoading, setSelectionLoading] = useState(Boolean(userId));
  const [selectionError, setSelectionError] = useState("");
  const [saveError, setSaveError] = useState("");
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
    if (!client) return;
    let active = true;
    setCatalogState({ status: "loading" });
    setSelectionLoading(Boolean(userId));
    setSelectionError("");
    setSaveError("");
    setSelectedIds([]);

    void loadCatalog(client)
      .then((data) => {
        if (active) setCatalogState({ status: "ready", data });
      })
      .catch(() => {
        if (active)
          setCatalogState({
            status: "error",
            message: "The game catalog could not be loaded.",
          });
      });

    if (userId) {
      void loadSelectedGames(client, userId)
        .then((ids) => {
          if (active) setSelectedIds(ids);
        })
        .catch(() => {
          if (active)
            setSelectionError("Your saved games could not be loaded.");
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
      selectionError
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await saveSelectedGames(client, next);
      setSelectedIds(saved);
    } catch {
      setSaveError(
        "Could not save your changes. Your previous selection was kept. Try again.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function toggleGame(id: string) {
    if (!userId || saveLock.current) return;
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
        {saveError && (
          <p role="alert" className="notice error">
            {saveError}
          </p>
        )}
        <GameDetailPage
          game={game}
          selected={selectedIds.includes(game.id)}
          signedIn={Boolean(userId)}
          saving={saving || selectionLoading || Boolean(selectionError)}
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

      {userId && (
        <section className="panel" aria-labelledby="my-games-heading">
          <h2 id="my-games-heading">My games</h2>
          {selectionLoading ? (
            <p role="status">Loading your games…</p>
          ) : selectionError ? (
            <div role="alert">
              <p>{selectionError}</p>
              <button type="button" onClick={() => setRetry((n) => n + 1)}>
                Retry saved games
              </button>
            </div>
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
                      disabled={saving || index === 0}
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
                      disabled={saving || index === selectedGames.length - 1}
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
                      disabled={saving}
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
