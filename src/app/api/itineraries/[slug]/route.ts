import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";
import { addActivity } from "@/lib/itinerary/addActivity";
import { addPlaceActivity, PlaceNotFoundError, DayNotFoundError } from "@/lib/itinerary/addPlaceActivity";

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

  if (typeof dayNumber !== "number") {
    return NextResponse.json({ error: "day_number é obrigatório" }, { status: 400 });
  }

  try {
    if (body?.activity) {
      const { name, time } = body.activity;
      if (typeof name !== "string" || !name.trim() || typeof time !== "string" || !time.trim()) {
        return NextResponse.json({ error: "activity.name e activity.time são obrigatórios" }, { status: 400 });
      }
      const row = await addActivity(slug, dayNumber, { name, time }, getSupabaseAdminClient());
      return NextResponse.json(row);
    }

    if (body?.add_place_id) {
      const addPlaceId = body.add_place_id;
      if (typeof addPlaceId !== "string") {
        return NextResponse.json({ error: "add_place_id deve ser uma string" }, { status: 400 });
      }
      const row = await addPlaceActivity(slug, dayNumber, addPlaceId, getSupabaseAdminClient());
      return NextResponse.json(row);
    }

    const placeId = body?.place_id;
    if (typeof placeId !== "string") {
      return NextResponse.json({ error: "place_id é obrigatório" }, { status: 400 });
    }
    const row = await removeActivity(slug, dayNumber, placeId, getSupabaseAdminClient());
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof ItineraryNotFoundError) {
      return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
    }
    if (error instanceof PlaceNotFoundError) {
      return NextResponse.json({ error: "Lugar não encontrado" }, { status: 404 });
    }
    if (error instanceof DayNotFoundError) {
      return NextResponse.json({ error: "Dia não encontrado" }, { status: 404 });
    }
    console.error("Failed to update itinerary", error);
    return NextResponse.json({ error: "Não foi possível salvar a alteração." }, { status: 500 });
  }
}
