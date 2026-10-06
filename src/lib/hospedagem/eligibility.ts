import type { Place } from "@/lib/supabase/types";
import { normalizeWhatsapp } from "./contact";

export const LODGING_CATEGORY = "Hospedagem";

export function isLodging(place: Pick<Place, "category">): boolean {
  return place.category === LODGING_CATEGORY;
}

// A lodging can be suggested only if it pays (partner), was approved, and the
// tourist has a working way to reach it (a WhatsApp we can turn into a
// wa.me link, or a booking page) — otherwise the card would have no button.
export function isEligibleLodging(place: Place): boolean {
  const hasContact = normalizeWhatsapp(place.booking_whatsapp) !== null || Boolean(place.booking_url?.trim());
  return isLodging(place) && place.is_partner && place.is_verified && hasContact;
}
