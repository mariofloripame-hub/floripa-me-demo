import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));
vi.mock("@/lib/cortesia/queries", () => ({ findCodeByCode: vi.fn() }));

import { POST } from "./route";
import { getPartnerContext } from "@/lib/parceiro/context";
import { findCodeByCode } from "@/lib/cortesia/queries";

const ctx = { userId: "user-1", email: "carlos@box32.com", place: { id: "place-a" } };

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/validar", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPartnerContext).mockReset().mockResolvedValue(ctx as never);
  vi.mocked(findCodeByCode).mockReset();
});

describe("POST /api/parceiro/validar", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ code: "FMY-4K7P" }))).status).toBe(401);
  });

  it("checks a typed code (any case, with or without prefix) without redeeming it", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue({
      code: "FMY-4K7P", place_id: "place-a", redeemed_at: null, expires_at: "2999-01-01T00:00:00Z", offer_text: "Sobremesa",
    } as never);
    const response = await POST(post({ code: "4k7p" }));
    expect(findCodeByCode).toHaveBeenCalledWith(expect.anything(), "FMY-4K7P");
    expect(await response.json()).toEqual({
      result: { status: "valid", offerText: "Sobremesa" },
      message: "Código válido: Sobremesa",
    });
  });

  it("reports not_found for garbage without querying", async () => {
    const response = await POST(post({ code: "???" }));
    expect((await response.json()).result).toEqual({ status: "not_found" });
    expect(findCodeByCode).not.toHaveBeenCalled();
  });
});
