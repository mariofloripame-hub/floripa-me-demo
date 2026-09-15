import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listPlaces } from "@/lib/supabase/queries";
import { RoteiroView } from "@/components/roteiro/RoteiroView";
import { selectPartners } from "@/lib/itinerary/simulatedPartners";

export default async function RoteiroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();
  const places = await listPlaces(client);
  const partners = selectPartners(places);
  return <RoteiroView itinerary={itinerary} partners={partners} />;
}
