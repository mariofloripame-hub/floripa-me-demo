import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById } from "@/lib/supabase/queries";
import { CODE_TTL_MS, generateCode } from "./code";
import { liveOfferText } from "./liveOffers";
import { findReusableCode, insertCode, isUniqueViolation } from "./queries";
import type { CourtesyCodeRow } from "./types";

const MAX_ATTEMPTS = 5;

export interface IssuedCode {
  code: string;
  offerText: string;
  expiresAt: string;
}

export class NoLiveOfferError extends Error {}
export class RoteiroNotFoundError extends Error {}

function toIssued(row: Pick<CourtesyCodeRow, "code" | "offer_text" | "expires_at">): IssuedCode {
  return { code: row.code, offerText: row.offer_text, expiresAt: row.expires_at };
}

export async function issueCode(
  client: SupabaseClient,
  {
    placeId,
    itinerarySlug,
    deviceId,
    now = new Date(),
    generate = () => generateCode(),
  }: { placeId: string; itinerarySlug: string; deviceId: string; now?: Date; generate?: () => string },
): Promise<IssuedCode> {
  const place = await getPlaceById(client, placeId);
  const offerText = place ? liveOfferText(place) : null;
  if (!offerText) throw new NoLiveOfferError(`Place ${placeId} has no live offer`);

  const itinerary = await getItineraryBySlug(client, itinerarySlug);
  if (!itinerary) throw new RoteiroNotFoundError(`Itinerary ${itinerarySlug} not found`);

  const existing = await findReusableCode(client, { deviceId, placeId, now });
  if (existing) return toIssued(existing);

  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const row = await insertCode(client, {
        code: generate(),
        place_id: placeId,
        itinerary_id: itinerary.id,
        device_id: deviceId,
        offer_text: offerText,
        expires_at: expiresAt,
      });
      return toIssued(row);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not generate a unique courtesy code");
}
