import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { updatePlace } from "@/lib/supabase/queries";
import { getPartnerContext } from "@/lib/parceiro/context";
import { MAX_OFFER_LENGTH, offerSubmissionPatch } from "@/lib/ofertas/pendingOffer";

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.text !== "string") {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const text = body.text.trim();
  if (text.length > MAX_OFFER_LENGTH) {
    return NextResponse.json({ error: `A cortesia deve ter até ${MAX_OFFER_LENGTH} caracteres.` }, { status: 400 });
  }
  if (!text && !ctx.place.partner_offer?.trim()) {
    return NextResponse.json({ error: "Não há cortesia para remover." }, { status: 400 });
  }

  try {
    const updated = await updatePlace(getSupabaseAdminClient(), ctx.place.id, offerSubmissionPatch(text, new Date()));
    return NextResponse.json({
      pending_offer: updated.pending_offer ?? null,
      pending_offer_submitted_at: updated.pending_offer_submitted_at ?? null,
    });
  } catch (error) {
    console.error("Partner offer submission failed", error);
    return NextResponse.json({ error: "Não foi possível enviar. Tente de novo." }, { status: 502 });
  }
}
