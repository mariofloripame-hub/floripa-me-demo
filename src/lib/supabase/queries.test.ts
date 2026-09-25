import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listPlaces,
  listEvents,
  listSosPlaces,
  listPartners,
  insertItinerary,
  getItineraryBySlug,
  updateItineraryDays,
  updatePlaceEnrichment,
  getPlaceById,
  insertPlace,
} from "./queries";

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.insert = self;
  chain.update = self;
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve: (r: typeof result) => void) => resolve(result);
  return chain;
}

function fakeClientFor(table: string, chain: unknown): SupabaseClient {
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
}

describe("queries", () => {
  it("listPlaces returns all rows from the places table", async () => {
    const rows = [{ id: "1", name: "Praia do Campeche" }];
    const client = fakeClientFor("places", makeChain({ data: rows, error: null }));
    await expect(listPlaces(client)).resolves.toEqual(rows);
    expect(client.from).toHaveBeenCalledWith("places");
  });

  it("listEvents filters to active events", async () => {
    const rows = [{ id: "1", name: "Carnaval" }];
    const client = fakeClientFor("events", makeChain({ data: rows, error: null }));
    await expect(listEvents(client)).resolves.toEqual(rows);
    expect(client.from).toHaveBeenCalledWith("events");
  });

  it("listSosPlaces returns rows for a given category", async () => {
    const rows = [{ id: "1", category: "saude" }];
    const client = fakeClientFor("sos_places", makeChain({ data: rows, error: null }));
    await expect(listSosPlaces(client, "saude")).resolves.toEqual(rows);
  });

  it("insertItinerary inserts and returns the created row", async () => {
    const row = { slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [] };
    const created = { id: "1", ...row, created_at: "2026-01-01T00:00:00Z" };
    const client = fakeClientFor("itineraries", makeChain({ data: created, error: null }));
    await expect(insertItinerary(client, row)).resolves.toEqual(created);
  });

  it("insertPlace inserts and returns the created row", async () => {
    const row = {
      region: "Sul", neighborhood: "Campeche", name: "Bar do Zé", category: "Bar / Noturno",
      target_profiles: [], price_range: "R$$" as const, point_type: "Bar", short_description: "d",
      address: "Rua X", opening_hours: null, phone: null, instagram: null, notes: null,
      google_place_id: null, lat: null, lng: null, rating: null, photos: [],
      is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
      special_needs_tags: [], is_verified: false, submission_source: "self_signup",
    };
    const created = { id: "1", ...row, created_at: "2026-01-01T00:00:00Z" };
    const client = fakeClientFor("places", makeChain({ data: created, error: null }));
    await expect(insertPlace(client, row)).resolves.toEqual(created);
  });

  it("getItineraryBySlug returns null when not found", async () => {
    const client = fakeClientFor("itineraries", makeChain({ data: null, error: null }));
    await expect(getItineraryBySlug(client, "missing")).resolves.toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const client = fakeClientFor("places", makeChain({ data: null, error: new Error("boom") }));
    await expect(listPlaces(client)).rejects.toThrow("boom");
  });

  it("updateItineraryDays updates the days column and returns the row", async () => {
    const updated = { id: "1", slug: "abc123", days: [{ day_number: 1 }] };
    const client = fakeClientFor("itineraries", makeChain({ data: updated, error: null }));
    await expect(updateItineraryDays(client, "abc123", [{ day_number: 1 }])).resolves.toEqual(updated);
  });

  it("listPartners returns all partner places, with or without an offer", async () => {
    const rows = [
      { id: "1", is_partner: true, partner_offer: "10% de desconto" },
      { id: "2", is_partner: true, partner_offer: null },
    ];
    const client = fakeClientFor("places", makeChain({ data: rows, error: null }));
    await expect(listPartners(client)).resolves.toEqual(rows);
  });

  it("updatePlaceEnrichment patches lat/lng/rating/photos/google_place_id for a place", async () => {
    const patch = { google_place_id: "ChIJ-x", lat: -27.6, lng: -48.5, rating: 4.7, photos: ["url1"] };
    const updated = { id: "1", ...patch };
    const client = fakeClientFor("places", makeChain({ data: updated, error: null }));
    await expect(updatePlaceEnrichment(client, "1", patch)).resolves.toEqual(updated);
  });

  it("getPlaceById returns the matching place, or null when not found", async () => {
    const row = { id: "p1", name: "Praia do Campeche" };
    const client = fakeClientFor("places", makeChain({ data: row, error: null }));
    await expect(getPlaceById(client, "p1")).resolves.toEqual(row);

    const missingClient = fakeClientFor("places", makeChain({ data: null, error: null }));
    await expect(getPlaceById(missingClient, "missing")).resolves.toBeNull();
  });
});
