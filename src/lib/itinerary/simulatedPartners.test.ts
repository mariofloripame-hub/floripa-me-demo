import { describe, it, expect } from "vitest";
import { selectPartners } from "./simulatedPartners";
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

describe("selectPartners", () => {
  it("includes real partners (is_partner: true)", () => {
    const places = [place({ id: "a", name: "Ostradamus", is_partner: true })];
    expect(selectPartners(places).map((p) => p.id)).toEqual(["a"]);
  });

  it("includes places on the simulated-partner name list, for UI preview only", () => {
    const places = [place({ id: "b", name: "Bar do Arantes", is_partner: false })];
    expect(selectPartners(places).map((p) => p.id)).toEqual(["b"]);
  });

  it("excludes places that are neither real nor simulated partners", () => {
    const places = [place({ id: "c", name: "Algum Lugar Qualquer", is_partner: false })];
    expect(selectPartners(places)).toEqual([]);
  });

  it("never duplicates a place that happens to be both a real and simulated partner", () => {
    const places = [place({ id: "d", name: "Bar do Arantes", is_partner: true })];
    expect(selectPartners(places).map((p) => p.id)).toEqual(["d"]);
  });

  it("simulates a specific, varied offer text for a chosen subset of the simulated partners", () => {
    const places = [place({ id: "e", name: "Bar do Arantes", partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBe("Chopp em dobro até as 20h");
  });

  it("gives each simulated partner with an offer a distinct offer text (not a repeated generic label)", () => {
    const names = [
      "Bar do Arantes", "Ilha Formosa Restaurante e Pastelaria", "Makai Lagoa Café", "Posh Club",
      "P12 Parador Internacional", "Bistrô da Orla", "Artusi Ristorante", "Restaurante Lindacap",
    ];
    const places = names.map((name, i) => place({ id: `p${i}`, name }));
    const offers = selectPartners(places).map((p) => p.partner_offer);
    expect(offers.every((o) => typeof o === "string" && o.length > 0)).toBe(true);
    expect(new Set(offers).size).toBe(names.length);
  });

  it("leaves other simulated partners' offer untouched (no badge for every partner)", () => {
    const places = [place({ id: "f", name: "Restaurante do Moraes", partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBeNull();
  });

  it("never fabricates an offer for a real partner — only simulated names are overridden", () => {
    const places = [place({ id: "g", name: "Ostradamus", is_partner: true, partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBeNull();
  });

  it("excludes tourist-point places from the partner preview, even a real partner (Praia do Campeche)", () => {
    const places = [place({ id: "h", name: "Praia do Campeche", is_partner: true })];
    expect(selectPartners(places)).toEqual([]);
  });

  it("no longer simulates the tourist points that used to be in the list (trail, market, beaches, park)", () => {
    const names = ["Trilha do Saquinho", "Mercado Público", "Praia de Itaguaçu", "Parque da Luz"];
    const places = names.map((name, i) => place({ id: `t${i}`, name }));
    expect(selectPartners(places)).toEqual([]);
  });

  it("simulates the new restaurant replacements", () => {
    const names = ["Restaurante do Moraes", "Artusi Ristorante", "Osli Restaurante", "Restaurante Lindacap"];
    const places = names.map((name, i) => place({ id: `r${i}`, name }));
    expect(selectPartners(places).map((p) => p.name)).toEqual(names);
  });
});
