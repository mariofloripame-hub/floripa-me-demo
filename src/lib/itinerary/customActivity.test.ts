import { describe, it, expect } from "vitest";
import { guessCategory, isCustomActivity } from "./customActivity";

describe("guessCategory", () => {
  it.each([
    ["Jantar romântico", "Gastronomia"],
    ["Almoço na praia", "Gastronomia"],
    ["Café da manhã", "Café / Padaria"],
    ["Balada em Jurerê", "Bar / Noturno"],
    ["Beach club", "Beach Club"],
    ["Pôr do sol na Lagoa", "Mirante"],
    ["Trilha da Galheta", "Trilha"],
    ["Aula de surf", "Esporte"],
    ["Passeio de barco", "Passeio"],
    ["Visitar o museu", "Cultura"],
    ["Praia com as crianças", "Praia"],
  ])("maps %s to %s", (name, category) => {
    expect(guessCategory(name)).toBe(category);
  });

  it("matches whole words only, so 'maré' is not the beach keyword 'mar'", () => {
    expect(guessCategory("Ver a maré")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(guessCategory("Descansar no hotel")).toBeNull();
  });
});

describe("isCustomActivity", () => {
  it("is true only for activities typed in by the visitor", () => {
    expect(isCustomActivity({ place_id: "custom-123" })).toBe(true);
    expect(isCustomActivity({ place_id: "a1b2" })).toBe(false);
  });
});
