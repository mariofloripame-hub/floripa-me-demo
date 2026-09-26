import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({
  getPlaceById: vi.fn(),
  updatePlace: vi.fn(),
  deletePlace: vi.fn(),
}));

import { GET, PATCH, DELETE } from "./route";
import { getPlaceById, updatePlace, deletePlace } from "@/lib/supabase/queries";

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset();
  vi.mocked(updatePlace).mockReset();
  vi.mocked(deletePlace).mockReset();
});

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/places/p1", { method: "PATCH", body: JSON.stringify(body) }) as never;
}

describe("GET /api/admin/places/[id]", () => {
  it("returns the place when found", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", name: "JJR" } as never);
    const response = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getPlaceById).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/admin/places/[id]", () => {
  it("accepts a partial payload with only is_verified, for the quick-approve action", async () => {
    vi.mocked(updatePlace).mockResolvedValue({ id: "p1", is_verified: true } as never);
    const response = await PATCH(patchRequest({ is_verified: true }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", { is_verified: true });
  });

  it("returns 400 with field errors when a present field is invalid, without updating", async () => {
    const response = await PATCH(patchRequest({ partner_status: "vip" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(400);
    expect(updatePlace).not.toHaveBeenCalled();
  });

  it("returns 502 when the update itself fails", async () => {
    vi.mocked(updatePlace).mockRejectedValue(new Error("db down"));
    const response = await PATCH(patchRequest({ is_verified: true }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(502);
  });
});

describe("DELETE /api/admin/places/[id]", () => {
  it("deletes the place and returns ok", async () => {
    vi.mocked(deletePlace).mockResolvedValue(undefined);
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
  });

  it("returns ok even when the id doesn't match any row (idempotent delete)", async () => {
    vi.mocked(deletePlace).mockResolvedValue(undefined);
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(200);
  });

  it("returns 502 when the delete call itself fails", async () => {
    vi.mocked(deletePlace).mockRejectedValue(new Error("db down"));
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(502);
  });
});
