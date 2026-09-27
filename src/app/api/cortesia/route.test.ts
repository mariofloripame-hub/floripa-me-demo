import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/cortesia/issueCode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cortesia/issueCode")>();
  return { ...actual, issueCode: vi.fn() };
});

import { POST } from "./route";
import { issueCode, NoLiveOfferError, RoteiroNotFoundError } from "@/lib/cortesia/issueCode";

const PLACE_ID = "3f1c2a9e-8b7d-4c6e-9f10-1a2b3c4d5e6f";

function post(body: unknown) {
  return new Request("http://localhost/api/cortesia", { method: "POST", body: JSON.stringify(body) });
}
const valid = { placeId: PLACE_ID, itinerarySlug: "abc123", deviceId: "device-123" };

beforeEach(() => {
  vi.mocked(issueCode).mockReset();
});

describe("POST /api/cortesia", () => {
  it("returns the issued code", async () => {
    vi.mocked(issueCode).mockResolvedValue({ code: "FMY-4K7P", offerText: "Sobremesa", expiresAt: "2026-09-28T15:00:00Z" });
    const response = await POST(post(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: "FMY-4K7P", offerText: "Sobremesa", expiresAt: "2026-09-28T15:00:00Z" });
  });

  it.each([
    ["missing deviceId", { placeId: PLACE_ID, itinerarySlug: "abc123" }],
    ["non-uuid placeId", { ...valid, placeId: "nope" }],
    ["too-short deviceId", { ...valid, deviceId: "x" }],
  ])("returns 400 for %s", async (_label, body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(issueCode).not.toHaveBeenCalled();
  });

  it("returns 409 when the place has no live offer", async () => {
    vi.mocked(issueCode).mockRejectedValue(new NoLiveOfferError());
    expect((await POST(post(valid))).status).toBe(409);
  });

  it("returns 404 for an unknown roteiro", async () => {
    vi.mocked(issueCode).mockRejectedValue(new RoteiroNotFoundError());
    expect((await POST(post(valid))).status).toBe(404);
  });

  it("returns 502 on unexpected failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(issueCode).mockRejectedValue(new Error("db down"));
    expect((await POST(post(valid))).status).toBe(502);
  });
});
