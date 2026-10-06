import type { Place } from "@/lib/supabase/types";

export const LODGING_CATEGORY = "Hospedagem";

export function isLodging(place: Pick<Place, "category">): boolean {
  return place.category === LODGING_CATEGORY;
}

// A lodging can be suggested only if it pays (partner), was approved, and the
// tourist has some way to reach it.
export function isEligibleLodging(place: Place): boolean {
  const hasContact = Boolean(place.booking_whatsapp?.trim() || place.booking_url?.trim());
  return isLodging(place) && place.is_partner && place.is_verified && hasContact;
}
