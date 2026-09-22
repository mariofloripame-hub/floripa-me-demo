import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getItineraryBySlug: vi.fn() }));
vi.mock("@/lib/itinerary/removeActivity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/removeActivity")>(
    "@/lib/itinerary/removeActivity",
  );
  return { ...actual, removeActivity: vi.fn() };
});
vi.mock("@/lib/itinerary/addPlaceActivity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/addPlaceActivity")>(
    "@/lib/itinerary/addPlaceActivity",
  );
  return { ...actual, addPlaceActivity: vi.fn() };
});

import { GET, PATCH } from "./route";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";
import { addPlaceActivity, PlaceNotFoundError, DayNotFoundError } from "@/lib/itinerary/addPlaceActivity";

describe("GET /api/itineraries/[slug]", () => {
  it("returns the itinerary as JSON when found", async () => {
    const row = { id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z" };
    vi.mocked(getItineraryBySlug).mockResolvedValue(row);
    const response = await GET(new Request("http://localhost/api/itineraries/abc123"), { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(row);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/itineraries/missing"), { params: Promise.resolve({ slug: "missing" }) });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/itineraries/[slug]", () => {
  it("returns 400 when day_number or place_id is missing", async () => {
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({}) });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(400);
  });

  it("returns the updated itinerary on success", async () => {
    vi.mocked(removeActivity).mockResolvedValue({
      id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ day_number: 1, place_id: "p1" }) });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(200);
  });

  it("returns 404 when the itinerary doesn't exist", async () => {
    vi.mocked(removeActivity).mockRejectedValue(new ItineraryNotFoundError("not found"));
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ day_number: 1, place_id: "p1" }) });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns 400 when add_place_id is not a string", async () => {
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: 123 }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(400);
  });

  it("adds a place by id and returns the updated itinerary", async () => {
    vi.mocked(addPlaceActivity).mockResolvedValue({
      id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: "p1" }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(200);
    expect(addPlaceActivity).toHaveBeenCalledWith("abc123", 1, "p1", {});
  });

  it("returns 404 when the place doesn't exist", async () => {
    vi.mocked(addPlaceActivity).mockRejectedValue(new PlaceNotFoundError("not found"));
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: "missing" }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 when the day doesn't exist", async () => {
    vi.mocked(addPlaceActivity).mockRejectedValue(new DayNotFoundError("not found"));
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 99, add_place_id: "p1" }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(404);
  });
});
