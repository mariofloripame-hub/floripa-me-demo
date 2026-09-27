import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPartners } from "@/lib/supabase/queries";
import type { Place } from "@/lib/supabase/types";
import { createPartnerServerClient } from "./supabaseServer";

export interface PartnerContext {
  userId: string;
  email: string;
  place: Place;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// One email = one establishment (chains are out of scope); the first match wins.
export async function findPartnerPlaceByEmail(client: SupabaseClient, email: string): Promise<Place | null> {
  const target = normalizeEmail(email);
  const partners = await listPartners(client);
  return partners.find((p) => p.contact_email && normalizeEmail(p.contact_email) === target) ?? null;
}

export async function getPartnerContext(): Promise<PartnerContext | null> {
  const supabase = await createPartnerServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const place = await findPartnerPlaceByEmail(getSupabaseAdminClient(), user.email);
  if (!place) return null;
  return { userId: user.id, email: user.email, place };
}
