import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/itinerary/createItinerary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/createItinerary")>(
    "@/lib/itinerary/createItinerary",
  );
  return { ...actual, createItinerary: vi.fn() };
});

import { POST } from "./route";
import { createItinerary, NoCandidatesError } from "@/lib/itinerary/createItinerary";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/itineraries", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/itineraries", () => {
  it("returns 400 when answers is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 201 with the slug on success", async () => {
    vi.mocked(createItinerary).mockResolvedValue({
      id: "1", slug: "abc12345", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ slug: "abc12345" });
  });

  it("returns 422 when there are no matching candidates", async () => {
    vi.mocked(createItinerary).mockRejectedValue(new NoCandidatesError("sem lugares"));
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(422);
  });

  it("returns 502 on an unexpected generation failure", async () => {
    vi.mocked(createItinerary).mockRejectedValue(new Error("boom"));
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(502);
  });
});
