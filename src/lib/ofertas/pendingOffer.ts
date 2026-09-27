import type { Place } from "@/lib/supabase/types";

export const MAX_OFFER_LENGTH = 120;

export type OfferDecision = "aprovar" | "recusar";

type PendingFields = Pick<Place, "pending_offer" | "pending_offer_submitted_at">;

export class NoPendingOfferError extends Error {}

export function hasPendingOffer(place: Pick<Place, "pending_offer_submitted_at">): boolean {
  return Boolean(place.pending_offer_submitted_at);
}

export function isPendingRemoval(place: PendingFields): boolean {
  return hasPendingOffer(place) && !(place.pending_offer ?? "").trim();
}

export function offerSubmissionPatch(text: string, now: Date): PendingFields {
  return { pending_offer: text.trim(), pending_offer_submitted_at: now.toISOString() };
}

export function offerDecisionPatch(place: PendingFields, decision: OfferDecision): Partial<Place> {
  if (!hasPendingOffer(place)) throw new NoPendingOfferError("No pending offer to decide on");
  const cleared = { pending_offer: null, pending_offer_submitted_at: null };
  if (decision === "recusar") return cleared;
  const text = (place.pending_offer ?? "").trim();
  return { partner_offer: text || null, ...cleared };
}
