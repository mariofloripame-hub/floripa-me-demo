import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getItineraryBySlug: vi.fn() }));

import { GET } from "./route";
import { getItineraryBySlug } from "@/lib/supabase/queries";

describe("GET /api/itineraries/[slug]", () => {
  it("returns the itinerary as JSON when found", async () => {
    const row = { id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z" };
    vi.mocked(getItineraryBySlug).mockResolvedValue(row);
    const response = await GET(new Request("http://localhost/api/itineraries/abc123"), { params: { slug: "abc123" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(row);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/itineraries/missing"), { params: { slug: "missing" } });
    expect(response.status).toBe(404);
  });
});
