import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalDay } from "../../shared/today";

function validateDay(day: string): void {
  if (!isLocalDay(day)) throw new Error("Invalid local calendar date.");
}

export async function loadManualPlayed(
  client: SupabaseClient,
  userId: string,
  day: string,
): Promise<string[]> {
  validateDay(day);
  const { data, error } = await client
    .from("user_game_day_marks")
    .select("game_id")
    .eq("user_id", userId)
    .eq("local_date", day);
  if (error) throw new Error("Could not load your manual played status.");
  if (!Array.isArray(data))
    throw new Error("Manual played status was incomplete.");
  return data.map((row: { game_id: string }) => row.game_id);
}

export async function updateManualPlayed(
  client: SupabaseClient,
  userId: string,
  gameId: string,
  day: string,
  mark: boolean,
): Promise<void> {
  validateDay(day);
  if (mark) {
    const { error } = await client
      .from("user_game_day_marks")
      .insert({ user_id: userId, game_id: gameId, local_date: day });
    if (error) throw new Error("The played marker could not be saved.");
  } else {
    const { error } = await client
      .from("user_game_day_marks")
      .delete()
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .eq("local_date", day);
    if (error) throw new Error("The played marker could not be removed.");
  }
}

/** Network uncertainty is not proof of rollback: always reconcile. */
export async function updateAndReconcilePlayed(
  client: SupabaseClient,
  userId: string,
  gameId: string,
  day: string,
  mark: boolean,
): Promise<{ ids: string[]; confirmed: boolean }> {
  let confirmed = true;
  try {
    await updateManualPlayed(client, userId, gameId, day, mark);
  } catch {
    confirmed = false;
  }
  return {
    ids: await loadManualPlayed(client, userId, day),
    confirmed,
  };
}
