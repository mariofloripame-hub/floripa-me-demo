import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), updatePlace: vi.fn() }));

import { POST } from "./route";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";

const params = { params: Promise.resolve({ id: "p1" }) };
function post(body: unknown) {
  return new Request("http://localhost/api/admin/places/p1/oferta", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset().mockResolvedValue({
    id: "p1", partner_offer: "Café", pending_offer: "Sobremesa", pending_offer_submitted_at: "2026-09-27T15:00:00Z",
  } as never);
  vi.mocked(updatePlace).mockReset().mockImplementation(async (_c, id, patch) => ({ id, ...patch }) as never);
});

describe("POST /api/admin/places/[id]/oferta", () => {
  it("approves: the pending text goes live", async () => {
    const response = await POST(post({ action: "aprovar" }), params);
    expect(response.status).toBe(200);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", {
      partner_offer: "Sobremesa", pending_offer: null, pending_offer_submitted_at: null,
    });
  });

  it("rejects: only pending is cleared", async () => {
    await POST(post({ action: "recusar" }), params);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", { pending_offer: null, pending_offer_submitted_at: null });
  });

  it("returns 400 for an unknown action", async () => {
    expect((await POST(post({ action: "talvez" }), params)).status).toBe(400);
  });

  it("returns 404 for a missing place", async () => {
    vi.mocked(getPlaceById).mockResolvedValue(null);
    expect((await POST(post({ action: "aprovar" }), params)).status).toBe(404);
  });

  it("returns 409 when nothing is pending (e.g. already decided in another tab)", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", pending_offer: null, pending_offer_submitted_at: null } as never);
    expect((await POST(post({ action: "aprovar" }), params)).status).toBe(409);
    expect(updatePlace).not.toHaveBeenCalled();
  });
});
