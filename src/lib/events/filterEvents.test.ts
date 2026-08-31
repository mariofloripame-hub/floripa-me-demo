import { describe, it, expect } from "vitest";
import { isEventActiveInMonth, filterEventsForTraveler } from "./filterEvents";
import type { EventRow } from "@/lib/supabase/types";

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "1", name: "Evento", start_month: 1, end_month: 4, location: "Jurerê",
    target_profiles: ["Todos"], is_free: "Não", active: true, notes: null,
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

describe("isEventActiveInMonth", () => {
  it("is true for a month within a normal (non-wrapping) range", () => {
    expect(isEventActiveInMonth({ start_month: 1, end_month: 4 }, 2)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 1, end_month: 4 }, 5)).toBe(false);
  });

  it("wraps around the year end when start_month > end_month", () => {
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 12)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 1)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 6)).toBe(false);
  });
});

describe("filterEventsForTraveler", () => {
  it("keeps only events active in the given month", () => {
    const events = [event({ id: "in", start_month: 1, end_month: 4 }), event({ id: "out", start_month: 7, end_month: 7 })];
    expect(filterEventsForTraveler(events, {}, 2).map((e) => e.id)).toEqual(["in"]);
  });

  it("filters by the traveler's group when target_profiles is not 'Todos'", () => {
    const events = [
      event({ id: "match", target_profiles: ["Casal"] }),
      event({ id: "no-match", target_profiles: ["Negócios"] }),
    ];
    expect(filterEventsForTraveler(events, { group: "casal" }, 2).map((e) => e.id)).toEqual(["match"]);
  });
});
