import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";
import { ItineraryNotFoundError } from "./removeActivity";
import { DayNotFoundError, PlaceNotFoundError, placeToActivity } from "./addPlaceActivity";

export async function replaceActivity(
  slug: string,
  dayNumber: number,
  oldPlaceId: string,
  newPlaceId: string,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const place = await getPlaceById(supabase, newPlaceId);
  if (!place) throw new PlaceNotFoundError(`Place not found: ${newPlaceId}`);

  const days = itinerary.days as ItineraryDay[];
  const day = days.find((d) => d.day_number === dayNumber);
  if (!day) throw new DayNotFoundError(`Day not found: ${dayNumber}`);

  if (day.activities.some((a) => a.place_id === newPlaceId)) {
    return itinerary;
  }

  const updatedDays = days.map((d) =>
    d.day_number === dayNumber
      ? {
          ...d,
          activities: d.activities.map((a) => (a.place_id === oldPlaceId ? placeToActivity(place, a.time) : a)),
        }
      : d,
  );

  return updateItineraryDays(supabase, slug, updatedDays);
}
