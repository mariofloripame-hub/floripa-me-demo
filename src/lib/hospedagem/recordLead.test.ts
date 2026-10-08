import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/queries", () => ({ getItineraryBySlug: vi.fn(), getPlaceById: vi.fn() }));
vi.mock("./queries", () => ({ insertLodgingLead: vi.fn(), hasRecentLodgingLead: vi.fn() }));

import { recordLodgingLead, LeadNotAllowedError } from "./recordLead";
import { getItineraryBySlug, getPlaceById } from "@/lib/supabase/queries";
import { makePlace } from "./fixtures";
import { hasRecentLodgingLead, insertLodgingLead } from "./queries";

const client = {} as SupabaseClient;
const lead = { slug: "abc", place_id: "11111111-1111-4111-8111-111111111111", channel: "whatsapp" as const, check_in: "2027-01-12", check_out: "2027-01-15", guests: 2 };

beforeEach(() => {
  vi.mocked(insertLodgingLead).mockReset();
  vi.mocked(hasRecentLodgingLead).mockReset();
  vi.mocked(hasRecentLodgingLead).mockResolvedValue(false);
  vi.mocked(getPlaceById).mockReset();
  vi.mocked(getPlaceById).mockResolvedValue(null);
});

describe("recordLodgingLead", () => {
  it("inserts a lead for a lodging suggested in that roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: "x", alternative_ids: [lead.place_id] } } as never);
    await recordLodgingLead(client, lead);
    expect(insertLodgingLead).toHaveBeenCalledWith(client, {
      place_id: lead.place_id, itinerary_slug: "abc", channel: "whatsapp", check_in: "2027-01-12", check_out: "2027-01-15", guests: 2,
    });
  });

  it("accepts another partner lodging the tourist picked from the list", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: "x", alternative_ids: [] } } as never);
    vi.mocked(getPlaceById).mockResolvedValue(makePlace({ id: lead.place_id }));
    await recordLodgingLead(client, lead);
    expect(insertLodgingLead).toHaveBeenCalled();
  });

  it("rejects a place that is not a partner lodging", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: "x", alternative_ids: [] } } as never);
    vi.mocked(getPlaceById).mockResolvedValue(makePlace({ id: lead.place_id, category: "Gastronomia" }));
    await expect(recordLodgingLead(client, lead)).rejects.toBeInstanceOf(LeadNotAllowedError);
    expect(insertLodgingLead).not.toHaveBeenCalled();
  });

  it("rejects a roteiro that never had a lodging card", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: null } as never);
    vi.mocked(getPlaceById).mockResolvedValue(makePlace({ id: lead.place_id }));
    await expect(recordLodgingLead(client, lead)).rejects.toBeInstanceOf(LeadNotAllowedError);
  });

  it("rejects an unknown roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    await expect(recordLodgingLead(client, lead)).rejects.toBeInstanceOf(LeadNotAllowedError);
  });

  it("counts a repeated tap on the same lodging and channel only once", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: lead.place_id, alternative_ids: [] } } as never);
    vi.mocked(hasRecentLodgingLead).mockResolvedValue(true);
    await recordLodgingLead(client, lead);
    expect(insertLodgingLead).not.toHaveBeenCalled();
    expect(hasRecentLodgingLead).toHaveBeenCalledWith(client, { itinerary_slug: "abc", place_id: lead.place_id, channel: "whatsapp" }, expect.any(Date));
  });
});
