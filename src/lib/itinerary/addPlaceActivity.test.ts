import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addPlaceActivity, PlaceNotFoundError, DayNotFoundError } from "./addPlaceActivity";
import { ItineraryNotFoundError } from "./removeActivity";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "Praia extensa.", address: "Campeche",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: "ChIJ-abc", lat: -27.68, lng: -48.49, rating: 4.5, photos: ["places/abc/photos/1"],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(itinerary: unknown, placeRow: unknown) {
  let capturedDays: unknown = null;
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = (patch: { days: unknown }) => {
        capturedDays = patch.days;
        return chain;
      };
      chain.single = () => Promise.resolve({ data: { id: "1", days: capturedDays }, error: null });
      return chain;
    }
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: placeRow, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { supabase: { from } as unknown as SupabaseClient, getCapturedDays: () => capturedDays };
}

describe("addPlaceActivity", () => {
  it("adds the place as a new activity, timed 90 minutes after the day's last activity", async () => {
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "other", name: "Café", time: "09:00" }] }],
    };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await addPlaceActivity("abc123", 1, "p1", supabase);

    const days = getCapturedDays() as Array<{
      activities: Array<{ place_id: string; name: string; time: string; category: string; lat: number | null }>;
    }>;
    const added = days[0].activities.find((a) => a.place_id === "p1");
    expect(added).toMatchObject({ name: "Praia do Campeche", time: "10:30", category: "Praia", lat: -27.68 });
  });

  it("defaults to 09:00 when the day has no activities yet", async () => {
    const itinerary = { slug: "abc123", days: [{ day_number: 1, theme: "d1", activities: [] }] };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await addPlaceActivity("abc123", 1, "p1", supabase);

    const days = getCapturedDays() as Array<{ activities: Array<{ time: string }> }>;
    expect(days[0].activities[0].time).toBe("09:00");
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const { supabase } = fakeSupabase(null, place());
    await expect(addPlaceActivity("missing", 1, "p1", supabase)).rejects.toBeInstanceOf(ItineraryNotFoundError);
  });

  it("throws PlaceNotFoundError when the place doesn't exist", async () => {
    const itinerary = { slug: "abc123", days: [{ day_number: 1, theme: "d1", activities: [] }] };
    const { supabase } = fakeSupabase(itinerary, null);
    await expect(addPlaceActivity("abc123", 1, "missing", supabase)).rejects.toBeInstanceOf(PlaceNotFoundError);
  });

  it("caps time to 23:59 when the last activity is late in the evening", async () => {
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "other", name: "Jantar", time: "23:50" }] }],
    };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await addPlaceActivity("abc123", 1, "p1", supabase);

    const days = getCapturedDays() as Array<{
      activities: Array<{ place_id: string; time: string }>;
    }>;
    const added = days[0].activities.find((a) => a.place_id === "p1");
    expect(added?.time).toBe("23:59");
    // Verify the added activity is NOT before the last activity (monotonic)
    expect((added?.time || "").localeCompare("23:50")).toBeGreaterThanOrEqual(0);
  });

  it("throws DayNotFoundError when dayNumber doesn't match any day", async () => {
    const itinerary = { slug: "abc123", days: [{ day_number: 1, theme: "d1", activities: [] }] };
    const { supabase } = fakeSupabase(itinerary, place());
    await expect(addPlaceActivity("abc123", 99, "p1", supabase)).rejects.toBeInstanceOf(DayNotFoundError);
  });

  it("does not add a duplicate when the place is already in the target day's activities", async () => {
    const itinerary = {
      slug: "abc123",
      days: [
        {
          day_number: 1,
          theme: "d1",
          activities: [{ place_id: "p1", name: "Praia do Campeche", time: "09:00" }],
        },
      ],
    };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    const result = await addPlaceActivity("abc123", 1, "p1", supabase);

    // No update should have been issued to persist a duplicate.
    expect(getCapturedDays()).toBeNull();
    const resultDays = result.days as Array<{ activities: Array<{ place_id: string }> }>;
    expect(resultDays[0].activities.filter((a) => a.place_id === "p1")).toHaveLength(1);
  });
});
