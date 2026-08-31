import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listEvents } from "@/lib/supabase/queries";
import { filterEventsForTraveler } from "@/lib/events/filterEvents";
import { DicasView } from "@/components/roteiro/DicasView";
import type { QuizAnswers } from "@/lib/quiz/types";

export default async function DicasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();

  const allEvents = await listEvents(client);
  const month = new Date().getMonth() + 1;
  const events = filterEventsForTraveler(allEvents, itinerary.quiz_answers as QuizAnswers, month);

  return <DicasView slug={slug} events={events} />;
}
