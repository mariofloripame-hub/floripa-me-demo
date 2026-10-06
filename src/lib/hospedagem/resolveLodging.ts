import type { LodgingSelection, Place } from "@/lib/supabase/types";
import { stripContactInfo } from "@/lib/itinerary/simulatedPartners";
import { isEligibleLodging } from "./eligibility";

// The itinerary stores only ids; partners may have left or changed since.
export function resolveLodging(selection: LodgingSelection | null | undefined, places: Place[]): Place[] {
  if (!selection) return [];
  const byId = new Map(places.map((p) => [p.id, p]));
  return [selection.featured_id, ...selection.alternative_ids]
    .map((id) => byId.get(id))
    .filter((p): p is Place => p !== undefined && isEligibleLodging(p))
    .map(stripContactInfo);
}
