// scripts/migrate-excel.ts
import * as XLSX from "xlsx";
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { parsePlacesSheet, parseEventsSheet } from "./lib/parseBancoDeLocais";

const SOURCE_PATH = process.argv[2] ?? "../floripa-me-banco-locais.xlsx";

async function main() {
  const workbook = XLSX.readFile(SOURCE_PATH);

  const placesSheet = workbook.Sheets["Banco de Locais"];
  const placesMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(placesSheet, { header: 1 });
  const places = parsePlacesSheet(placesMatrix);

  const eventsSheet = workbook.Sheets["Eventos Anuais"];
  const eventsMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(eventsSheet, { header: 1 });
  const events = parseEventsSheet(eventsMatrix);

  const client = getSupabaseAdminClient();

  const { error: placesError } = await client.from("places").insert(places);
  if (placesError) throw placesError;
  console.log(`Inserted ${places.length} places.`);

  const { error: eventsError } = await client.from("events").insert(events);
  if (eventsError) throw eventsError;
  console.log(`Inserted ${events.length} events.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
