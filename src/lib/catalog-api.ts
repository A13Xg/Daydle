import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogCategory, CatalogGame, LinkStatus } from "../../shared/catalog";
import type { GameCadence, GameLifecycle, ParserSupport } from "../../shared/domain";

interface GameRow {
  id: string; slug: string; name: string; description: string;
  publisher: string | null; canonical_url: string; icon_url: string | null;
  status: GameLifecycle; cadence: GameCadence; timezone_name: string | null;
  parser_status: ParserSupport; link_status: LinkStatus; link_checked_at: string | null;
}
interface CategoryRow { id: string; slug: string; name: string }
interface GameCategoryRow { game_id: string; category_id: string }
interface SelectionRow { game_id: string; sort_order: number }

export interface CatalogData {
  games: CatalogGame[];
  categories: CatalogCategory[];
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message || "Unable to load catalog data.");
}

export async function loadCatalog(client: SupabaseClient): Promise<CatalogData> {
  const [gameQuery, categoryQuery, linkQuery] = await Promise.all([
    client.from("games").select(
      "id,slug,name,description,publisher,canonical_url,icon_url,status,cadence,timezone_name,parser_status,link_status,link_checked_at",
    ).order("name"),
    client.from("game_categories").select("id,slug,name").order("name"),
    client.from("game_category_links").select("game_id,category_id"),
  ]);
  throwIfError(gameQuery.error);
  throwIfError(categoryQuery.error);
  throwIfError(linkQuery.error);
  if (!Array.isArray(gameQuery.data) || !Array.isArray(categoryQuery.data) ||
      !Array.isArray(linkQuery.data)) {
    throw new Error("Catalog response was incomplete.");
  }

  const categories = categoryQuery.data as CategoryRow[];
  const ids = new Map(categories.map((category) => [category.id, category.slug]));
  const gameCategories = new Map<string, string[]>();
  for (const link of linkQuery.data as GameCategoryRow[]) {
    const slug = ids.get(link.category_id);
    if (!slug) continue;
    gameCategories.set(link.game_id, [...(gameCategories.get(link.game_id) ?? []), slug]);
  }

  const games = (gameQuery.data as GameRow[]).map((game): CatalogGame => ({
    id: game.id, slug: game.slug, name: game.name, description: game.description,
    publisher: game.publisher, canonicalUrl: game.canonical_url,
    iconUrl: game.icon_url, status: game.status, cadence: game.cadence,
    timezoneName: game.timezone_name, parserStatus: game.parser_status,
    linkStatus: game.link_status, linkCheckedAt: game.link_checked_at,
    categorySlugs: gameCategories.get(game.id) ?? [],
  }));

  return { games, categories };
}

export async function loadSelectedGames(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from("user_games")
    .select("game_id,sort_order").eq("user_id", userId).order("sort_order");
  throwIfError(error);
  if (!Array.isArray(data)) throw new Error("Saved-game response was incomplete.");
  return (data as SelectionRow[]).map((row) => row.game_id);
}

export async function saveSelectedGames(
  client: SupabaseClient,
  gameIds: string[],
): Promise<string[]> {
  if (gameIds.length > 100 || new Set(gameIds).size !== gameIds.length) {
    throw new Error("Invalid game selection.");
  }
  const { data, error } = await client.rpc("set_my_games", { p_game_ids: gameIds });
  throwIfError(error);
  if (!Array.isArray(data)) throw new Error("The server did not confirm your changes.");
  const rows = data as SelectionRow[];
  if (rows.length !== gameIds.length ||
      rows.some((row, index) =>
        row.game_id !== gameIds[index] || row.sort_order !== index)) {
    throw new Error("Saved-game order did not match the requested order.");
  }
  return rows.map((row) => row.game_id);
}
