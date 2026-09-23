import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterCandidates, STYLE_CATEGORIES } from "./filterCandidates";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterCandidates", () => {
  it("keeps places whose target_profiles includes the traveler's group", () => {
    const places = [place({ id: "a", target_profiles: ["Casal"] }), place({ id: "b", target_profiles: ["Família"] })];
    const result = filterCandidates(places, { group: "casal" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("always keeps places marked for 'Todos' regardless of group", () => {
    const places = [place({ id: "a", target_profiles: ["Todos"] })];
    const result = filterCandidates(places, { group: "familia" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("excludes places above the allowed price range for an 'economico' budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: "economico" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("allows all price ranges for an 'alto' budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: "alto" });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("allows up to R$$ for a 'medio' budget", () => {
    const places = [
      place({ id: "a", price_range: "R$$" }),
      place({ id: "b", price_range: "R$$$" }),
    ];
    const result = filterCandidates(places, { budget: "medio" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("defaults to the 'medio' price range when no budget was answered", () => {
    const places = [
      place({ id: "a", price_range: "R$$" }),
      place({ id: "b", price_range: "R$$$" }),
    ];
    const result = filterCandidates(places, {});
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by category compatible with the selected style(s)", () => {
    const places = [
      place({ id: "a", category: "Gastronomia" }),
      place({ id: "b", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("does not filter by category when no style was selected", () => {
    const places = [place({ id: "a", category: "Gastronomia" }), place({ id: "b", category: "Bar / Noturno" })];
    const result = filterCandidates(places, {});
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("keeps 'Esporte' and 'Passeio' places when style 'praia' is selected (they were previously unreachable)", () => {
    const places = [
      place({ id: "esporte", category: "Esporte" }),
      place({ id: "passeio", category: "Passeio" }),
      place({ id: "unrelated", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { style: ["praia"] });
    expect(result.map((p) => p.id).sort()).toEqual(["esporte", "passeio"]);
  });

  it("no longer references the invented 'Lazer / Compras' or 'Lazer' category names", () => {
    const source = readFileSync(join(__dirname, "filterCandidates.ts"), "utf-8");
    expect(source).not.toContain("Lazer / Compras");
    expect(source).not.toMatch(/"Lazer"/);
  });

  it("excludes places that are not yet verified", () => {
    const places = [
      place({ id: "verified", is_verified: true }),
      place({ id: "unverified", is_verified: false }),
    ];
    const result = filterCandidates(places, {});
    expect(result.map((p) => p.id)).toEqual(["verified"]);
  });

  it("combines profile, price, and style filters", () => {
    const places = [
      place({ id: "match", target_profiles: ["Casal"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-profile", target_profiles: ["Família"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-category", target_profiles: ["Casal"], price_range: "R$", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { group: "casal", budget: "medio", style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });

  it("no longer has a 'negocios' entry in STYLE_CATEGORIES", () => {
    expect(STYLE_CATEGORIES.negocios).toBeUndefined();
  });
});
