import { describe, it, expect } from "vitest";
import { saoPauloParts, dayKey, formatDayMonth, formatTime, monthStart } from "./saoPaulo";

describe("saoPaulo time helpers", () => {
  // 02:30 UTC on the 27th is still 23:30 on the 26th in São Paulo (UTC-3).
  const lateNight = new Date("2026-09-27T02:30:00Z");

  it("reads calendar parts in São Paulo time, not UTC", () => {
    expect(saoPauloParts(lateNight)).toEqual({ year: 2026, month: 9, day: 26, hour: 23, minute: 30 });
  });

  it("builds a São Paulo day key", () => {
    expect(dayKey(lateNight)).toBe("2026-09-26");
  });

  it("formats day/month and time the Brazilian way", () => {
    expect(formatDayMonth(lateNight)).toBe("26/09");
    expect(formatTime(new Date("2026-09-27T16:05:00Z"))).toBe("13h05");
  });

  it("returns the first instant of the São Paulo month", () => {
    // 02:00 UTC on Oct 1st is still Sep 30th in São Paulo.
    expect(monthStart(new Date("2026-10-01T02:00:00Z")).toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("moves across the year boundary with a negative offset", () => {
    expect(monthStart(new Date("2026-01-15T12:00:00Z"), -1).toISOString()).toBe("2025-12-01T03:00:00.000Z");
  });
});
