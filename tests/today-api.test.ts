import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadManualPlayed,
  markPlayedFromSubmittedResult,
  updateAndReconcilePlayed,
  updateManualPlayed,
} from "../src/lib/today-api";

describe("private played-marker Supabase adapter", () => {
  it("reads just the signed-in user's requested local day", async () => {
    const eqDay = vi
      .fn()
      .mockResolvedValue({ data: [{ game_id: "g1" }], error: null });
    const eqUser = vi.fn().mockReturnValue({ eq: eqDay });
    const from = vi.fn().mockReturnValue({ select: () => ({ eq: eqUser }) });
    const ids = await loadManualPlayed(
      { from } as unknown as SupabaseClient,
      "owner",
      "2026-11-15",
    );
    expect(ids).toEqual(["g1"]);
    expect(from).toHaveBeenCalledWith("user_game_day_marks");
    expect(eqUser).toHaveBeenCalledWith("user_id", "owner");
    expect(eqDay).toHaveBeenCalledWith("local_date", "2026-11-15");
  });

  it("inserts a manual flag without calling the result service", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    await updateManualPlayed(
      { from } as unknown as SupabaseClient,
      "owner",
      "game",
      "2026-11-15",
      true,
    );
    expect(insert).toHaveBeenCalledWith({
      user_id: "owner",
      game_id: "game",
      local_date: "2026-11-15",
    });
    expect(from).toHaveBeenCalledOnce();
  });

  it("unmarks only the exact user/game/day key", async () => {
    const eqDate = vi.fn().mockResolvedValue({ error: null });
    const eqGame = vi.fn().mockReturnValue({ eq: eqDate });
    const eqUser = vi.fn().mockReturnValue({ eq: eqGame });
    const from = vi.fn().mockReturnValue({ delete: () => ({ eq: eqUser }) });
    await updateManualPlayed(
      { from } as unknown as SupabaseClient,
      "owner",
      "g1",
      "2026-11-15",
      false,
    );
    expect(eqUser).toHaveBeenCalledWith("user_id", "owner");
    expect(eqGame).toHaveBeenCalledWith("game_id", "g1");
    expect(eqDate).toHaveBeenCalledWith("local_date", "2026-11-15");
  });

  it("reconciles an uncertain write against the authoritative private table", async () => {
    const eqDate = vi
      .fn()
      .mockResolvedValue({ data: [{ game_id: "g1" }], error: null });
    const eqUser = vi.fn().mockReturnValue({ eq: eqDate });
    const insert = vi.fn().mockRejectedValue(new Error("response lost"));
    const from = vi.fn().mockReturnValue({
      insert,
      select: () => ({ eq: eqUser }),
    });
    const outcome = await updateAndReconcilePlayed(
      { from } as unknown as SupabaseClient,
      "owner",
      "g1",
      "2026-11-15",
      true,
    );
    expect(outcome).toEqual({ ids: ["g1"], confirmed: false });
  });

  it("rejects bad dates before reaching the database", async () => {
    const from = vi.fn();
    await expect(
      loadManualPlayed(
        { from } as unknown as SupabaseClient,
        "owner",
        "2026-02-30",
      ),
    ).rejects.toThrow("Invalid local");
    expect(from).not.toHaveBeenCalled();
  });
});


describe("automatic played mark after a confirmed result", () => {
  it("does not mark today's lineup for an older dated puzzle", async () => {
    const from = vi.fn();
    const result = await markPlayedFromSubmittedResult(
      { from } as unknown as SupabaseClient,
      "owner",
      "flagle",
      "2026-11-16",
      new Date(2026, 10, 18, 12, 0),
    );
    expect(result).toBe("historical");
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves the canonical game ID, writes the local-day mark and re-reads it", async () => {
    let marks: string[] = [];
    const insert = vi.fn().mockImplementation(async (row: { game_id: string }) => {
      marks.push(row.game_id);
      return { error: null };
    });
    const from = vi.fn().mockImplementation((table: string) =>
      table === "games"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "game-1" },
                  error: null,
                }),
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({
                eq: async () => ({
                  data: marks.map((game_id) => ({ game_id })),
                  error: null,
                }),
              }),
            }),
            insert,
          },
    );
    const client = { from } as unknown as SupabaseClient;
    const clock = new Date(2026, 10, 18, 12, 0);
    expect(
      await markPlayedFromSubmittedResult(client, "owner", "wordle", null, clock),
    ).toBe("marked");
    expect(insert).toHaveBeenCalledWith({
      user_id: "owner",
      game_id: "game-1",
      local_date: "2026-11-18",
    });
    expect(
      await markPlayedFromSubmittedResult(
        client,
        "owner",
        "wordle",
        "2026-11-18",
        clock,
      ),
    ).toBe("marked");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("rejects unresolved catalog IDs rather than claiming played status", async () => {
    const from = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    await expect(
      markPlayedFromSubmittedResult(
        { from } as unknown as SupabaseClient,
        "owner",
        "unknown-game",
        null,
        new Date(2026, 10, 18, 12, 0),
      ),
    ).rejects.toThrow("catalog ID");
  });
});
