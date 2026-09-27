import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppearanceRow } from "./dashboard";

export async function listItinerariesWithPlace(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<AppearanceRow[]> {
  const { data, error } = await client.rpc("itineraries_with_place", {
    p_place_id: placeId,
    p_since: since.toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as AppearanceRow[];
}

export async function getQuizAnswersByIds(
  client: SupabaseClient,
  ids: string[],
): Promise<Record<string, Record<string, unknown>>> {
  if (ids.length === 0) return {};
  const { data, error } = await client.from("itineraries").select("id, quiz_answers").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; quiz_answers: Record<string, unknown> }[];
  return Object.fromEntries(rows.map((row) => [row.id, row.quiz_answers]));
}
