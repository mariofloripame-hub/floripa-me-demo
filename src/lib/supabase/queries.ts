import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place, EventRow, SosPlace, ItineraryRow } from "./types";

export async function listPlaces(client: SupabaseClient): Promise<Place[]> {
  const { data, error } = await client.from("places").select("*");
  if (error) throw error;
  return data as Place[];
}

export async function listEvents(client: SupabaseClient): Promise<EventRow[]> {
  const { data, error } = await client.from("events").select("*").eq("active", true);
  if (error) throw error;
  return data as EventRow[];
}

export async function listSosPlaces(client: SupabaseClient, category?: string): Promise<SosPlace[]> {
  const base = client.from("sos_places").select("*");
  const query = category ? base.eq("category", category) : base;
  const { data, error } = await query;
  if (error) throw error;
  return data as SosPlace[];
}

export async function insertItinerary(
  client: SupabaseClient,
  row: Omit<ItineraryRow, "id" | "created_at">,
): Promise<ItineraryRow> {
  const { data, error } = await client.from("itineraries").insert(row).select().single();
  if (error) throw error;
  return data as ItineraryRow;
}

export async function getItineraryBySlug(client: SupabaseClient, slug: string): Promise<ItineraryRow | null> {
  const { data, error } = await client.from("itineraries").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as ItineraryRow | null;
}

export async function updateItineraryDays(
  client: SupabaseClient,
  slug: string,
  days: unknown,
): Promise<ItineraryRow> {
  const { data, error } = await client.from("itineraries").update({ days }).eq("slug", slug).select().single();
  if (error) throw error;
  return data as ItineraryRow;
}
