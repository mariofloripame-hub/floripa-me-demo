import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addActivity } from "./addActivity";
import { ItineraryNotFoundError } from "./removeActivity";

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

describe("addActivity", () => {
  it("appends a custom activity to the given day, sorted by time, and leaves other days untouched", async () => {
    let capturedDays: unknown = null;
    const itinerary = {
      slug: "abc123",
      days: [
        { day_number: 1, theme: "d1", activities: [{ place_id: "p1", name: "Praia", time: "09:00" }] },
        { day_number: 2, theme: "d2", activities: [{ place_id: "p2", name: "Trilha", time: "09:00" }] },
      ],
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

    await addActivity("abc123", 1, { name: "Jantar por conta própria", time: "20:00" }, supabase);

    const days = capturedDays as Array<{ day_number: number; activities: Array<{ name: string; time: string }> }>;
    expect(days[0].activities.map((a) => a.name)).toEqual(["Praia", "Jantar por conta própria"]);
    expect(days[1].activities).toEqual(itinerary.days[1].activities);
  });

  it("sorts the new activity into the correct position by time", async () => {
    let capturedDays: unknown = null;
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "p1", name: "Praia", time: "09:00" }] }],
    };
    const from = vi.fn(() => {
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

    await addActivity("abc123", 1, { name: "Café da manhã", time: "07:00" }, supabase);

    const days = capturedDays as Array<{ activities: Array<{ name: string }> }>;
    expect(days[0].activities.map((a) => a.name)).toEqual(["Café da manhã", "Praia"]);
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const supabase = fakeSupabase(null, { data: null, error: null });
    await expect(addActivity("missing", 1, { name: "X", time: "10:00" }, supabase)).rejects.toBeInstanceOf(
      ItineraryNotFoundError,
    );
  });
});
