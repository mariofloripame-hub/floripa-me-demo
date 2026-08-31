import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { getNearbyPlaces } from "@/lib/itinerary/nearbyPlaces";
import { MapaView } from "@/components/roteiro/MapaView";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export default async function MapaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();
  const nearby = await getNearbyPlaces(slug, client);
  return <MapaView slug={slug} days={itinerary.days as ItineraryDay[]} nearby={nearby} />;
}
