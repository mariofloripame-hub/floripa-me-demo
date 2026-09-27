import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ updatePlace: vi.fn() }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));

import { POST } from "./route";
import { updatePlace } from "@/lib/supabase/queries";
import { getPartnerContext } from "@/lib/parceiro/context";

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/oferta", { method: "POST", body: JSON.stringify(body) });
}

function withPlace(partner_offer: string | null) {
  vi.mocked(getPartnerContext).mockResolvedValue({ userId: "u", email: "e", place: { id: "place-a", partner_offer } } as never);
}

beforeEach(() => {
  vi.mocked(updatePlace).mockReset().mockImplementation(async (_c, _id, patch) => patch as never);
  withPlace("Café cortesia");
});

describe("POST /api/parceiro/oferta", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ text: "x" }))).status).toBe(401);
  });

  it("stores a trimmed pending offer without touching the live one", async () => {
    const response = await POST(post({ text: "  Sobremesa cortesia " }));
    expect(response.status).toBe(200);
    const patch = vi.mocked(updatePlace).mock.calls[0][2];
    expect(patch).toMatchObject({ pending_offer: "Sobremesa cortesia" });
    expect(patch).not.toHaveProperty("partner_offer");
  });

  it("accepts an empty text as a removal request when there is a live offer", async () => {
    expect((await POST(post({ text: "" }))).status).toBe(200);
    expect(vi.mocked(updatePlace).mock.calls[0][2]).toMatchObject({ pending_offer: "" });
  });

  it("rejects a removal request when there is nothing live to remove", async () => {
    withPlace(null);
    expect((await POST(post({ text: "  " }))).status).toBe(400);
  });

  it("rejects texts over 120 characters", async () => {
    expect((await POST(post({ text: "x".repeat(121) }))).status).toBe(400);
    expect(updatePlace).not.toHaveBeenCalled();
  });

  it("rejects a missing text", async () => {
    expect((await POST(post({}))).status).toBe(400);
  });
});
