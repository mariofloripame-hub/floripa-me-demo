import type { SupabaseClient } from "@supabase/supabase-js";

export interface LodgingLeadRow {
  id: string;
  place_id: string;
  itinerary_slug: string;
  channel: "whatsapp" | "site";
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  created_at: string;
}

export async function insertLodgingLead(
  client: SupabaseClient,
  row: Omit<LodgingLeadRow, "id" | "created_at">,
): Promise<void> {
  const { error } = await client.from("lodging_leads").insert(row);
  if (error) throw error;
}

// Whether this roteiro already asked this lodging, on this channel, since `since`.
export async function hasRecentLodgingLead(
  client: SupabaseClient,
  lead: Pick<LodgingLeadRow, "itinerary_slug" | "place_id" | "channel">,
  since: Date,
): Promise<boolean> {
  const { data, error } = await client
    .from("lodging_leads")
    .select("id")
    .eq("itinerary_slug", lead.itinerary_slug)
    .eq("place_id", lead.place_id)
    .eq("channel", lead.channel)
    .gte("created_at", since.toISOString())
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function listLodgingLeads(client: SupabaseClient, placeId: string, since: Date): Promise<LodgingLeadRow[]> {
  const { data, error } = await client
    .from("lodging_leads")
    .select("*")
    .eq("place_id", placeId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data ?? []) as LodgingLeadRow[];
}

// Roteiros where the lodging was the featured suggestion.
export async function listLodgingSuggestions(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<{ created_at: string }[]> {
  const { data, error } = await client
    .from("itineraries")
    .select("created_at")
    .eq("lodging->>featured_id", placeId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data ?? []) as { created_at: string }[];
}
