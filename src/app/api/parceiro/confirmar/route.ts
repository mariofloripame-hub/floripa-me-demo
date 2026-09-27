import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { normalizeCode } from "@/lib/cortesia/code";
import { checkCode, checkMessage, type CheckResult } from "@/lib/cortesia/checkCode";
import { findCodeByCode, redeemCode } from "@/lib/cortesia/queries";

function conflict(result: CheckResult) {
  // A "valid" re-check after a failed redeem means a transient failure, not a usable code.
  const message = result.status === "valid" ? "Não foi possível confirmar. Tente de novo." : checkMessage(result);
  return NextResponse.json({ result, message }, { status: 409 });
}

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = normalizeCode(typeof body?.code === "string" ? body.code : "");
  if (!code) return conflict({ status: "not_found" });

  const client = getSupabaseAdminClient();
  const now = new Date();
  const redeemed = await redeemCode(client, { code, placeId: ctx.place.id, userId: ctx.userId, now });
  if (redeemed) return NextResponse.json({ ok: true, offerText: redeemed.offer_text });

  const row = await findCodeByCode(client, code);
  return conflict(checkCode(row, ctx.place.id, now));
}
