import type { Place } from "@/lib/supabase/types";

// A courtesy code needs a real partner behind it to validate it, so the
// simulated partners (is_partner false, fake offers injected for UI preview)
// never count as having a live offer.
export function liveOfferText(place: Pick<Place, "is_partner" | "is_verified" | "partner_offer">): string | null {
  if (!place.is_partner || !place.is_verified) return null;
  const offer = place.partner_offer?.trim();
  return offer ? offer : null;
}

export function liveOfferMap(places: Place[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const place of places) {
    const offer = liveOfferText(place);
    if (offer) map[place.id] = offer;
  }
  return map;
}
