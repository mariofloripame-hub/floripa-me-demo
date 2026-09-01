// scripts/lib/parseBancoDeLocais.ts
type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

export interface ParsedPlace {
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
}

export interface ParsedEvent {
  name: string;
  start_month: number;
  end_month: number;
  location: string;
  target_profiles: string[];
  is_free: string;
  active: boolean;
  notes: string | null;
}

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  março: 3, marco: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

const VALID_PRICE_RANGES = new Set(["Gratuito", "R$", "R$$", "R$$$"]);

export function normalizePriceRange(raw: string): string {
  const trimmed = raw.trim();
  if (VALID_PRICE_RANGES.has(trimmed)) return trimmed;
  if (/^gratuito/i.test(trimmed)) return "Gratuito";
  if (/r\$\$\$/i.test(trimmed)) return "R$$$";
  if (/r\$\$/i.test(trimmed)) return "R$$";
  if (/r\$/i.test(trimmed)) return "R$";
  console.warn(`Unrecognized price_range "${raw}", defaulting to "R$$".`);
  return "R$$";
}

function resolveMonth(raw: string, fallback: number): number {
  const key = raw.trim().toLowerCase();
  if (!key) return fallback;
  const month = MONTHS[key];
  if (month === undefined) {
    console.warn(`Unrecognized month "${raw}", defaulting to ${fallback}.`);
    return fallback;
  }
  return month;
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

/**
 * The real workbook prefixes each sheet with a title row (and, on "Banco de
 * Locais", an extra instructions row) before the actual column-header row —
 * so the header isn't always matrix[0]. Scan for the row containing a known
 * required column instead of assuming a fixed position.
 */
function splitAtHeaderRow(matrix: Row[], mustInclude: string): { header: Row; rows: Row[] } {
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => str(cell).toUpperCase() === mustInclude.toUpperCase()),
  );
  if (headerIndex === -1) {
    throw new Error(`Header row not found (expected a column named "${mustInclude}")`);
  }
  return { header: matrix[headerIndex], rows: matrix.slice(headerIndex + 1) };
}

export function parsePlacesSheet(matrix: Row[]): ParsedPlace[] {
  const { header, rows } = splitAtHeaderRow(matrix, "REGIÃO");
  const col = {
    region: columnIndex(header, "REGIÃO"),
    neighborhood: columnIndex(header, "BAIRRO / LOCAL"),
    name: columnIndex(header, "NOME DO ESTABELECIMENTO"),
    category: columnIndex(header, "CATEGORIA"),
    profiles: columnIndex(header, "PERFIL IDEAL"),
    price: columnIndex(header, "FAIXA DE PREÇO"),
    pointType: columnIndex(header, "TIPO DE PONTO"),
    partner: columnIndex(header, "PARCEIRO FLORIPA.ME"),
    description: columnIndex(header, "DESCRIÇÃO CURTA (para o roteiro)"),
    address: columnIndex(header, "ENDEREÇO / REFERÊNCIA"),
    hours: columnIndex(header, "HORÁRIO DE FUNCIONAMENTO"),
    phone: columnIndex(header, "TELEFONE / WHATSAPP"),
    instagram: columnIndex(header, "INSTAGRAM"),
    notes: columnIndex(header, "OBSERVAÇÕES / DICAS LOCAIS"),
  };

  let lastRegion = "";
  let lastNeighborhood = "";
  const results: ParsedPlace[] = [];

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    if (str(row[0]).startsWith("▌")) continue; // region banner row
    if (str(row[col.name]).toLowerCase().startsWith("preencha um novo local")) continue;
    if (str(row[col.name]) === "") continue;

    const region = str(row[col.region]) || lastRegion;
    const neighborhood = str(row[col.neighborhood]) || lastNeighborhood;
    lastRegion = region;
    lastNeighborhood = neighborhood;

    results.push({
      region,
      neighborhood,
      name: str(row[col.name]),
      category: str(row[col.category]),
      target_profiles: str(row[col.profiles]).split(",").map((s) => s.trim()).filter(Boolean),
      price_range: normalizePriceRange(str(row[col.price])),
      point_type: str(row[col.pointType]),
      is_partner: str(row[col.partner]).toLowerCase() === "sim",
      short_description: str(row[col.description]),
      address: str(row[col.address]),
      opening_hours: str(row[col.hours]) || null,
      phone: str(row[col.phone]) || null,
      instagram: str(row[col.instagram]) || null,
      notes: str(row[col.notes]) || null,
    });
  }

  return results;
}

export function parseEventsSheet(matrix: Row[]): ParsedEvent[] {
  const { header, rows } = splitAtHeaderRow(matrix, "EVENTO");
  const col = {
    name: columnIndex(header, "EVENTO"),
    startMonth: columnIndex(header, "MÊS INÍCIO"),
    endMonth: columnIndex(header, "MÊS FIM"),
    location: columnIndex(header, "LOCAL"),
    free: columnIndex(header, "GRATUITO"),
    active: columnIndex(header, "ATIVO"),
    notes: columnIndex(header, "OBSERVAÇÕES / INJETAR NO ROTEIRO"),
  };
  const profilesIdx = header.findIndex((h) => str(h).toUpperCase().includes("PERFIL"));

  const results: ParsedEvent[] = [];
  for (const row of rows) {
    const name = str(row[col.name]);
    if (!name) continue;

    const start_month = resolveMonth(str(row[col.startMonth]), 1);
    const end_month = resolveMonth(str(row[col.endMonth]), start_month);

    results.push({
      name,
      start_month,
      end_month,
      location: str(row[col.location]),
      target_profiles: profilesIdx >= 0 && str(row[profilesIdx])
        ? str(row[profilesIdx]).split(",").map((s) => s.trim()).filter(Boolean)
        : ["Todos"],
      is_free: str(row[col.free]) || "Não",
      active: row[col.active] === true || str(row[col.active]).toLowerCase() === "sim",
      notes: str(row[col.notes]) || null,
    });
  }
  return results;
}
