import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { insertLodgingLead } from "./queries";
import type { LodgingLeadInput } from "./leadSchema";

export class LeadNotAllowedError extends Error {}

// Only lodgings actually suggested in that roteiro count, so the partner
// panel can't be inflated with arbitrary ids.
export async function recordLodgingLead(client: SupabaseClient, lead: LodgingLeadInput): Promise<void> {
  const itinerary = await getItineraryBySlug(client, lead.slug);
  const lodging = itinerary?.lodging;
  const suggested = lodging ? [lodging.featured_id, ...lodging.alternative_ids] : [];
  if (!suggested.includes(lead.place_id)) throw new LeadNotAllowedError();

  await insertLodgingLead(client, {
    place_id: lead.place_id,
    itinerary_slug: lead.slug,
    channel: lead.channel,
    check_in: lead.check_in,
    check_out: lead.check_out,
    guests: lead.guests,
  });
}
