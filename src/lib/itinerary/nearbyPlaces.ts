import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, listPlaces } from "@/lib/supabase/queries";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import type { Place } from "@/lib/supabase/types";
import type { ItineraryDay } from "./assemble";
import type { QuizAnswers } from "@/lib/quiz/types";

export async function getNearbyPlaces(slug: string, supabase: SupabaseClient, count = 10): Promise<Place[]> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) return [];

  const usedIds = new Set((itinerary.days as ItineraryDay[]).flatMap((d) => d.activities.map((a) => a.place_id)));
  const allPlaces = await listPlaces(supabase);
  const filtered = filterCandidates(allPlaces, itinerary.quiz_answers as QuizAnswers).filter(
    (p) => !usedIds.has(p.id),
  );

  return weightedSample(filtered, { count });
}
