import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/cortesia/queries", () => ({ listRedeemedCodes: vi.fn(), hasEverRedeemed: vi.fn() }));
vi.mock("./queries", () => ({ listItinerariesWithPlace: vi.fn(), getQuizAnswersByIds: vi.fn() }));

import { loadDashboard } from "./loadDashboard";
import { listRedeemedCodes, hasEverRedeemed } from "@/lib/cortesia/queries";
import { listItinerariesWithPlace, getQuizAnswersByIds } from "./queries";

describe("loadDashboard", () => {
  it("fetches since the start of last month and feeds buildDashboard", async () => {
    const now = new Date("2026-09-27T15:00:00Z");
    vi.mocked(listRedeemedCodes).mockResolvedValue([
      { id: "c1", itinerary_id: "r1", redeemed_at: "2026-09-10T15:00:00Z", offer_text: "Sobremesa" },
      { id: "c2", itinerary_id: "r1", redeemed_at: "2026-09-11T15:00:00Z", offer_text: "Sobremesa" },
    ] as never);
    vi.mocked(listItinerariesWithPlace).mockResolvedValue([]);
    vi.mocked(hasEverRedeemed).mockResolvedValue(true);
    vi.mocked(getQuizAnswersByIds).mockResolvedValue({ r1: { group: "casal" } });

    const dashboard = await loadDashboard({} as SupabaseClient, {
      id: "place-a", is_partner: true, is_verified: true, partner_offer: null,
    } as never, now);

    const since = new Date("2026-08-01T03:00:00Z");
    expect(listRedeemedCodes).toHaveBeenCalledWith(expect.anything(), "place-a", since);
    expect(listItinerariesWithPlace).toHaveBeenCalledWith(expect.anything(), "place-a", since);
    expect(getQuizAnswersByIds).toHaveBeenCalledWith(expect.anything(), ["r1"]);
    expect(dashboard.visitsThisMonth).toBe(2);
    expect(dashboard.visitorProfile[0]).toMatchObject({ group: "casal", count: 2 });
    expect(dashboard.visitsMode).toBe("banner");
  });
});
