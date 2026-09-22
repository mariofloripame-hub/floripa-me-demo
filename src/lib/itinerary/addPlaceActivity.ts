import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryActivity, ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";
import { ItineraryNotFoundError } from "./removeActivity";

export class PlaceNotFoundError extends Error {}
export class DayNotFoundError extends Error {}

function nextTimeSlot(activities: ItineraryActivity[]): string {
  if (activities.length === 0) return "09:00";
  const last = activities.reduce((a, b) => (a.time > b.time ? a : b));
  const [hours, minutes] = last.time.split(":").map(Number);
  const total = hours * 60 + minutes + 90;
  const capped = Math.min(total, 23 * 60 + 59);
  const nextHours = Math.floor(capped / 60);
  const nextMinutes = capped % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export async function addPlaceActivity(
  slug: string,
  dayNumber: number,
  placeId: string,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const place = await getPlaceById(supabase, placeId);
  if (!place) throw new PlaceNotFoundError(`Place not found: ${placeId}`);

  const days = itinerary.days as ItineraryDay[];
  const day = days.find((d) => d.day_number === dayNumber);
  if (!day) throw new DayNotFoundError(`Day not found: ${dayNumber}`);

  if (day.activities.some((a) => a.place_id === placeId)) {
    return itinerary;
  }

  const time = nextTimeSlot(day.activities);

  const newActivity: ItineraryActivity = {
    place_id: place.id,
    name: place.name,
    time,
    category: place.category,
    price_range: place.price_range,
    is_partner: place.is_partner,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    photo: place.photos[0],
    photos: place.photos,
    rating: place.rating,
    google_place_id: place.google_place_id,
    partner_offer: place.partner_offer,
    short_description: place.short_description,
  };

  const updatedDays = days.map((d) =>
    d.day_number === dayNumber
      ? { ...d, activities: [...d.activities, newActivity].sort((a, b) => a.time.localeCompare(b.time)) }
      : d,
  );

  return updateItineraryDays(supabase, slug, updatedDays);
}
