import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, listPlaces } from "@/lib/supabase/queries";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import type { ItineraryDay } from "./assemble";
import type { QuizAnswers } from "@/lib/quiz/types";

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  price_range: string;
  is_partner: boolean;
  address: string;
  short_description: string;
  photos: string[];
  rating: number | null;
  google_place_id: string | null;
  partner_offer: string | null;
  lat: number | null;
  lng: number | null;
}

export async function getNearbyPlaces(
  slug: string,
  supabase: SupabaseClient,
  count = 10,
): Promise<NearbyPlace[]> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) return [];

  const usedIds = new Set((itinerary.days as ItineraryDay[]).flatMap((d) => d.activities.map((a) => a.place_id)));
  const allPlaces = await listPlaces(supabase);
  const filtered = filterCandidates(allPlaces, itinerary.quiz_answers as QuizAnswers).filter(
    (p) => !usedIds.has(p.id),
  );

  const sampled = weightedSample(filtered, { count });
  return sampled.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price_range: p.price_range,
    is_partner: p.is_partner,
    address: p.address,
    short_description: p.short_description,
    photos: p.photos,
    rating: p.rating,
    google_place_id: p.google_place_id,
    partner_offer: p.partner_offer,
    lat: p.lat,
    lng: p.lng,
  }));
}
