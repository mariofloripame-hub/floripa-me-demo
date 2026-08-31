import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeActivity, ItineraryNotFoundError } from "./removeActivity";

function fakeSupabase(itinerary: unknown, updateResult: { data: unknown; error: unknown }): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = () => chain;
      chain.single = () => Promise.resolve(updateResult);
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

describe("removeActivity", () => {
  it("removes the matching activity from the given day and leaves other days untouched", async () => {
    const itinerary = {
      slug: "abc123",
      days: [
        { day_number: 1, theme: "d1", activities: [{ place_id: "p1", time: "09:00" }, { place_id: "p2", time: "13:00" }] },
        { day_number: 2, theme: "d2", activities: [{ place_id: "p3", time: "09:00" }] },
      ],
    };
    const updatedRow = { id: "1", slug: "abc123" };
    const supabase = fakeSupabase(itinerary, { data: updatedRow, error: null });

    const result = await removeActivity("abc123", 1, "p1", supabase);

    expect(result).toEqual(updatedRow);
  });

  it("drops the day entirely if removing the activity leaves it empty", async () => {
    let capturedDays: unknown = null;
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = (patch: { days: unknown }) => {
        capturedDays = patch.days;
        return chain;
      };
      chain.single = () => Promise.resolve({ data: { id: "1" }, error: null });
      return chain;
    });
    const supabase = { from } as unknown as SupabaseClient;

    await removeActivity("abc123", 1, "p1", supabase);

    expect(capturedDays).toEqual([]);
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const supabase = fakeSupabase(null, { data: null, error: null });
    await expect(removeActivity("missing", 1, "p1", supabase)).rejects.toBeInstanceOf(ItineraryNotFoundError);
  });
});
