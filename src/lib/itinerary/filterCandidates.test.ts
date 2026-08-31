import { describe, it, expect } from "vitest";
import { filterCandidates } from "./filterCandidates";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
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

  it("excludes places above the allowed price range for a low budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: 60 });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("allows all price ranges for a high budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: 500 });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
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

  it("combines profile, price, and style filters", () => {
    const places = [
      place({ id: "match", target_profiles: ["Casal"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-profile", target_profiles: ["Família"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-category", target_profiles: ["Casal"], price_range: "R$", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { group: "casal", budget: 150, style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });
});
