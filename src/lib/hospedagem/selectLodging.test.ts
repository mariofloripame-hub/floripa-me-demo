import { describe, it, expect } from "vitest";
import { selectLodging } from "./selectLodging";
import { makePlace } from "./fixtures";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

const noShuffle = () => 0.999999; // Fisher-Yates with this keeps the input order

function activity(place_id: string) {
  return { place_id, name: place_id, time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null };
}
function daysWith(...ids: string[]): ItineraryDay[] {
  return [{ day_number: 1, theme: "Dia 1", activities: ids.map(activity) }];
}
const beachNorte = makePlace({ id: "b-norte", category: "Praia", region: "Norte", is_partner: false });
const beachSul = makePlace({ id: "b-sul", category: "Praia", region: "Sul", is_partner: false });

describe("selectLodging", () => {
  it.each([
    ["economico", "R$"],
    ["medio", "R$$"],
    ["alto", "R$$$"],
  ] as const)("prefers the %s tier", (budget, tier) => {
    const places = [
      makePlace({ id: "cheap", price_range: "R$" }),
      makePlace({ id: "mid", price_range: "R$$" }),
      makePlace({ id: "lux", price_range: "R$$$" }),
    ];
    const chosen = places.find((p) => p.price_range === tier)!.id;
    expect(selectLodging(places, { budget }, [], noShuffle)?.featured_id).toBe(chosen);
  });

  it("treats an unanswered budget as médio", () => {
    const places = [makePlace({ id: "cheap", price_range: "R$" }), makePlace({ id: "mid", price_range: "R$$" })];
    expect(selectLodging(places, {}, [], noShuffle)?.featured_id).toBe("mid");
  });

  it("falls back to the second tier, never to other tiers", () => {
    const places = [makePlace({ id: "mid", price_range: "R$$" }), makePlace({ id: "lux", price_range: "R$$$" })];
    expect(selectLodging(places, { budget: "economico" }, [], noShuffle)).toEqual({ featured_id: "mid", alternative_ids: [] });
  });

  it("never picks Gratuito", () => {
    expect(selectLodging([makePlace({ price_range: "Gratuito" })], { budget: "economico" }, [], noShuffle)).toBeNull();
  });

  it("prefers the roteiro's dominant region within a tier", () => {
    const places = [
      beachNorte, beachSul,
      makePlace({ id: "sul", region: "Sul" }),
      makePlace({ id: "norte", region: "norte " }),
    ];
    const days = daysWith("b-norte", "b-norte", "b-sul");
    expect(selectLodging(places, { budget: "medio" }, days, noShuffle)).toEqual({ featured_id: "norte", alternative_ids: ["sul"] });
  });

  it("counts any tied region as a match", () => {
    const places = [beachNorte, beachSul, makePlace({ id: "leste", region: "Leste" }), makePlace({ id: "sul", region: "Sul" })];
    const days = daysWith("b-norte", "b-sul");
    expect(selectLodging(places, { budget: "medio" }, days, noShuffle)?.featured_id).toBe("sul");
  });

  it("orders 1st tier before 2nd tier even when the 2nd tier matches the region", () => {
    const places = [beachNorte, makePlace({ id: "mid-sul", region: "Sul" }), makePlace({ id: "cheap-norte", region: "Norte", price_range: "R$" })];
    expect(selectLodging(places, { budget: "medio" }, daysWith("b-norte"), noShuffle)).toEqual({
      featured_id: "mid-sul",
      alternative_ids: ["cheap-norte"],
    });
  });

  it("returns at most 1 featured + 2 alternatives", () => {
    const places = ["a", "b", "c", "d"].map((id) => makePlace({ id }));
    const result = selectLodging(places, { budget: "medio" }, [], noShuffle);
    expect(result).toEqual({ featured_id: "a", alternative_ids: ["b", "c"] });
  });

  it("ignores ineligible lodgings", () => {
    const places = [makePlace({ id: "x", is_partner: false }), makePlace({ id: "y", booking_whatsapp: null, booking_url: null })];
    expect(selectLodging(places, { budget: "medio" }, [], noShuffle)).toBeNull();
  });

  it("rotates partners with the random source", () => {
    const places = [makePlace({ id: "a" }), makePlace({ id: "b" })];
    expect(selectLodging(places, { budget: "medio" }, [], () => 0)?.featured_id).toBe("b");
  });
});
