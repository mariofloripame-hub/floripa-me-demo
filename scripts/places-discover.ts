// scripts/places-discover.ts
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces } from "../src/lib/supabase/queries";
import { buildTextSearchRequest, mapDiscoveryResult, type DiscoverySeed } from "./lib/placesApi";

const SEEDS: DiscoverySeed[] = [
  { query: "praia Sul da Ilha Florianópolis", region: "Sul", category: "Praia" },
  { query: "restaurante Campeche Florianópolis", region: "Sul", category: "Gastronomia" },
  { query: "restaurante Lagoa da Conceição Florianópolis", region: "Leste", category: "Gastronomia" },
  { query: "bar Lagoa da Conceição Florianópolis", region: "Leste", category: "Bar / Noturno" },
  { query: "restaurante Jurerê Florianópolis", region: "Norte", category: "Gastronomia" },
  { query: "trilha Florianópolis", region: "Sul", category: "Trilha" },
];

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY must be set");

  const client = getSupabaseAdminClient();
  const existing = await listPlaces(client);
  const knownIds = new Set(existing.map((p) => p.google_place_id).filter(Boolean));

  let inserted = 0;
  for (const seed of SEEDS) {
    const req = buildTextSearchRequest(seed, apiKey);
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (!response.ok) {
      console.error(`Search failed for "${seed.query}": ${response.status}`);
      continue;
    }
    const json = (await response.json()) as { places?: Array<Parameters<typeof mapDiscoveryResult>[0]> };
    for (const apiPlace of json.places ?? []) {
      if (knownIds.has(apiPlace.id)) continue;
      const candidate = mapDiscoveryResult(apiPlace, seed);
      const { error } = await client.from("places").insert(candidate);
      if (error) {
        console.error(`Insert failed for ${candidate.name}:`, error.message);
        continue;
      }
      knownIds.add(apiPlace.id);
      inserted += 1;
    }
  }
  console.log(`Discovered and inserted ${inserted} new candidate places.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
