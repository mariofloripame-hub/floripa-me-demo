import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place } from "@/lib/supabase/types";
import { hasEverRedeemed, listRedeemedCodes } from "@/lib/cortesia/queries";
import { liveOfferText } from "@/lib/cortesia/liveOffers";
import { monthStart } from "@/lib/time/saoPaulo";
import { buildDashboard, type Dashboard } from "./dashboard";
import { getQuizAnswersByIds, listItinerariesWithPlace } from "./queries";

export async function loadDashboard(client: SupabaseClient, place: Place, now: Date = new Date()): Promise<Dashboard> {
  const since = monthStart(now, -1);
  const [redeemed, appearances, everRedeemed] = await Promise.all([
    listRedeemedCodes(client, place.id, since),
    listItinerariesWithPlace(client, place.id, since),
    hasEverRedeemed(client, place.id),
  ]);
  const itineraryIds = [...new Set(redeemed.map((r) => r.itinerary_id).filter((id): id is string => Boolean(id)))];
  const visitorAnswers = await getQuizAnswersByIds(client, itineraryIds);
  return buildDashboard({
    now,
    redeemed,
    appearances,
    visitorAnswers,
    hasLiveOffer: liveOfferText(place) !== null,
    everRedeemed,
  });
}
