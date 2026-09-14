import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";

export class ItineraryNotFoundError extends Error {}

export async function removeActivity(
  slug: string,
  dayNumber: number,
  placeId: string,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const days = (itinerary.days as ItineraryDay[]).map((day) => {
    if (day.day_number !== dayNumber || day.activities.length <= 1) return day;
    return { ...day, activities: day.activities.filter((a) => a.place_id !== placeId) };
  });

  return updateItineraryDays(supabase, slug, days);
}
