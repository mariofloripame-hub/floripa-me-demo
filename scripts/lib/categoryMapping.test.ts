// scripts/lib/categoryMapping.test.ts
import { describe, it, expect } from "vitest";
import {
  mapCategoriaToPointType,
  classifyStyleCategory,
  normalizeProfiles,
  mapPrecoToPriceRange,
  mapRegiao,
  isVerifiedFromValidacao,
} from "./categoryMapping";

describe("mapCategoriaToPointType", () => {
  it("maps direct categories to the existing point_type vocabulary", () => {
    expect(mapCategoriaToPointType("Restaurante")).toBe("Restaurante");
    expect(mapCategoriaToPointType("Ponto turístico")).toBe("Ponto Turístico");
    expect(mapCategoriaToPointType("Bar")).toBe("Bar");
    expect(mapCategoriaToPointType("Beach club")).toBe("Beach Club");
    expect(mapCategoriaToPointType("Café")).toBe("Café");
  });

  it("maps combo categories to combo point_types consistent with existing 'X / Y' entries", () => {
    expect(mapCategoriaToPointType("Restaurante / bar")).toBe("Bar / Restaurante");
    expect(mapCategoriaToPointType("Restaurante / beach club")).toBe("Restaurante / Beach Club");
  });

  it("maps activity-like categories (trilha, aula, experiência, passeio náutico) to 'Atividade'", () => {
    expect(mapCategoriaToPointType("Trilha")).toBe("Atividade");
    expect(mapCategoriaToPointType("Aula")).toBe("Atividade");
    expect(mapCategoriaToPointType("Experiência")).toBe("Atividade");
    expect(mapCategoriaToPointType("Passeio náutico")).toBe("Atividade");
  });

  it("maps commerce categories to 'Comércio'", () => {
    expect(mapCategoriaToPointType("Comércio / artesanato")).toBe("Comércio");
    expect(mapCategoriaToPointType("Feira / artesanato")).toBe("Comércio");
  });

  it("falls back to the raw value, trimmed, for anything unrecognized", () => {
    expect(mapCategoriaToPointType("Algo Novo")).toBe("Algo Novo");
  });
});

describe("classifyStyleCategory", () => {
  it("maps unambiguous categories directly to the fixed style taxonomy", () => {
    expect(classifyStyleCategory("Restaurante", "Frutos do mar")).toBe("Gastronomia");
    expect(classifyStyleCategory("Bar", "Petiscos")).toBe("Bar / Noturno");
    expect(classifyStyleCategory("Beach club", "")).toBe("Beach Club");
    expect(classifyStyleCategory("Café", "Padaria")).toBe("Café / Padaria");
    expect(classifyStyleCategory("Trilha", "Trilha e praia")).toBe("Trilha");
    expect(classifyStyleCategory("Aula", "Aula de surf")).toBe("Esporte");
    expect(classifyStyleCategory("Passeio náutico", "Lancha privativa")).toBe("Passeio");
  });

  it("classifies 'Ponto turístico' using subcategoria keywords", () => {
    expect(classifyStyleCategory("Ponto turístico", "Praia")).toBe("Praia");
    expect(classifyStyleCategory("Ponto turístico", "Trilha longa e cênica")).toBe("Trilha");
    expect(classifyStyleCategory("Ponto turístico", "Patrimônio histórico e religioso")).toBe("Cultura");
    expect(classifyStyleCategory("Ponto turístico", "Lagoa, parque e banho")).toBe("Natureza");
    expect(classifyStyleCategory("Ponto turístico", "Mirante e fotografia")).toBe("Mirante");
  });

  it("falls back to 'Passeio' for 'Ponto turístico' when no keyword matches", () => {
    expect(classifyStyleCategory("Ponto turístico", "Algo sem palavra-chave conhecida")).toBe("Passeio");
  });
});

describe("normalizeProfiles", () => {
  it("splits on ';', trims, and renames 'Sozinho' to 'Solo' to match the quiz's expected label", () => {
    expect(normalizeProfiles("Casal; Família; Negócios")).toEqual(["Casal", "Família", "Negócios"]);
    expect(normalizeProfiles("Sozinho; Aventura")).toEqual(["Solo", "Aventura"]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalizeProfiles("")).toEqual([]);
  });
});

describe("mapPrecoToPriceRange", () => {
  it("maps $ tiers to the schema's R$ tiers, collapsing $$$$ into R$$$", () => {
    expect(mapPrecoToPriceRange("$")).toBe("R$");
    expect(mapPrecoToPriceRange("$$")).toBe("R$$");
    expect(mapPrecoToPriceRange("$$$")).toBe("R$$$");
    expect(mapPrecoToPriceRange("$$$$")).toBe("R$$$");
  });

  it("maps 'Grátis' to 'Gratuito'", () => {
    expect(mapPrecoToPriceRange("Grátis")).toBe("Gratuito");
  });

  it("resolves ambiguous compound values to the more conservative (paid) tier", () => {
    expect(mapPrecoToPriceRange("Grátis / $")).toBe("R$");
    expect(mapPrecoToPriceRange("Grátis / $$")).toBe("R$$");
  });

  it("defaults 'Sob consulta' to the most exclusive tier", () => {
    expect(mapPrecoToPriceRange("Sob consulta")).toBe("R$$$");
  });
});

describe("mapRegiao", () => {
  it("strips the ' da Ilha' suffix", () => {
    expect(mapRegiao("Sul da Ilha")).toBe("Sul");
    expect(mapRegiao("Norte da Ilha")).toBe("Norte");
    expect(mapRegiao("Leste da Ilha")).toBe("Leste");
  });

  it("merges 'Região Central' into 'Centro'", () => {
    expect(mapRegiao("Região Central")).toBe("Centro");
    expect(mapRegiao("Centro")).toBe("Centro");
  });

  it("leaves other regions unchanged", () => {
    expect(mapRegiao("Continente")).toBe("Continente");
  });
});

describe("isVerifiedFromValidacao", () => {
  it("treats 'Ativo*' and 'Ponto público*' statuses as verified", () => {
    expect(isVerifiedFromValidacao("Ativo - verificado")).toBe(true);
    expect(isVerifiedFromValidacao("Ativo - validar programação")).toBe(true);
    expect(isVerifiedFromValidacao("Ponto público")).toBe(true);
    expect(isVerifiedFromValidacao("Ponto público com acesso controlado")).toBe(true);
  });

  it("treats 'Validar*', 'Prospectar*', and 'Mapear*' statuses as not yet verified", () => {
    expect(isVerifiedFromValidacao("Validar cadastro e horários")).toBe(false);
    expect(isVerifiedFromValidacao("Prospectar parceiro")).toBe(false);
    expect(isVerifiedFromValidacao("Mapear estabelecimentos")).toBe(false);
  });
});
