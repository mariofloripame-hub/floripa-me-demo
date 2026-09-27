import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), getItineraryBySlug: vi.fn() }));
vi.mock("./queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./queries")>();
  return { ...actual, findReusableCode: vi.fn(), insertCode: vi.fn() };
});

import { issueCode, NoLiveOfferError, RoteiroNotFoundError } from "./issueCode";
import { getPlaceById, getItineraryBySlug } from "@/lib/supabase/queries";
import { findReusableCode, insertCode } from "./queries";

const client = {} as SupabaseClient;
const now = new Date("2026-09-27T15:00:00Z");
const args = { placeId: "place-a", itinerarySlug: "abc123", deviceId: "device-123", now };

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset().mockResolvedValue({
    id: "place-a", is_partner: true, is_verified: true, partner_offer: "Sobremesa cortesia",
  } as never);
  vi.mocked(getItineraryBySlug).mockReset().mockResolvedValue({ id: "it-1", slug: "abc123" } as never);
  vi.mocked(findReusableCode).mockReset().mockResolvedValue(null);
  vi.mocked(insertCode).mockReset().mockImplementation(async (_c, row) => ({
    ...row, id: "c1", created_at: now.toISOString(), redeemed_at: null, redeemed_by: null,
  }));
});

describe("issueCode", () => {
  it("creates a 24h code snapshotting the live offer and the roteiro", async () => {
    const issued = await issueCode(client, { ...args, generate: () => "FMY-4K7P" });
    expect(issued).toEqual({ code: "FMY-4K7P", offerText: "Sobremesa cortesia", expiresAt: "2026-09-28T15:00:00.000Z" });
    expect(insertCode).toHaveBeenCalledWith(client, {
      code: "FMY-4K7P", place_id: "place-a", itinerary_id: "it-1", device_id: "device-123",
      offer_text: "Sobremesa cortesia", expires_at: "2026-09-28T15:00:00.000Z",
    });
  });

  it("returns the existing unused code for the same device and place", async () => {
    vi.mocked(findReusableCode).mockResolvedValue({
      code: "FMY-AAAA", offer_text: "Texto antigo", expires_at: "2026-09-28T10:00:00Z",
    } as never);
    await expect(issueCode(client, args)).resolves.toEqual({
      code: "FMY-AAAA", offerText: "Texto antigo", expiresAt: "2026-09-28T10:00:00Z",
    });
    expect(insertCode).not.toHaveBeenCalled();
  });

  it("returns the earliest active code when a concurrent request inserted one first (double tap)", async () => {
    vi.mocked(findReusableCode)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: "FMY-AAAA", offer_text: "Sobremesa cortesia", expires_at: "2026-09-28T14:59:59Z" } as never);
    const issued = await issueCode(client, { ...args, generate: () => "FMY-BBBB" });
    expect(issued.code).toBe("FMY-AAAA");
  });

  it("retries with a new code on a collision", async () => {
    const codes = ["FMY-AAAA", "FMY-BBBB"];
    vi.mocked(insertCode)
      .mockRejectedValueOnce({ code: "23505" })
      .mockImplementationOnce(async (_c, row) => ({ ...row, id: "c2", created_at: "", redeemed_at: null, redeemed_by: null }));
    const issued = await issueCode(client, { ...args, generate: () => codes.shift()! });
    expect(issued.code).toBe("FMY-BBBB");
  });

  it("rethrows errors that aren't collisions", async () => {
    vi.mocked(insertCode).mockRejectedValue(new Error("db down"));
    await expect(issueCode(client, args)).rejects.toThrow("db down");
  });

  it("refuses places without a live offer", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "place-a", is_partner: false, is_verified: true, partner_offer: "Simulada" } as never);
    await expect(issueCode(client, args)).rejects.toBeInstanceOf(NoLiveOfferError);
  });

  it("refuses an unknown roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    await expect(issueCode(client, args)).rejects.toBeInstanceOf(RoteiroNotFoundError);
  });
});
