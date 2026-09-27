import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { normalizeCode } from "@/lib/cortesia/code";
import { checkCode, checkMessage } from "@/lib/cortesia/checkCode";
import { findCodeByCode } from "@/lib/cortesia/queries";

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = normalizeCode(typeof body?.code === "string" ? body.code : "");
  const row = code ? await findCodeByCode(getSupabaseAdminClient(), code) : null;
  const result = checkCode(row, ctx.place.id, new Date());
  return NextResponse.json({ result, message: checkMessage(result) });
}
