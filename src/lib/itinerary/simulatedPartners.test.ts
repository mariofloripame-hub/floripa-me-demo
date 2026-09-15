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
});
