import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById } from "@/lib/supabase/queries";
import { isEligibleLodging } from "./eligibility";
import { hasRecentLodgingLead, insertLodgingLead } from "./queries";
import type { LodgingLeadInput } from "./leadSchema";

export class LeadNotAllowedError extends Error {}

// A tourist who comes back from WhatsApp and taps again is still one request.
const REPEAT_WINDOW_MS = 10 * 60 * 1000;

// Only roteiros that show the "Onde ficar" card can send requests, and only
// for a partner lodging (the suggested ones or any picked from "Ver mais
// opções de hospedagem"), so the partner panel can't be inflated with
// arbitrary ids.
export async function recordLodgingLead(client: SupabaseClient, lead: LodgingLeadInput): Promise<void> {
  const itinerary = await getItineraryBySlug(client, lead.slug);
  const lodging = itinerary?.lodging;
  if (!lodging) throw new LeadNotAllowedError();
  const suggested = [lodging.featured_id, ...lodging.alternative_ids].includes(lead.place_id);
  if (!suggested) {
    const place = await getPlaceById(client, lead.place_id);
    if (!place || !isEligibleLodging(place)) throw new LeadNotAllowedError();
  }

  const key = { itinerary_slug: lead.slug, place_id: lead.place_id, channel: lead.channel };
  if (await hasRecentLodgingLead(client, key, new Date(Date.now() - REPEAT_WINDOW_MS))) return;

  await insertLodgingLead(client, {
    place_id: lead.place_id,
    itinerary_slug: lead.slug,
    channel: lead.channel,
    check_in: lead.check_in,
    check_out: lead.check_out,
    guests: lead.guests,
  });
}
