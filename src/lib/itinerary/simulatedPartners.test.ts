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

  it("simulates a 'Promoção exclusiva' offer for a chosen subset of the simulated partners", () => {
    const places = [place({ id: "e", name: "Bar do Arantes", partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBe("Promoção exclusiva");
  });

  it("leaves other simulated partners' offer untouched (no badge for every partner)", () => {
    const places = [place({ id: "f", name: "Parque da Luz", partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBeNull();
  });

  it("never fabricates an offer for a real partner — only simulated names are overridden", () => {
    const places = [place({ id: "g", name: "Ostradamus", is_partner: true, partner_offer: null })];
    expect(selectPartners(places)[0].partner_offer).toBeNull();
  });
});
