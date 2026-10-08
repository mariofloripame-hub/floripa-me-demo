import type { LodgingSelection, Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { stripContactInfo } from "@/lib/itinerary/simulatedPartners";
import { isEligibleLodging } from "./eligibility";

const PRICE_ORDER = ["R$", "R$$", "R$$$"];
const TIER_BY_BUDGET: Record<string, string> = { economico: "R$", medio: "R$$", alto: "R$$$" };

// Everything the "Onde ficar" card can show, featured first: the lodgings
// picked at creation (still eligible — partners may have left since), then
// every other partner lodging for "Ver mais opções de hospedagem", those in
// the tourist's budget first, then the rest from cheapest to priciest.
export function resolveLodging(
  selection: LodgingSelection | null | undefined,
  places: Place[],
  budget?: QuizAnswers["budget"],
): Place[] {
  if (!selection) return [];
  const eligible = places.filter(isEligibleLodging);
  const byId = new Map(eligible.map((p) => [p.id, p]));
  const picked = [selection.featured_id, ...selection.alternative_ids]
    .map((id) => byId.get(id))
    .filter((p): p is Place => p !== undefined);

  const pickedIds = new Set(picked.map((p) => p.id));
  const ownTier = TIER_BY_BUDGET[budget ?? "medio"];
  const rank = (p: Place) => (p.price_range === ownTier ? -1 : PRICE_ORDER.indexOf(p.price_range));
  const others = eligible
    .filter((p) => !pickedIds.has(p.id))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return [...picked, ...others].map(stripContactInfo);
}
