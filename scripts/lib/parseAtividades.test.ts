// scripts/lib/parseAtividades.test.ts
import { describe, it, expect } from "vitest";
import { parseAtividadesSheet } from "./parseAtividades";

const HEADER = [
  "ID", "Região", "Localidade", "Categoria", "Nome", "Subcategoria", "Preço",
  "Perfis", "Descrição para o roteiro", "Origem", "Validação", "Prioridade", "Fonte / referência",
];

describe("parseAtividadesSheet", () => {
  it("parses a row into a place-shaped record with mapped taxonomy", () => {
    const matrix = [
      HEADER,
      [
        "SUL-001", "Sul da Ilha", "Ribeirão da Ilha", "Restaurante", "Ostradamus",
        "Frutos do mar e ostras", "$$$$", "Casal; Família; Negócios",
        "Gastronomia de alto padrão à beira-mar.", "Original", "Ativo - verificado", "Alta",
        "https://www.ostradamus.com.br/",
      ],
    ];

    const result = parseAtividadesSheet(matrix);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source_id: "SUL-001",
      region: "Sul",
      neighborhood: "Ribeirão da Ilha",
      name: "Ostradamus",
      point_type: "Restaurante",
      category: "Gastronomia",
      price_range: "R$$$",
      target_profiles: ["Casal", "Família", "Negócios"],
      short_description: "Gastronomia de alto padrão à beira-mar.",
      is_partner: false,
      is_verified: true,
    });
    expect(result[0].notes).toContain("SUL-001");
    expect(result[0].notes).toContain("Frutos do mar e ostras");
    expect(result[0].notes).toContain("https://www.ostradamus.com.br/");
  });

  it("marks rows with a pending Validação status as not verified", () => {
    const matrix = [
      HEADER,
      [
        "SUL-002", "Sul da Ilha", "Ribeirão da Ilha", "Restaurante", "Nacanoa Oyster Bar",
        "Ostras e frutos do mar", "$$$", "Casal; Amigos",
        "Ambiente descontraído com vista.", "Original", "Validar cadastro e horários", "Alta",
        "Lista original do usuário",
      ],
    ];

    const result = parseAtividadesSheet(matrix);

    expect(result[0].is_verified).toBe(false);
  });

  it("classifies 'Ponto turístico' rows using the subcategoria", () => {
    const matrix = [
      HEADER,
      [
        "SUL-006", "Sul da Ilha", "Ribeirão da Ilha", "Ponto turístico", "Igreja Nossa Senhora da Lapa",
        "Patrimônio histórico e religioso", "Grátis", "Casal; Família; Cultural",
        "Marco da arquitetura açoriana.", "Adicionado / nome corrigido", "Ponto público", "Alta",
        "https://guiafloripa.com.br/",
      ],
    ];

    const result = parseAtividadesSheet(matrix);

    expect(result[0]).toMatchObject({ category: "Cultura", point_type: "Ponto Turístico", price_range: "Gratuito" });
  });

  it("skips blank rows", () => {
    const matrix = [HEADER, ["", "", "", "", "", "", "", "", "", "", "", "", ""]];
    expect(parseAtividadesSheet(matrix)).toHaveLength(0);
  });
});
