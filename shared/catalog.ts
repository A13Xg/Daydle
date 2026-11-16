import type { GameCadence, GameLifecycle, ParserSupport } from "./domain";

export type LinkStatus = "verified" | "unverified" | "broken";

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  publisher: string | null;
  canonicalUrl: string;
  iconUrl: string | null;
  status: GameLifecycle;
  cadence: GameCadence;
  timezoneName: string | null;
  parserStatus: ParserSupport;
  linkStatus: LinkStatus;
  linkCheckedAt: string | null;
  categorySlugs: string[];
}

export interface CatalogFilters {
  query: string;
  category: string;
  support: "all" | "supported" | "unsupported";
  showArchived: boolean;
}

export function safePublisherUrl(
  input: string | null | undefined,
): string | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  if (/[\u0000-\u001f\u007f]/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost"))
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function canLaunchGame(game: CatalogGame): boolean {
  return (
    game.status === "active" &&
    game.linkStatus !== "broken" &&
    safePublisherUrl(game.canonicalUrl) !== null
  );
}

export function canAddGame(game: CatalogGame): boolean {
  return canLaunchGame(game);
}

export function filterCatalog(
  games: CatalogGame[],
  filters: CatalogFilters,
): CatalogGame[] {
  const query = filters.query.trim().toLowerCase();
  return games.filter((game) => {
    if (!filters.showArchived && game.status !== "active") return false;
    if (filters.category && !game.categorySlugs.includes(filters.category))
      return false;
    if (filters.support === "supported" && game.parserStatus !== "supported")
      return false;
    if (filters.support === "unsupported" && game.parserStatus === "supported")
      return false;
    if (!query) return true;
    return [
      game.name,
      game.description,
      game.publisher ?? "",
      game.slug,
      ...game.categorySlugs,
    ].some((field) => field.toLowerCase().includes(query));
  });
}

export function moveSelection(
  ids: string[],
  gameId: string,
  direction: -1 | 1,
): string[] {
  const index = ids.indexOf(gameId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ids.length) return ids;
  const result = [...ids];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}

export function parserSupportLabel(status: ParserSupport): string {
  return status === "supported"
    ? "Results supported"
    : status === "experimental"
      ? "Experimental results"
      : "Results not supported yet";
}

export function gameAvailabilityLabel(game: CatalogGame): string {
  if (game.status === "retired") return "Archived game";
  if (game.status === "inactive") return "Unavailable";
  if (game.linkStatus === "broken") return "Publisher link unavailable";
  return "Playable on publisher site";
}
