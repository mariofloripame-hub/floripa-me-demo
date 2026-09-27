import { describe, it, expect } from "vitest";
import { rankSwapOptions } from "./swapOptions";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "x", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Gastronomia", target_profiles: [], price_range: "R$",
    point_type: "", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const places = [
  place({ id: "a", name: "A", rating: 4.9 }),
  place({ id: "b", name: "B", rating: 4.2 }),
  place({ id: "c", name: "C", rating: null }),
  place({ id: "p", name: "Parceiro", rating: 3.9 }),
  place({ id: "praia", name: "Praia", category: "Praia", rating: 5 }),
];

describe("rankSwapOptions", () => {
  it("keeps only the same category, partners first, then by rating (unrated last)", () => {
    const result = rankSwapOptions(places, { category: "Gastronomia", excludeIds: new Set(), partnerIds: new Set(["p"]) });
    expect(result.map((p) => p.id)).toEqual(["p", "a", "b", "c"]);
  });

  it("leaves out places already in the day", () => {
    const result = rankSwapOptions(places, { category: "Gastronomia", excludeIds: new Set(["a"]), partnerIds: new Set() });
    expect(result.map((p) => p.id)).toEqual(["b", "p", "c"]);
  });

  it("with no category, suggests partners from any category", () => {
    const result = rankSwapOptions(places, { category: null, excludeIds: new Set(), partnerIds: new Set(["p", "praia"]) });
    expect(result.map((p) => p.id)).toEqual(["praia", "p"]);
  });
});
