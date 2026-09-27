import { describe, it, expect } from "vitest";
import { buildDashboard, type AppearanceRow } from "./dashboard";
import type { CourtesyCodeRow } from "@/lib/cortesia/types";

// 27 Sep 2026, 12:00 in São Paulo.
const now = new Date("2026-09-27T15:00:00Z");

function redeemed(redeemedAt: string, itineraryId: string | null = null, offer = "Sobremesa"): CourtesyCodeRow {
  return {
    id: redeemedAt, code: "FMY-AAAA", place_id: "place-a", itinerary_id: itineraryId, device_id: "d",
    offer_text: offer, created_at: redeemedAt, expires_at: redeemedAt, redeemed_at: redeemedAt, redeemed_by: "u",
  };
}

function appearance(id: string, createdAt: string, answers: Record<string, unknown> = {}): AppearanceRow {
  return { id, created_at: createdAt, quiz_answers: answers };
}

const base = { now, redeemed: [], appearances: [], visitorAnswers: {}, hasLiveOffer: true, everRedeemed: false };

describe("buildDashboard", () => {
  it("splits visits into this month and last month using São Paulo time", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [
        redeemed("2026-09-10T15:00:00Z"),
        // 02:30 UTC on Sep 1st is still Aug 31st in São Paulo → last month.
        redeemed("2026-09-01T02:30:00Z"),
        redeemed("2026-08-15T15:00:00Z"),
      ],
    });
    expect(dashboard.visitsThisMonth).toBe(1);
    expect(dashboard.visitsLastMonth).toBe(2);
  });

  it("counts visits per day from day 1 to today", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z"), redeemed("2026-09-10T18:00:00Z")],
    });
    expect(dashboard.visitsPerDay).toHaveLength(27);
    expect(dashboard.visitsPerDay[9]).toEqual({ dayKey: "2026-09-10", label: "10", count: 2 });
    expect(dashboard.visitsPerDay[0].count).toBe(0);
  });

  it("computes conversion as this month's visits over this month's appearances", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z")],
      appearances: [
        appearance("r1", "2026-09-05T12:00:00Z"),
        appearance("r2", "2026-09-06T12:00:00Z"),
        appearance("r3", "2026-09-07T12:00:00Z"),
        appearance("r4", "2026-09-08T12:00:00Z"),
        appearance("old", "2026-08-20T12:00:00Z"),
      ],
    });
    expect(dashboard.appearancesThisMonth).toBe(4);
    expect(dashboard.conversionRate).toBe(0.25);
  });

  it("has no conversion rate without appearances", () => {
    expect(buildDashboard(base).conversionRate).toBeNull();
  });

  it("profiles who actually came, from the roteiro behind each redeemed code", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [
        redeemed("2026-09-10T15:00:00Z", "r1"),
        redeemed("2026-09-11T15:00:00Z", "r2"),
        redeemed("2026-09-12T15:00:00Z", "r3"),
        redeemed("2026-09-13T15:00:00Z", null),
      ],
      visitorAnswers: { r1: { group: "casal" }, r2: { group: "casal" }, r3: { group: "familia" } },
    });
    expect(dashboard.visitorProfile).toEqual([
      { group: "casal", label: "Casal", emoji: "💑", count: 2 },
      { group: "familia", label: "Família", emoji: "👨‍👩‍👧", count: 1 },
    ]);
  });

  it("lists recent roteiros newest first, marking the ones whose code was redeemed", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-26T15:00:00Z", "r2")],
      appearances: [
        appearance("r1", "2026-09-20T12:00:00Z", { group: "solo" }),
        appearance("r2", "2026-09-27T14:46:00Z", { group: "casal", days: "3-4", style: ["gastronomia", "praia"] }),
      ],
    });
    expect(dashboard.recentRoteiros[0]).toEqual({
      id: "r2", summary: "Casal · 3 a 4 dias · Gastronomia & Praia", when: "há 14 min", redeemed: true,
    });
    expect(dashboard.recentRoteiros[1]).toMatchObject({ id: "r1", redeemed: false });
  });

  it("lists the latest visits newest first", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z", null, "A"), redeemed("2026-09-20T15:00:00Z", null, "B")],
    });
    expect(dashboard.latestVisits.map((v) => v.offerText)).toEqual(["B", "A"]);
  });

  it.each([
    [true, false, "full"],
    [true, true, "full"],
    [false, true, "banner"],
    [false, false, "upsell"],
  ] as const)("hasLiveOffer=%s everRedeemed=%s → %s", (hasLiveOffer, everRedeemed, mode) => {
    expect(buildDashboard({ ...base, hasLiveOffer, everRedeemed }).visitsMode).toBe(mode);
  });
});
