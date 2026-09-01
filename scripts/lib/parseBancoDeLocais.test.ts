// scripts/lib/parseBancoDeLocais.test.ts
import { describe, it, expect, vi } from "vitest";
import { parsePlacesSheet, parseEventsSheet } from "./parseBancoDeLocais";

const PLACES_HEADER = [
  "#", "REGIÃO", "BAIRRO / LOCAL", "NOME DO ESTABELECIMENTO", "CATEGORIA",
  "PERFIL IDEAL", "FAIXA DE PREÇO", "TIPO DE PONTO", "PARCEIRO FLORIPA.ME",
  "DESCRIÇÃO CURTA (para o roteiro)", "ENDEREÇO / REFERÊNCIA",
  "HORÁRIO DE FUNCIONAMENTO", "TELEFONE / WHATSAPP", "INSTAGRAM",
  "LINK GOOGLE MAPS", "OBSERVAÇÕES / DICAS LOCAIS",
];

describe("parsePlacesSheet", () => {
  it("skips region banner rows and forward-fills região/bairro", () => {
    const matrix = [
      PLACES_HEADER,
      ["▌  SUL DA ILHA"],
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Casal, Amigos, Solo", "Gratuito", "Ponto Turístico", "Sim", "Praia extensa.", "Praia do Campeche, Florianópolis", "", "", "", "", ""],
      ["02", "", "", "Tia Jú", "Gastronomia", "Todos", "R$ (econômico)", "Restaurante", "Não", "Comida caseira farta.", "Av. Campeche, Campeche", "", "", "", "", ""],
    ];

    const result = parsePlacesSheet(matrix);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche", is_partner: true, price_range: "Gratuito" });
    expect(result[1]).toMatchObject({ region: "Sul", neighborhood: "Campeche", name: "Tia Jú", is_partner: false, price_range: "R$" });
  });

  it("normalizes price_range variants into the schema's exact 4 values", () => {
    const rows = ["R$ (econômico)", "R$$ (médio)", "R$$$ (alto)", "Gratuito", "gratuito (sem custo)", "algo estranho"].map(
      (price, i) => [String(i + 1), "Sul", "Campeche", `Local ${i}`, "Praia", "Todos", price, "Ponto Turístico", "Não", "d", "e", "", "", "", "", ""],
    );
    const matrix = [PLACES_HEADER, ...rows];

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parsePlacesSheet(matrix);
    warn.mockRestore();

    expect(result.map((r) => r.price_range)).toEqual(["R$", "R$$", "R$$$", "Gratuito", "Gratuito", "R$$"]);
  });

  it("splits the perfil ideal column on commas into target_profiles", () => {
    const matrix = [
      PLACES_HEADER,
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Casal, Amigos, Solo", "Gratuito", "Ponto Turístico", "Sim", "d", "e", "", "", "", "", ""],
    ];
    const result = parsePlacesSheet(matrix);
    expect(result[0].target_profiles).toEqual(["Casal", "Amigos", "Solo"]);
  });

  it("skips the trailing 'preencha um novo local' placeholder row", () => {
    const matrix = [
      PLACES_HEADER,
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Todos", "Gratuito", "Ponto Turístico", "Sim", "d", "e", "", "", "", "", ""],
      ["→", "", "", "Preencha um novo local desta região aqui", "", "", "", "", "", "", "", "", "", "", "", ""],
    ];
    expect(parsePlacesSheet(matrix)).toHaveLength(1);
  });

  it("skips fully blank rows", () => {
    const matrix = [PLACES_HEADER, [], ["01", "Sul", "Campeche", "X", "Praia", "Todos", "Gratuito", "Ponto Turístico", "Não", "d", "e", "", "", "", "", ""]];
    expect(parsePlacesSheet(matrix)).toHaveLength(1);
  });
});

describe("parseEventsSheet", () => {
  const EVENTS_HEADER = ["EVENTO", "MÊS INÍCIO", "MÊS FIM", "LOCAL", "GRATUITO", "ATIVO", "OBSERVAÇÕES / INJETAR NO ROTEIRO"];

  it("parses month names into 1-12 and defaults target_profiles to Todos when no perfil column exists", () => {
    const matrix = [
      EVENTS_HEADER,
      ["Fenaostra", "Julho", "Julho", "CentroSul", "Parcial", true, "Festa Nacional da Ostra."],
    ];
    const result = parseEventsSheet(matrix);
    expect(result[0]).toMatchObject({
      name: "Fenaostra",
      start_month: 7,
      end_month: 7,
      location: "CentroSul",
      is_free: "Parcial",
      active: true,
      target_profiles: ["Todos"],
    });
  });

  it("skips rows with no event name", () => {
    const matrix = [EVENTS_HEADER, ["", "", "", "", "", "", ""]];
    expect(parseEventsSheet(matrix)).toHaveLength(0);
  });

  it("never produces 0 for an unrecognized month string (defaults to 1 / mirrors start month instead)", () => {
    const matrix = [
      EVENTS_HEADER,
      ["Festival X", "Mêsinvalido", "Mêsinvalido", "Centro", "Não", true, ""],
    ];

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseEventsSheet(matrix);
    warn.mockRestore();

    expect(result[0].start_month).toBe(1);
    expect(result[0].end_month).toBe(1);
    expect(result[0].start_month).not.toBe(0);
    expect(result[0].end_month).not.toBe(0);
  });

  it("resolves common month abbreviations", () => {
    const matrix = [EVENTS_HEADER, ["Festa Jun", "jun", "jul", "Centro", "Não", true, ""]];
    const result = parseEventsSheet(matrix);
    expect(result[0]).toMatchObject({ start_month: 6, end_month: 7 });
  });
});
