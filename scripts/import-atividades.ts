// scripts/import-atividades.ts
//
// Imports the "Banco de Atividades" curation spreadsheet into `places`.
// Matches existing rows by normalized name and updates their content fields
// (without touching Google-enrichment or partner-program fields); everything
// else is inserted as new. Defaults to a dry run — pass --commit to write.
//
// Usage:
//   npm run import:atividades -- "../Floripa.me_Banco_de_Atividades.xlsx"
//   npm run import:atividades -- "../Floripa.me_Banco_de_Atividades.xlsx" --commit
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces } from "../src/lib/supabase/queries";
import { parseAtividadesSheet, type ParsedAtividade } from "./lib/parseAtividades";

const SOURCE_PATH = process.argv[2] ?? "../Floripa.me_Banco_de_Atividades.xlsx";
const COMMIT = process.argv.includes("--commit");

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toPlaceRow(row: ParsedAtividade): Omit<ParsedAtividade, "source_id"> {
  return {
    region: row.region,
    neighborhood: row.neighborhood,
    name: row.name,
    category: row.category,
    target_profiles: row.target_profiles,
    price_range: row.price_range,
    point_type: row.point_type,
    is_partner: row.is_partner,
    short_description: row.short_description,
    address: row.address,
    opening_hours: row.opening_hours,
    phone: row.phone,
    instagram: row.instagram,
    notes: row.notes,
    is_verified: row.is_verified,
  };
}

function tally<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function printTally(title: string, map: Map<string, number>) {
  console.log(`\n=== ${title} ===`);
  [...map.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${v}\t${k}`));
}

async function main() {
  const workbook = XLSX.read(readFileSync(SOURCE_PATH));
  const sheet = workbook.Sheets["Atividades"];
  if (!sheet) throw new Error(`Sheet "Atividades" not found in ${SOURCE_PATH}`);
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1 });
  const parsed = parseAtividadesSheet(matrix);

  const client = getSupabaseAdminClient();
  const existing = await listPlaces(client);
  const existingByName = new Map(existing.map((p) => [normalizeName(p.name), p]));

  const toInsert: ParsedAtividade[] = [];
  const toUpdate: { id: string; patch: Partial<ParsedAtividade> }[] = [];

  for (const row of parsed) {
    const match = existingByName.get(normalizeName(row.name));
    if (!match) {
      toInsert.push(row);
      continue;
    }
    toUpdate.push({
      id: match.id,
      patch: {
        region: row.region,
        neighborhood: row.neighborhood,
        category: row.category,
        target_profiles: row.target_profiles,
        price_range: row.price_range,
        point_type: row.point_type,
        short_description: row.short_description,
        notes: row.notes,
        is_verified: row.is_verified,
        ...(match.address ? {} : { address: row.address }),
      },
    });
  }

  console.log(`Parsed ${parsed.length} rows: ${toInsert.length} to insert, ${toUpdate.length} to update.`);
  printTally("category (estilo) escolhido", tally(parsed, (r) => r.category));
  printTally("point_type escolhido", tally(parsed, (r) => r.point_type));
  printTally("is_verified", tally(parsed, (r) => String(r.is_verified)));

  const pontoTuristico = parsed.filter((r) => r.point_type === "Ponto Turístico");
  console.log(`\n=== Revisão: ${pontoTuristico.length} "Ponto Turístico" (categoria de estilo escolhida) ===`);
  pontoTuristico.forEach((r) => console.log(`${r.source_id}\t${r.name}\t-> ${r.category}`));

  if (!COMMIT) {
    console.log("\nDry run — nada foi escrito no banco. Rode com --commit para aplicar.");
    return;
  }

  const { error: insertError } = toInsert.length
    ? await client.from("places").insert(toInsert.map(toPlaceRow))
    : { error: null };
  if (insertError) console.error("Falha ao inserir places:", insertError.message);

  let updated = 0;
  let updateFailed = 0;
  for (const { id, patch } of toUpdate) {
    const { error } = await client.from("places").update(patch).eq("id", id);
    if (error) {
      updateFailed += 1;
      console.error(`Falha ao atualizar place ${id}:`, error.message);
    } else {
      updated += 1;
    }
  }

  console.log(`\nInseridos: ${toInsert.length - (insertError ? toInsert.length : 0)}/${toInsert.length}`);
  console.log(`Atualizados: ${updated}/${toUpdate.length} (${updateFailed} falharam)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
