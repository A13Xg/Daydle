import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadManualPlayed,
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
