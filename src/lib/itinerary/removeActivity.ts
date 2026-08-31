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

  const days = (itinerary.days as ItineraryDay[])
    .map((day) =>
      day.day_number === dayNumber
        ? { ...day, activities: day.activities.filter((a) => a.place_id !== placeId) }
        : day,
    )
    .filter((day) => day.activities.length > 0);

  return updateItineraryDays(supabase, slug, days);
}
