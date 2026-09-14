import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNearbyPlaces } from "./nearbyPlaces";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(itinerary: unknown, places: unknown[]): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      return chain;
    }
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.then = (resolve: (r: { data: unknown; error: null }) => void) => resolve({ data: places, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

describe("getNearbyPlaces", () => {
  it("returns an empty array when the itinerary doesn't exist", async () => {
    const supabase = fakeSupabase(null, []);
    expect(await getNearbyPlaces("missing", supabase)).toEqual([]);
  });

  it("excludes places already used in the itinerary's days", async () => {
    const itinerary = {
      slug: "abc123",
      quiz_answers: {},
      days: [{ day_number: 1, theme: "d", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const places = [place({ id: "p1" }), place({ id: "p2", name: "Outro" })];
    const supabase = fakeSupabase(itinerary, places);

    const result = await getNearbyPlaces("abc123", supabase, 5);

    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });

  it("only returns the fields the map needs, never the raw place row (e.g. photos with the Places API key)", async () => {
    const itinerary = {
      slug: "abc123",
      quiz_answers: {},
      days: [{ day_number: 1, theme: "d", activities: [] }],
    };
    const places = [place({ id: "p1", photos: ["https://places.googleapis.com/v1/x/media?key=SECRET"] })];
    const supabase = fakeSupabase(itinerary, places);

    const result = await getNearbyPlaces("abc123", supabase, 5);

    expect(result[0]).not.toHaveProperty("photos");
    expect(Object.keys(result[0]).sort()).toEqual(["id", "lat", "lng", "name"]);
  });
});
