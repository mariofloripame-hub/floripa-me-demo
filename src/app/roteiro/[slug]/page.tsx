import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listPartners } from "@/lib/supabase/queries";
import { RoteiroView } from "@/components/roteiro/RoteiroView";

export default async function RoteiroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();
  const partners = await listPartners(client);
  return <RoteiroView itinerary={itinerary} partners={partners} />;
}
