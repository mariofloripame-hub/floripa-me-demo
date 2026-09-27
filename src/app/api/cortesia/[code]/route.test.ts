import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/cortesia/queries", () => ({ findCodeByCode: vi.fn() }));

import { GET } from "./route";
import { findCodeByCode } from "@/lib/cortesia/queries";

function get(code: string, deviceId = "device-123") {
  return GET(new Request(`http://localhost/api/cortesia/${code}?deviceId=${deviceId}`), {
    params: Promise.resolve({ code }),
  });
}

const base = { code: "FMY-4K7P", device_id: "device-123", redeemed_at: null, expires_at: "2999-01-01T00:00:00Z" };

beforeEach(() => {
  vi.mocked(findCodeByCode).mockReset();
});

describe("GET /api/cortesia/[code]", () => {
  it("reports an active code", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue(base as never);
    const response = await get("fmy-4k7p");
    expect(await response.json()).toEqual({ status: "active", expiresAt: base.expires_at });
    expect(findCodeByCode).toHaveBeenCalledWith(expect.anything(), "FMY-4K7P");
  });

  it("reports a used code with when", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue({ ...base, redeemed_at: "2026-09-27T16:10:00Z" } as never);
    expect(await (await get("FMY-4K7P")).json()).toEqual({ status: "used", redeemedAt: "2026-09-27T16:10:00Z" });
  });

  it("reports an expired code", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue({ ...base, expires_at: "2000-01-01T00:00:00Z" } as never);
    expect(await (await get("FMY-4K7P")).json()).toEqual({ status: "expired" });
  });

  it("returns 404 for another device's code, so codes can't be probed", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue(base as never);
    expect((await get("FMY-4K7P", "someone-else")).status).toBe(404);
  });

  it("returns 404 for a malformed code without querying", async () => {
    expect((await get("nope")).status).toBe(404);
    expect(findCodeByCode).not.toHaveBeenCalled();
  });
});
