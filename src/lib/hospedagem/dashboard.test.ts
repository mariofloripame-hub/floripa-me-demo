import { describe, it, expect } from "vitest";
import { buildLodgingDashboard } from "./dashboard";
import type { LodgingLeadRow } from "./queries";

const now = new Date("2026-10-06T15:00:00-03:00");
function lead(created_at: string, overrides: Partial<LodgingLeadRow> = {}): LodgingLeadRow {
  return { id: created_at, place_id: "p", itinerary_slug: "s", channel: "whatsapp", check_in: null, check_out: null, guests: 2, created_at, ...overrides };
}

describe("buildLodgingDashboard", () => {
  const leads = [
    lead("2026-10-02T13:00:00Z", { check_in: "2027-01-12", check_out: "2027-01-15" }),
    lead("2026-10-05T13:00:00Z", { channel: "site" }),
    lead("2026-09-20T13:00:00Z"),
  ];
  const dashboard = buildLodgingDashboard({
    now,
    leads,
    suggestions: [{ created_at: "2026-10-01T12:00:00Z" }, { created_at: "2026-10-03T12:00:00Z" }, { created_at: "2026-09-10T12:00:00Z" }],
  });

  it("counts requests this month vs last month", () => {
    expect(dashboard.requestsThisMonth).toBe(2);
    expect(dashboard.requestsLastMonth).toBe(1);
  });

  it("splits this month's requests by channel", () => {
    expect(dashboard.whatsappThisMonth).toBe(1);
    expect(dashboard.siteThisMonth).toBe(1);
  });

  it("counts roteiros that suggested the lodging this month", () => {
    expect(dashboard.suggestedThisMonth).toBe(2);
  });

  it("has one bar per day so far this month", () => {
    expect(dashboard.requestsPerDay).toHaveLength(6);
    expect(dashboard.requestsPerDay[1].count).toBe(1);
  });

  it("lists the latest requests newest first, with the stay", () => {
    expect(dashboard.latestRequests.map((r) => r.stay)).toEqual([null, "12/01 → 15/01", null]);
  });
});
