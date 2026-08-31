import { describe, it, expect } from "vitest";
import { assembleDays } from "./assemble";
import type { Place } from "@/lib/supabase/types";
import type { ItineraryGeneration } from "./schema";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "Endereço X",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("assembleDays", () => {
  it("fills in full place data for each referenced place_id", () => {
    const candidates = [place({ id: "p1", name: "Praia do Campeche", is_partner: true })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const result = assembleDays(generation, candidates);
    expect(result).toEqual([
      {
        day_number: 1,
        theme: "Dia 1",
        activities: [
          {
            place_id: "p1", name: "Praia do Campeche", time: "09:00", category: "Praia",
            price_range: "Gratuito", is_partner: true, address: "Endereço X", lat: -27.6, lng: -48.5,
          },
        ],
      },
    ]);
  });

  it("drops an activity whose place_id is not among the candidates (defensive, not expected in normal use)", () => {
    const candidates = [place({ id: "p1" })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }, { place_id: "unknown", time: "12:00" }] }],
    };
    const result = assembleDays(generation, candidates);
    expect(result[0].activities).toHaveLength(1);
    expect(result[0].activities[0].place_id).toBe("p1");
  });

  it("drops a day entirely if every one of its activities referenced an unknown place_id", () => {
    const candidates = [place({ id: "p1" })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [
        { day_number: 1, theme: "Só inválido", activities: [{ place_id: "unknown", time: "09:00" }] },
        { day_number: 2, theme: "Válido", activities: [{ place_id: "p1", time: "09:00" }] },
      ],
    };
    const result = assembleDays(generation, candidates);
    expect(result).toHaveLength(1);
    expect(result[0].day_number).toBe(2);
  });
});
