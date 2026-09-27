import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { normalizeCode } from "@/lib/cortesia/code";
import { findCodeByCode } from "@/lib/cortesia/queries";

const NOT_FOUND = { error: "Código não encontrado" };

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";
  const code = normalizeCode(rawCode);
  if (!code || !deviceId) return NextResponse.json(NOT_FOUND, { status: 404 });

  const row = await findCodeByCode(getSupabaseAdminClient(), code);
  // Only the device that generated the code may read its status.
  if (!row || row.device_id !== deviceId) return NextResponse.json(NOT_FOUND, { status: 404 });

  if (row.redeemed_at) return NextResponse.json({ status: "used", redeemedAt: row.redeemed_at });
  if (new Date(row.expires_at).getTime() <= Date.now()) return NextResponse.json({ status: "expired" });
  return NextResponse.json({ status: "active", expiresAt: row.expires_at });
}
