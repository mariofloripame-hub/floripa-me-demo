import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createItinerary, NoCandidatesError } from "./createItinerary";
import type { MessagesParseClient } from "./generate";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "d", address: "end",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(placesResult: { data: unknown; error: unknown }, insertedRow: unknown): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.then = (resolve: (r: typeof placesResult) => void) => resolve(placesResult);
      return chain;
    }
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.insert = () => chain;
      chain.select = () => chain;
      chain.single = () => Promise.resolve({ data: insertedRow, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

const VALID_GENERATION = {
  welcome_message: "Oi!",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }] }],
};

function fakeAnthropic(): MessagesParseClient {
  return { messages: { parse: vi.fn().mockResolvedValue({ parsed_output: VALID_GENERATION }) } };
}

describe("createItinerary", () => {
  it("filters, ranks, generates, assembles, and persists an itinerary", async () => {
    const places = [place()];
    const insertedRow = { id: "1", slug: "abc12345", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z" };
    const supabase = fakeSupabase({ data: places, error: null }, insertedRow);

    const result = await createItinerary({ group: "solo" }, { supabase, anthropicClient: fakeAnthropic() });

    expect(result).toEqual(insertedRow);
  });

  it("throws NoCandidatesError when no places match the quiz answers", async () => {
    const supabase = fakeSupabase({ data: [], error: null }, {});
    await expect(
      createItinerary({ group: "solo" }, { supabase, anthropicClient: fakeAnthropic() }),
    ).rejects.toBeInstanceOf(NoCandidatesError);
  });
});
