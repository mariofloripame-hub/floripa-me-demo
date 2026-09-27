import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));
vi.mock("@/lib/cortesia/queries", () => ({ findCodeByCode: vi.fn(), redeemCode: vi.fn() }));

import { POST } from "./route";
import { getPartnerContext } from "@/lib/parceiro/context";
import { findCodeByCode, redeemCode } from "@/lib/cortesia/queries";

const ctx = { userId: "user-1", email: "carlos@box32.com", place: { id: "place-a" } };

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/confirmar", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPartnerContext).mockReset().mockResolvedValue(ctx as never);
  vi.mocked(findCodeByCode).mockReset();
  vi.mocked(redeemCode).mockReset();
});

describe("POST /api/parceiro/confirmar", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ code: "FMY-4K7P" }))).status).toBe(401);
    expect(redeemCode).not.toHaveBeenCalled();
  });

  it("redeems the code for the logged-in place and user", async () => {
    vi.mocked(redeemCode).mockResolvedValue({ offer_text: "Sobremesa" } as never);
    const response = await POST(post({ code: "fmy-4k7p" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, offerText: "Sobremesa" });
    expect(redeemCode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "FMY-4K7P", placeId: "place-a", userId: "user-1" }));
  });

  it("returns 409 with the 'already used' message when a concurrent confirm won", async () => {
    vi.mocked(redeemCode).mockResolvedValue(null);
    vi.mocked(findCodeByCode).mockResolvedValue({
      place_id: "place-a", redeemed_at: "2026-09-27T16:10:00Z", expires_at: "2999-01-01T00:00:00Z", offer_text: "Sobremesa",
    } as never);
    const response = await POST(post({ code: "FMY-4K7P" }));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe("Este código já foi usado em 27/09 às 13h10.");
  });

  it("returns 409 not_found for a malformed code", async () => {
    const response = await POST(post({ code: "nope" }));
    expect(response.status).toBe(409);
    expect((await response.json()).result).toEqual({ status: "not_found" });
    expect(redeemCode).not.toHaveBeenCalled();
  });
});
