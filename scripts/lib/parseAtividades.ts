// scripts/lib/parseAtividades.ts
import {
  mapCategoriaToPointType,
  classifyStyleCategory,
  normalizeProfiles,
  mapPrecoToPriceRange,
  mapRegiao,
  isVerifiedFromValidacao,
} from "./categoryMapping";

type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

export interface ParsedAtividade {
  source_id: string;
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: string;
  point_type: string;
  is_partner: boolean;
  short_description: string;
  address: string;
  opening_hours: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  is_verified: boolean;
}

function str(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

function columnIndex(header: Row, name: string): number {
  const idx = header.findIndex((h) => str(h).toUpperCase() === name.toUpperCase());
  if (idx === -1) throw new Error(`Column not found: ${name}`);
  return idx;
}

function isBlankRow(row: Row): boolean {
  return row.every((cell) => str(cell) === "");
}

function buildNotes(sourceId: string, subcategoria: string, fonte: string): string | null {
  const parts = [`[${sourceId}]`];
  if (subcategoria) parts.push(`Subcategoria: ${subcategoria}`);
  if (fonte) parts.push(`Fonte: ${fonte}`);
  return parts.length > 1 ? parts.join(" | ") : null;
}

export function parseAtividadesSheet(matrix: Row[]): ParsedAtividade[] {
  const [header, ...rows] = matrix;
  const col = {
    id: columnIndex(header, "ID"),
    region: columnIndex(header, "Região"),
    neighborhood: columnIndex(header, "Localidade"),
    categoria: columnIndex(header, "Categoria"),
    name: columnIndex(header, "Nome"),
    subcategoria: columnIndex(header, "Subcategoria"),
    preco: columnIndex(header, "Preço"),
    perfis: columnIndex(header, "Perfis"),
    description: columnIndex(header, "Descrição para o roteiro"),
    validacao: columnIndex(header, "Validação"),
    fonte: columnIndex(header, "Fonte / referência"),
  };

  const results: ParsedAtividade[] = [];

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    if (str(row[col.name]) === "") continue;

    const categoria = str(row[col.categoria]);
    const subcategoria = str(row[col.subcategoria]);

    results.push({
      source_id: str(row[col.id]),
      region: mapRegiao(str(row[col.region])),
      neighborhood: str(row[col.neighborhood]),
      name: str(row[col.name]),
      category: classifyStyleCategory(categoria, subcategoria),
      target_profiles: normalizeProfiles(str(row[col.perfis])),
      price_range: mapPrecoToPriceRange(str(row[col.preco])),
      point_type: mapCategoriaToPointType(categoria),
      is_partner: false,
      short_description: str(row[col.description]),
      address: "",
      opening_hours: null,
      phone: null,
      instagram: null,
      notes: buildNotes(str(row[col.id]), subcategoria, str(row[col.fonte])),
      is_verified: isVerifiedFromValidacao(str(row[col.validacao])),
    });
  }

  return results;
}
