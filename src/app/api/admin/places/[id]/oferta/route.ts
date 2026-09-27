import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { NoPendingOfferError, offerDecisionPatch, type OfferDecision } from "@/lib/ofertas/pendingOffer";

const DECISIONS: OfferDecision[] = ["aprovar", "recusar"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!DECISIONS.includes(action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const client = getSupabaseAdminClient();
  const place = await getPlaceById(client, id);
  if (!place) return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 });

  let patch;
  try {
    patch = offerDecisionPatch(
      { pending_offer: place.pending_offer ?? null, pending_offer_submitted_at: place.pending_offer_submitted_at ?? null },
      action,
    );
  } catch (error) {
    if (error instanceof NoPendingOfferError) {
      return NextResponse.json({ error: "Não há oferta pendente." }, { status: 409 });
    }
    throw error;
  }

  try {
    return NextResponse.json(await updatePlace(client, id, patch));
  } catch (error) {
    console.error("Offer decision failed", error);
    return NextResponse.json({ error: "Não foi possível salvar a decisão." }, { status: 502 });
  }
}
