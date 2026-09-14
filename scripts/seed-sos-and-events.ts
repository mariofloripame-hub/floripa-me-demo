// scripts/seed-sos-and-events.ts
//
// One-off seed: real emergency services (Polícia, Bombeiro, Guarda Municipal,
// Hospital, Posto de saúde) into sos_places (table was empty), plus:
//  - corrects the month range on two already-seeded events (Fenaostra and
//    Maratona Cultural had outdated months from an earlier seed) to match
//    their confirmed 2026 editions
//  - inserts Festa do Divino Espírito Santo, which wasn't in the table yet
// Réveillon Beira-Mar Norte was already correct and is left untouched.
// Data sourced from public listings (prefeitura, delegacias, hospital,
// event organizers) — verify before re-running in future years, since
// addresses/phones/dates can change.
//
// Run: npm run seed:sos-events
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import type { EventRow, SosPlace } from "../src/lib/supabase/types";

const SOS_PLACES: Omit<SosPlace, "id" | "created_at">[] = [
  {
    category: "seguranca",
    tag: "publico",
    name: "Polícia Militar – Emergência",
    meta: "Atendimento 24h em toda a cidade",
    phone: "190",
    lat: null,
    lng: null,
  },
  {
    category: "seguranca",
    tag: "publico",
    name: "Delegacia de Proteção ao Turista (DPTUR)",
    meta: "Terminal Rodoviário Rita Maria, Centro",
    phone: "(48) 3665-5723",
    lat: null,
    lng: null,
  },
  {
    category: "seguranca",
    tag: "publico",
    name: "Corpo de Bombeiros Militar",
    meta: "Av. Gov. Ivo Silveira, 1521, Capoeiras · Emergência 24h",
    phone: "193",
    lat: null,
    lng: null,
  },
  {
    category: "seguranca",
    tag: "publico",
    name: "Guarda Municipal de Florianópolis",
    meta: "R. Cap. Euclides de Castro, 236, Coqueiros · Seg-Sex 8h-12h e 13h-18h",
    phone: "(48) 3281-4600",
    lat: null,
    lng: null,
  },
  {
    category: "saude",
    tag: "publico",
    name: "Hospital Universitário (HU/UFSC)",
    meta: "R. Profª Maria Flora Pausewang, s/n, Trindade · Pronto-socorro 24h · SUS",
    phone: "(48) 3721-9100",
    lat: null,
    lng: null,
  },
  {
    category: "saude",
    tag: "publico",
    name: "UPA Sul da Ilha",
    meta: "Av. Dep. Diomício Freitas, 3393, Carianos · Aberto 24h",
    phone: "(48) 3239-1793",
    lat: null,
    lng: null,
  },
];

// New event — the table didn't have it yet.
const NEW_EVENTS: Omit<EventRow, "id" | "created_at">[] = [
  {
    name: "Festa do Divino Espírito Santo",
    start_month: 5,
    end_month: 9,
    location: "Centro e comunidades açorianas",
    target_profiles: ["Todos"],
    is_free: "Sim",
    active: true,
    notes: "Tradição açoriana com novenas, folias e cortejos, celebrada em diversas comunidades da ilha.",
  },
];

// Month corrections for events already seeded (2026-09-01) with outdated
// months — matched by name against the existing row.
const EVENT_MONTH_FIXES: { name: string; start_month: number; end_month: number; notes: string }[] = [
  {
    name: "Fenaostra",
    start_month: 10,
    end_month: 10,
    notes: "Festa Nacional da Ostra. 60+ expositores. Gratuito de dia. Injetar para perfil gastronomia em outubro.",
  },
  {
    name: "Maratona Cultural",
    start_month: 3,
    end_month: 3,
    notes: "Shows, feiras e exposições por toda a cidade. Injetar para perfil cultura/gastronomia em março.",
  },
];

async function main() {
  const client = getSupabaseAdminClient();

  const { data: sosData, error: sosError } = await client.from("sos_places").insert(SOS_PLACES).select();
  if (sosError) throw sosError;
  console.log(`sos_places: ${sosData?.length ?? 0} linhas inseridas.`);

  const { data: newEventsData, error: newEventsError } = await client.from("events").insert(NEW_EVENTS).select();
  if (newEventsError) throw newEventsError;
  console.log(`events: ${newEventsData?.length ?? 0} linhas novas inseridas.`);

  for (const fix of EVENT_MONTH_FIXES) {
    const { data, error } = await client
      .from("events")
      .update({ start_month: fix.start_month, end_month: fix.end_month, notes: fix.notes })
      .eq("name", fix.name)
      .select();
    if (error) throw error;
    console.log(`events: "${fix.name}" atualizado (${data?.length ?? 0} linha).`);
  }
}

main().catch((error) => {
  console.error("Falhou:", error);
  process.exit(1);
});
