import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCatalog, loadSelectedGames, saveSelectedGames } from "../src/lib/catalog-api";

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe("catalog Supabase adapter", () => {
  it("fetches public games/categories and maps them to stable category slugs", async () => {
    const gameRow = {
      id: "g1", slug: "wordle", name: "Wordle", description: "Word puzzle",
      publisher: "The New York Times", canonical_url: "https://www.nytimes.com/",
      icon_url: null, status: "active", cadence: "daily", timezone_name: null,
      parser_status: "unsupported", link_status: "unverified", link_checked_at: null,
    };
    const from = vi.fn((table: string) => ({
      select: () => table === "game_category_links"
        ? ok([{ game_id: "g1", category_id: "c1" }])
        : { order: () => ok(table === "games" ? [gameRow] :
          [{ id: "c1", slug: "word", name: "Words" }]) },
    }));
    const client = { from } as unknown as SupabaseClient;
    const result = await loadCatalog(client);
    expect(result.games[0]?.categorySlugs).toEqual(["word"]);
    expect(result.games[0]?.canonicalUrl).toBe("https://www.nytimes.com/");
    expect(result.categories[0]?.slug).toBe("word");
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("loads only requested user's saved game IDs and server order", async () => {
    const eq = vi.fn().mockReturnValue({
      order: () => ok([{ game_id: "b", sort_order: 0 }, { game_id: "a", sort_order: 1 }]),
    });
    const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
    expect(await loadSelectedGames({ from } as unknown as SupabaseClient, "owner-id"))
      .toEqual(["b", "a"]);
    expect(eq).toHaveBeenCalledWith("user_id", "owner-id");
  });

  it("uses a single atomic RPC for ordered favorite mutations", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [
      { game_id: "b", sort_order: 0 }, { game_id: "a", sort_order: 1 },
    ], error: null });
    expect(await saveSelectedGames({ rpc } as unknown as SupabaseClient, ["b", "a"]))
      .toEqual(["b", "a"]);
    expect(rpc).toHaveBeenCalledWith("set_my_games", { p_game_ids: ["b", "a"] });
  });

  it("rejects invalid requests, server errors, and divergent confirmation", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient;
    await expect(saveSelectedGames(client, ["a", "a"])).rejects.toThrow("Invalid");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    await expect(saveSelectedGames(client, ["a"])).rejects.toThrow("permission denied");
    rpc.mockResolvedValueOnce({ data: [{ game_id: "b", sort_order: 0 }], error: null });
    await expect(saveSelectedGames(client, ["a"])).rejects.toThrow("did not match");
  });
});
