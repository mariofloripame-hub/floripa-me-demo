import type { SupabaseClient } from "@supabase/supabase-js";
import { listPlaces, insertItinerary } from "@/lib/supabase/queries";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import { generateItinerary, type MessagesParseClient } from "./generate";
import { assembleDays } from "./assemble";
import { generateSlug } from "./slug";

const SPECIAL_NEEDS_TAG: Record<string, string> = {
  acessibilidade: "acessibilidade",
  vegano: "vegano",
  bebe: "bebe",
  pet: "pet",
};

export class NoCandidatesError extends Error {}

export interface CreateItineraryDeps {
  supabase: SupabaseClient;
  anthropicClient?: MessagesParseClient;
}

export async function createItinerary(answers: QuizAnswers, deps: CreateItineraryDeps): Promise<ItineraryRow> {
  const allPlaces = await listPlaces(deps.supabase);
  const filtered = filterCandidates(allPlaces, answers);
  if (filtered.length === 0) {
    throw new NoCandidatesError("Não encontramos lugares suficientes para esse perfil ainda.");
  }

  const specialNeedsTag = answers.special ? (SPECIAL_NEEDS_TAG[answers.special] ?? null) : null;
  const candidates = weightedSample(filtered, { count: Math.min(25, filtered.length), specialNeedsTag });
  if (candidates.length < 8) {
    console.warn(`Low candidate pool (${candidates.length}) for answers`, answers);
  }

  const generation = deps.anthropicClient
    ? await generateItinerary(candidates, answers, deps.anthropicClient)
    : await generateItinerary(candidates, answers);

  const days = assembleDays(generation, candidates);
  const slug = generateSlug();

  return insertItinerary(deps.supabase, {
    slug,
    quiz_answers: answers as Record<string, unknown>,
    welcome_message: generation.welcome_message,
    days,
  });
}
