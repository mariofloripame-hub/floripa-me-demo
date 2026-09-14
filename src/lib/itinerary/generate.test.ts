import { describe, it, expect, vi } from "vitest";
import { generateItinerary, type MessagesParseClient } from "./generate";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const VALID_RESULT = {
  welcome_message: "Oi! Preparamos um roteiro pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "1", time: "09:00" }] }],
};

function fakeClient(parse: MessagesParseClient["messages"]["parse"]): MessagesParseClient {
  return { messages: { parse } };
}

describe("generateItinerary", () => {
  it("returns parsed_output on a successful first call", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: VALID_RESULT });
    const result = await generateItinerary([place({})], {}, fakeClient(parse));
    expect(result).toEqual(VALID_RESULT);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("retries on a retryable (429/5xx) error and succeeds on a later attempt", async () => {
    const rateLimitError = Object.assign(new Error("rate limited"), { status: 429 });
    const parse = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ parsed_output: VALID_RESULT });

    const result = await generateItinerary([place({})], {}, fakeClient(parse), 3);

    expect(result).toEqual(VALID_RESULT);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable error (e.g. 400) and rejects immediately", async () => {
    const badRequest = Object.assign(new Error("bad request"), { status: 400 });
    const parse = vi.fn().mockRejectedValue(badRequest);

    await expect(generateItinerary([place({})], {}, fakeClient(parse), 3)).rejects.toThrow("bad request");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts retryable failures", async () => {
    const serverError = Object.assign(new Error("server error"), { status: 500 });
    const parse = vi.fn().mockRejectedValue(serverError);

    await expect(generateItinerary([place({})], {}, fakeClient(parse), 2)).rejects.toThrow("server error");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("throws when the response has no parsed_output", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null });
    await expect(generateItinerary([place({})], {}, fakeClient(parse), 1)).rejects.toThrow(/parsed_output/);
  });
});
