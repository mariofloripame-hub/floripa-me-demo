// scripts/dev-seed-test-itinerary.ts
//
// Local-only demo helper: builds one itinerary WITHOUT calling the
// Anthropic API, so you can click through the real Roteiro/Mapa/Dicas/SOS/
// Mais screens against real seeded data at zero cost, before you decide to
// configure ANTHROPIC_API_KEY. It reuses the real filtering/ranking/
// assembly code (filterCandidates, weightedSample, assembleDays) — only the
// "Claude writes the day-by-day narrative" step is replaced by a plain,
// clearly-labeled placeholder message.
//
// Run: npm run demo:itinerary
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces, insertItinerary } from "../src/lib/supabase/queries";
import { filterCandidates } from "../src/lib/itinerary/filterCandidates";
import { weightedSample } from "../src/lib/itinerary/rankCandidates";
import { assembleDays } from "../src/lib/itinerary/assemble";
import { generateSlug } from "../src/lib/itinerary/slug";
import type { QuizAnswers } from "../src/lib/quiz/types";
import type { ItineraryGeneration } from "../src/lib/itinerary/schema";

const SAMPLE_ANSWERS: QuizAnswers = {
  timing: "aviao",
  region: "leste",
  days: "2",
  group: "casal",
  style: ["praia", "gastronomia"],
  transport: "carro",
  budget: 200,
  special: "nenhuma",
};

const TIME_SLOTS = ["09:00", "12:30", "16:00", "20:00"];

async function main() {
  const client = getSupabaseAdminClient();
  const allPlaces = await listPlaces(client);

  const filtered = filterCandidates(allPlaces, SAMPLE_ANSWERS);
  if (filtered.length === 0) {
    console.error(
      "Nenhum lugar compatível encontrado no banco. Rode `npm run migrate:excel` primeiro para importar os lugares da planilha.",
    );
    process.exit(1);
  }

  const candidates = weightedSample(filtered, { count: Math.min(8, filtered.length) });
  const half = Math.ceil(candidates.length / 2);
  const [day1Places, day2Places] = [candidates.slice(0, half), candidates.slice(half)];

  const generation: ItineraryGeneration = {
    welcome_message:
      "Este é um roteiro de EXEMPLO, montado sem inteligência artificial (sem custo nenhum), só para você ver as telas funcionando. Quando configurar a chave da Anthropic, os roteiros de verdade serão escritos pela Claude.",
    days: [
      {
        day_number: 1,
        theme: "Explorando a ilha",
        activities: day1Places.map((p, i) => ({ place_id: p.id, time: TIME_SLOTS[i] ?? "10:00" })),
      },
      {
        day_number: 2,
        theme: "Mais um dia por Floripa",
        activities: day2Places.map((p, i) => ({ place_id: p.id, time: TIME_SLOTS[i] ?? "10:00" })),
      },
    ].filter((d) => d.activities.length > 0),
  };

  const days = assembleDays(generation, candidates);
  const slug = generateSlug();

  await insertItinerary(client, {
    slug,
    quiz_answers: SAMPLE_ANSWERS as Record<string, unknown>,
    welcome_message: generation.welcome_message,
    days,
  });

  console.log("Roteiro de teste criado com sucesso (sem gastar nada)!");
  console.log(`Abra no navegador: http://localhost:3000/roteiro/${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
