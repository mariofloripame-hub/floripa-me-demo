import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryActivity, ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";
import { ItineraryNotFoundError } from "./removeActivity";

export interface CustomActivityInput {
  name: string;
  time: string;
}

export async function addActivity(
  slug: string,
  dayNumber: number,
  input: CustomActivityInput,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const newActivity: ItineraryActivity = {
    place_id: `custom-${crypto.randomUUID()}`,
    name: input.name,
    time: input.time,
    category: "Personalizado",
    price_range: "—",
    is_partner: false,
    address: "",
    lat: null,
    lng: null,
  };

  const days = (itinerary.days as ItineraryDay[]).map((day) =>
    day.day_number === dayNumber
      ? { ...day, activities: [...day.activities, newActivity].sort((a, b) => a.time.localeCompare(b.time)) }
      : day,
  );

  return updateItineraryDays(supabase, slug, days);
}
