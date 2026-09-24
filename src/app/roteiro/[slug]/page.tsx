import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listPlaces, listEvents } from "@/lib/supabase/queries";
import { RoteiroView } from "@/components/roteiro/RoteiroView";
import { selectPartners } from "@/lib/itinerary/simulatedPartners";
import { buildAvisos } from "@/lib/avisos/buildAvisos";
import type { QuizAnswers } from "@/lib/quiz/types";

export default async function RoteiroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();
  const places = await listPlaces(client);
  const partners = selectPartners(places);
  const events = await listEvents(client);
  const tips = buildAvisos({ answers: itinerary.quiz_answers as QuizAnswers, events });
  return <RoteiroView itinerary={itinerary} partners={partners} tips={tips} />;
}
