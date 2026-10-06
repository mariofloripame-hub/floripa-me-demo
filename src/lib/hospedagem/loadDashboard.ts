import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place } from "@/lib/supabase/types";
import { monthStart } from "@/lib/time/saoPaulo";
import { buildLodgingDashboard, type LodgingDashboard } from "./dashboard";
import { listLodgingLeads, listLodgingSuggestions } from "./queries";

export async function loadLodgingDashboard(client: SupabaseClient, place: Place, now: Date = new Date()): Promise<LodgingDashboard> {
  const since = monthStart(now, -1);
  const [leads, suggestions] = await Promise.all([
    listLodgingLeads(client, place.id, since),
    listLodgingSuggestions(client, place.id, since),
  ]);
  return buildLodgingDashboard({ now, leads, suggestions });
}
