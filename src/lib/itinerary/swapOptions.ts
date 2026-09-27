import type { Place } from "@/lib/supabase/types";

// Candidates for the "⇄ Trocar" sheet. Partners always come first — they pay
// to be featured — then the best-rated places. With no category (a custom
// activity we couldn't classify) only partners are suggested.
export function rankSwapOptions(
  places: Place[],
  {
    category,
    excludeIds,
    partnerIds,
  }: { category: string | null; excludeIds: Set<string>; partnerIds: Set<string> },
): Place[] {
  return places
    .filter((p) => !excludeIds.has(p.id))
    .filter((p) => (category ? p.category === category : partnerIds.has(p.id)))
    .sort((a, b) => {
      const partnerDiff = Number(partnerIds.has(b.id)) - Number(partnerIds.has(a.id));
      if (partnerDiff !== 0) return partnerDiff;
      return (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name);
    });
}
