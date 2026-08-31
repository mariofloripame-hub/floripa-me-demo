import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getNearbyPlaces } from "@/lib/itinerary/nearbyPlaces";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });
  }
  const places = await getNearbyPlaces(slug, getSupabaseAdminClient());
  return NextResponse.json(places);
}
