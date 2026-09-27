import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourtesyCodeRow, NewCourtesyCode } from "./types";

const TABLE = "courtesy_codes";

export async function findCodeByCode(client: SupabaseClient, code: string): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client.from(TABLE).select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function findReusableCode(
  client: SupabaseClient,
  { deviceId, placeId, now }: { deviceId: string; placeId: string; now: Date },
): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("device_id", deviceId)
    .eq("place_id", placeId)
    .is("redeemed_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function insertCode(client: SupabaseClient, row: NewCourtesyCode): Promise<CourtesyCodeRow> {
  const { data, error } = await client.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data as CourtesyCodeRow;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

// One UPDATE with every condition in its WHERE clause: Postgres re-checks the
// row under concurrent updates, so two simultaneous confirmations of the same
// code can't both succeed.
export async function redeemCode(
  client: SupabaseClient,
  { code, placeId, userId, now }: { code: string; placeId: string; userId: string; now: Date },
): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .update({ redeemed_at: now.toISOString(), redeemed_by: userId })
    .eq("code", code)
    .eq("place_id", placeId)
    .is("redeemed_at", null)
    .gt("expires_at", now.toISOString())
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function listRedeemedCodes(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<CourtesyCodeRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("place_id", placeId)
    .gte("redeemed_at", since.toISOString())
    .order("redeemed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourtesyCodeRow[];
}

export async function hasEverRedeemed(client: SupabaseClient, placeId: string): Promise<boolean> {
  const { count, error } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .not("redeemed_at", "is", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}
