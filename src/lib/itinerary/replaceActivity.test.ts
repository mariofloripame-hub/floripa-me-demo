import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceActivity } from "./replaceActivity";
import { PlaceNotFoundError, DayNotFoundError } from "./addPlaceActivity";
import { ItineraryNotFoundError } from "./removeActivity";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "new", region: "Leste", neighborhood: "Lagoa", name: "Marquês da Lagoa",
    category: "Gastronomia", target_profiles: ["Todos"], price_range: "R$$",
    point_type: "Restaurante", short_description: "Frutos do mar.", address: "Lagoa",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: "ChIJ-xyz", lat: -27.6, lng: -48.47, rating: 4.6, photos: ["places/xyz/photos/1"],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(itinerary: unknown, placeRow: unknown) {
  let capturedDays: unknown = null;
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    if (table === "itineraries") {
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = (patch: { days: unknown }) => {
        capturedDays = patch.days;
        return chain;
      };
      chain.single = () => Promise.resolve({ data: { id: "1", days: capturedDays }, error: null });
      return chain;
    }
    if (table === "places") {
      chain.maybeSingle = () => Promise.resolve({ data: placeRow, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { supabase: { from } as unknown as SupabaseClient, getCapturedDays: () => capturedDays };
}

const itinerary = {
  slug: "abc123",
  days: [
    {
      day_number: 1,
      theme: "d1",
      activities: [
        { place_id: "old", name: "Tia Jú", time: "12:30", category: "Gastronomia" },
        { place_id: "other", name: "Praia Mole", time: "15:00", category: "Praia" },
      ],
    },
  ],
};

type CapturedDays = Array<{ activities: Array<{ place_id: string; name: string; time: string; lat: number | null }> }>;

describe("replaceActivity", () => {
  it("swaps the activity for the chosen place, keeping its time slot and position", async () => {
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await replaceActivity("abc123", 1, "old", "new", supabase);

    const days = getCapturedDays() as CapturedDays;
    expect(days[0].activities.map((a) => a.place_id)).toEqual(["new", "other"]);
    expect(days[0].activities[0]).toMatchObject({ name: "Marquês da Lagoa", time: "12:30", lat: -27.6 });
  });

  it("does nothing when the chosen place is already in that day", async () => {
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place({ id: "other" }));

    const result = await replaceActivity("abc123", 1, "old", "other", supabase);

    expect(getCapturedDays()).toBeNull();
    expect(result).toBe(itinerary);
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const { supabase } = fakeSupabase(null, place());
    await expect(replaceActivity("missing", 1, "old", "new", supabase)).rejects.toBeInstanceOf(ItineraryNotFoundError);
  });

  it("throws PlaceNotFoundError when the new place doesn't exist", async () => {
    const { supabase } = fakeSupabase(itinerary, null);
    await expect(replaceActivity("abc123", 1, "old", "missing", supabase)).rejects.toBeInstanceOf(PlaceNotFoundError);
  });

  it("throws DayNotFoundError when the day doesn't exist", async () => {
    const { supabase } = fakeSupabase(itinerary, place());
    await expect(replaceActivity("abc123", 9, "old", "new", supabase)).rejects.toBeInstanceOf(DayNotFoundError);
  });
});
