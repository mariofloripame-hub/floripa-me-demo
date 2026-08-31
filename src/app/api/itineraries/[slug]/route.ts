import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const row = await getItineraryBySlug(client, slug);
  if (!row) {
    return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const dayNumber = body?.day_number;
  const placeId = body?.place_id;
  if (typeof dayNumber !== "number" || typeof placeId !== "string") {
    return NextResponse.json({ error: "day_number e place_id são obrigatórios" }, { status: 400 });
  }

  try {
    const row = await removeActivity(slug, dayNumber, placeId, getSupabaseAdminClient());
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof ItineraryNotFoundError) {
      return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
    }
    console.error("Failed to update itinerary", error);
    return NextResponse.json({ error: "Não foi possível salvar a alteração." }, { status: 500 });
  }
}
