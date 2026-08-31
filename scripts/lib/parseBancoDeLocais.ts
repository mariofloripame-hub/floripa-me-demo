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
  janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

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

export function parsePlacesSheet(matrix: Row[]): ParsedPlace[] {
  const [header, ...rows] = matrix;
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
      price_range: str(row[col.price]),
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
  const [header, ...rows] = matrix;
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

    results.push({
      name,
      start_month: MONTHS[str(row[col.startMonth]).toLowerCase()] ?? 0,
      end_month: MONTHS[str(row[col.endMonth]).toLowerCase()] ?? MONTHS[str(row[col.startMonth]).toLowerCase()] ?? 0,
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
