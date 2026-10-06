import type { LodgingSelection, Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import { isEligibleLodging } from "./eligibility";

export const MAX_LODGING_ALTERNATIVES = 2;

const TIERS_BY_BUDGET: Record<string, Place["price_range"][]> = {
  economico: ["R$", "R$$"],
  medio: ["R$$", "R$"],
  alto: ["R$$$", "R$$"],
};

function normalizeRegion(region: string | null | undefined): string {
  return (region ?? "").trim().toLowerCase();
}

// Regions holding the most roteiro activities. Ties all count; empty = no preference.
function dominantRegions(places: Place[], days: ItineraryDay[]): Set<string> {
  const regionById = new Map(places.map((p) => [p.id, normalizeRegion(p.region)]));
  const counts = new Map<string, number>();
  for (const day of days) {
    for (const activity of day.activities) {
      const region = regionById.get(activity.place_id);
      if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
    }
  }
  const max = Math.max(0, ...counts.values());
  return new Set([...counts].filter(([, count]) => max > 0 && count === max).map(([region]) => region));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectLodging(
  places: Place[],
  answers: QuizAnswers,
  days: ItineraryDay[],
  random: () => number = Math.random,
): LodgingSelection | null {
  const tiers = TIERS_BY_BUDGET[answers.budget ?? "medio"] ?? TIERS_BY_BUDGET.medio;
  const preferred = dominantRegions(places, days);
  const eligible = places.filter(isEligibleLodging);

  const ordered = tiers.flatMap((tier) => {
    const inTier = eligible.filter((p) => p.price_range === tier);
    const matches = inTier.filter((p) => preferred.has(normalizeRegion(p.region)));
    const others = inTier.filter((p) => !preferred.has(normalizeRegion(p.region)));
    return [...shuffle(matches, random), ...shuffle(others, random)];
  });

  if (ordered.length === 0) return null;
  return {
    featured_id: ordered[0].id,
    alternative_ids: ordered.slice(1, 1 + MAX_LODGING_ALTERNATIVES).map((p) => p.id),
  };
}
