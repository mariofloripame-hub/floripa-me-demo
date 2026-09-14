import type { Place } from "@/lib/supabase/types";
import type { ItineraryGeneration } from "./schema";

export interface ItineraryActivity {
  place_id: string;
  name: string;
  time: string;
  category: string;
  price_range: string;
  is_partner: boolean;
  address: string;
  lat: number | null;
  lng: number | null;
  photo?: string;
  short_description?: string;
}

export interface ItineraryDay {
  day_number: number;
  theme: string;
  activities: ItineraryActivity[];
}

export function assembleDays(generation: ItineraryGeneration, candidates: Place[]): ItineraryDay[] {
  const byId = new Map(candidates.map((p) => [p.id, p]));

  return generation.days
    .map((day) => ({
      day_number: day.day_number,
      theme: day.theme,
      activities: day.activities
        .map((act): ItineraryActivity | null => {
          const place = byId.get(act.place_id);
          if (!place) return null;
          return {
            place_id: place.id,
            name: place.name,
            time: act.time,
            category: place.category,
            price_range: place.price_range,
            is_partner: place.is_partner,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            photo: place.photos[0],
            short_description: place.short_description,
          };
        })
        .filter((a): a is ItineraryActivity => a !== null),
    }))
    .filter((day) => day.activities.length > 0);
}
