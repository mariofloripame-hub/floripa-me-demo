// scripts/lib/categoryMapping.ts
//
// Maps the free-text vocabulary used in the "Atividades" curation spreadsheet
// onto the fixed vocabularies the app already depends on:
//   - point_type: mostly descriptive, no fixed set, but we stay consistent
//     with the "X / Y" combo convention already present in the `places` table.
//   - category: MUST be one of the exact strings STYLE_CATEGORIES in
//     src/lib/itinerary/filterCandidates.ts recognizes, or the place becomes
//     unreachable by style-based quiz filtering.

const POINT_TYPE_MAP: Record<string, string> = {
  restaurante: "Restaurante",
  "ponto turístico": "Ponto Turístico",
  "ponto turístico / cultural": "Ponto Turístico",
  bar: "Bar",
  "beach bar": "Bar",
  "beach club": "Beach Club",
  café: "Café",
  "café / comércio": "Café",
  "café / padaria": "Café",
  "café / loja": "Café",
  "restaurante / bar": "Bar / Restaurante",
  "bar / gastronomia": "Bar / Restaurante",
  "restaurante / beach club": "Restaurante / Beach Club",
  trilha: "Atividade",
  aula: "Atividade",
  atividade: "Atividade",
  experiência: "Atividade",
  "experiência cultural": "Atividade",
  "experiência aérea": "Atividade",
  "passeio náutico": "Atividade",
  comércio: "Comércio",
  "comércio / artesanato": "Comércio",
  "comércio / gastronomia": "Comércio",
  "feira / artesanato": "Comércio",
};

export function mapCategoriaToPointType(categoria: string): string {
  const key = categoria.trim().toLowerCase();
  return POINT_TYPE_MAP[key] ?? categoria.trim();
}

const DIRECT_STYLE_MAP: Record<string, string> = {
  restaurante: "Gastronomia",
  "restaurante / bar": "Gastronomia",
  "bar / gastronomia": "Gastronomia",
  bar: "Bar / Noturno",
  "beach bar": "Bar / Noturno",
  "beach club": "Beach Club",
  "restaurante / beach club": "Beach Club",
  café: "Café / Padaria",
  "café / comércio": "Café / Padaria",
  "café / padaria": "Café / Padaria",
  "café / loja": "Café / Padaria",
  trilha: "Trilha",
  aula: "Esporte",
  "passeio náutico": "Passeio",
  "experiência": "Atividade",
  "experiência cultural": "Cultura",
  "experiência aérea": "Esporte",
  atividade: "Atividade",
  comércio: "Atividade",
  "comércio / artesanato": "Atividade",
  "comércio / gastronomia": "Atividade",
  "feira / artesanato": "Atividade",
};

// Ordered keyword rules used only to disambiguate "Ponto turístico" (and its
// "/ cultural" variant), whose subcategoria ranges from beaches to museums.
// First match wins.
const PONTO_TURISTICO_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /praia/i, category: "Praia" },
  { pattern: /trilha/i, category: "Trilha" },
  { pattern: /mirante|contemplaç|fotografia/i, category: "Mirante" },
  {
    pattern: /patrim[oô]nio|hist[oó]ri|arquitetura|religios|museu|cultura|arqueol[oó]g|rupestres/i,
    category: "Cultura",
  },
  { pattern: /parque|lagoa|dunas|natureza|fauna|ambiental/i, category: "Natureza" },
];

export function classifyStyleCategory(categoria: string, subcategoria: string): string {
  const key = categoria.trim().toLowerCase();

  if (key === "ponto turístico" || key === "ponto turístico / cultural") {
    const match = PONTO_TURISTICO_KEYWORDS.find(({ pattern }) => pattern.test(subcategoria));
    return match?.category ?? "Passeio";
  }

  return DIRECT_STYLE_MAP[key] ?? "Atividade";
}

export function normalizeProfiles(perfis: string): string[] {
  return perfis
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag === "Sozinho" ? "Solo" : tag));
}

export function mapPrecoToPriceRange(preco: string): string {
  const trimmed = preco.trim();
  if (trimmed === "Grátis") return "Gratuito";
  if (trimmed === "Sob consulta") return "R$$$";
  if (trimmed === "Grátis / $") return "R$";
  if (trimmed === "Grátis / $$") return "R$$";
  if (trimmed === "$$$$") return "R$$$";
  if (trimmed === "$$$") return "R$$$";
  if (trimmed === "$$") return "R$$";
  if (trimmed === "$") return "R$";
  return "R$$";
}

export function mapRegiao(regiao: string): string {
  const trimmed = regiao.trim();
  if (trimmed === "Região Central") return "Centro";
  return trimmed.replace(/ da Ilha$/, "");
}

export function isVerifiedFromValidacao(validacao: string): boolean {
  const trimmed = validacao.trim();
  return trimmed.startsWith("Ativo") || trimmed.startsWith("Ponto público");
}
