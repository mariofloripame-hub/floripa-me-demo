import { describe, it, expect } from "vitest";
import { liveOfferText, liveOfferMap } from "./liveOffers";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar", category: "Gastronomia",
    target_profiles: [], price_range: "R$$", point_type: "Restaurante", short_description: "",
    address: "", opening_hours: null, phone: null, instagram: null, notes: null, google_place_id: null,
    lat: null, lng: null, rating: null, photos: [], is_partner: true, partner_plan: null,
    partner_offer: "Sobremesa cortesia", partner_status: null, special_needs_tags: [], is_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("liveOfferText", () => {
  it("returns the trimmed offer for a verified real partner", () => {
    expect(liveOfferText(place({ partner_offer: "  Sobremesa cortesia " }))).toBe("Sobremesa cortesia");
  });

  it.each([
    ["not a real partner (e.g. a simulated one)", { is_partner: false }],
    ["not verified", { is_verified: false }],
    ["offer is null", { partner_offer: null }],
    ["offer is blank", { partner_offer: "   " }],
  ])("is null when %s", (_label, overrides) => {
    expect(liveOfferText(place(overrides as Partial<Place>))).toBeNull();
  });
});

describe("liveOfferMap", () => {
  it("maps only places with a live offer", () => {
    const places = [
      place({ id: "a", partner_offer: "Chopp em dobro" }),
      place({ id: "b", is_partner: false, partner_offer: "Oferta simulada" }),
      place({ id: "c", partner_offer: null }),
    ];
    expect(liveOfferMap(places)).toEqual({ a: "Chopp em dobro" });
  });
});
