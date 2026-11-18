import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalDay, localDayString } from "../../shared/today";

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


/**
 * Synchronize the Today mark only after a successful server-confirmed result.
 * An explicitly dated historical puzzle must never mark the current day.
 * Number-only shares cannot establish publisher-local dates; they use the
 * browser-local submission day, just like a manual played mark.
 */
export async function markPlayedFromSubmittedResult(
  client: SupabaseClient,
  userId: string,
  gameSlug: string,
  puzzleDate: string | null,
  clock: Date = new Date(),
): Promise<"marked" | "historical"> {
  const day = localDayString(clock);
  if (puzzleDate && puzzleDate !== day) return "historical";

  const { data, error } = await client
    .from("games")
    .select("id")
    .eq("slug", gameSlug)
    .maybeSingle();
  if (error || typeof data?.id !== "string") {
    throw new Error("Could not resolve the submitted game's catalog ID.");
  }

  const before = await loadManualPlayed(client, userId, day);
  if (before.includes(data.id)) return "marked";

  const after = await updateAndReconcilePlayed(
    client,
    userId,
    data.id,
    day,
    true,
  );
  if (!after.ids.includes(data.id)) {
    throw new Error("The played marker was not confirmed by the server.");
  }
  return "marked";
}
