// scripts/migrate-excel.ts
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { parsePlacesSheet, parseEventsSheet } from "./lib/parseBancoDeLocais";

const SOURCE_PATH = process.argv[2] ?? "../floripa-me-banco-locais.xlsx";
const CHUNK_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Inserts rows in small chunks so that a single row that violates a CHECK
 * constraint (e.g. a price_range/month value the parser couldn't clean up)
 * only fails its own chunk, instead of aborting the entire batch.
 */
async function insertInChunks<T extends object>(
  client: ReturnType<typeof getSupabaseAdminClient>,
  table: string,
  rows: T[],
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  for (const rowsChunk of chunk(rows, CHUNK_SIZE)) {
    const { error } = await client.from(table).insert(rowsChunk);
    if (error) {
      failed += rowsChunk.length;
      console.error(`Failed to insert a chunk of ${rowsChunk.length} row(s) into "${table}": ${error.message}`);
      console.error("Offending rows:", JSON.stringify(rowsChunk, null, 2));
    } else {
      inserted += rowsChunk.length;
    }
  }

  return { inserted, failed };
}

async function main() {
  // xlsx's ESM build (used here because package.json has "type": "module")
  // omits readFile/readFileSync from its named exports — they depend on
  // Node's `fs`, which the browser-safe ESM entry doesn't bundle. Read the
  // file ourselves and hand the buffer to `read`, which is exported.
  const workbook = XLSX.read(readFileSync(SOURCE_PATH));

  const placesSheet = workbook.Sheets["Banco de Locais"];
  const placesMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(placesSheet, { header: 1 });
  const places = parsePlacesSheet(placesMatrix);

  const eventsSheet = workbook.Sheets["Eventos Anuais"];
  const eventsMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(eventsSheet, { header: 1 });
  const events = parseEventsSheet(eventsMatrix);

  const client = getSupabaseAdminClient();

  const placesResult = await insertInChunks(client, "places", places);
  console.log(`Places: ${placesResult.inserted} inserted, ${placesResult.failed} failed (of ${places.length} total).`);

  const eventsResult = await insertInChunks(client, "events", events);
  console.log(`Events: ${eventsResult.inserted} inserted, ${eventsResult.failed} failed (of ${events.length} total).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
