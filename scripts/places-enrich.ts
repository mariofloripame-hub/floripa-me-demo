// scripts/places-enrich.ts
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces, updatePlaceEnrichment } from "../src/lib/supabase/queries";
import { buildTextSearchRequest, mapEnrichmentUpdate } from "./lib/placesApi";

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY must be set");

  const client = getSupabaseAdminClient();
  const places = await listPlaces(client);
  const missingCoords = places.filter((p) => !p.google_place_id || p.lat === null);

  let enriched = 0;
  for (const place of missingCoords) {
    const req = buildTextSearchRequest(
      { query: `${place.name} ${place.address || place.neighborhood}`, region: place.region, category: place.category },
      apiKey,
    );
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (!response.ok) {
      console.error(`Search failed for "${place.name}": ${response.status}`);
      continue;
    }
    const json = (await response.json()) as { places?: Array<Parameters<typeof mapEnrichmentUpdate>[0]> };
    const bestMatch = json.places?.[0];
    if (!bestMatch) {
      console.warn(`No match found for "${place.name}" — skipping.`);
      continue;
    }
    const patch = mapEnrichmentUpdate(bestMatch, apiKey);
    await updatePlaceEnrichment(client, place.id, patch);
    enriched += 1;
  }
  console.log(`Enriched ${enriched}/${missingCoords.length} places.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
