import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listPlaces,
  listEvents,
  listSosPlaces,
  insertItinerary,
  getItineraryBySlug,
  updateItineraryDays,
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
});
