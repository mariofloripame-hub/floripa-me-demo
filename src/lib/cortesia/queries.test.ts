import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findCodeByCode,
  findReusableCode,
  insertCode,
  isUniqueViolation,
  redeemCode,
  listRedeemedCodes,
  hasEverRedeemed,
} from "./queries";

// Records every builder call so tests can assert the exact filters sent.
function fakeClient(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: [string, unknown[]][] = [];
  const resolved = { data: null, error: null, count: null, ...result };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve(resolved);
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(resolved);
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return chain;
        };
      },
    },
  );
  const client = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
  return { client, calls };
}

const now = new Date("2026-09-27T15:00:00Z");

describe("courtesy code queries", () => {
  it("findCodeByCode looks the code up in courtesy_codes", async () => {
    const { client, calls } = fakeClient({ data: { id: "c1" } });
    await expect(findCodeByCode(client, "FMY-4K7P")).resolves.toEqual({ id: "c1" });
    expect(client.from).toHaveBeenCalledWith("courtesy_codes");
    expect(calls).toContainEqual(["eq", ["code", "FMY-4K7P"]]);
  });

  it("findReusableCode only matches unredeemed, unexpired codes for the same device and place", async () => {
    const { client, calls } = fakeClient({ data: null });
    await findReusableCode(client, { deviceId: "dev-1", placeId: "place-a", now });
    expect(calls).toContainEqual(["eq", ["device_id", "dev-1"]]);
    expect(calls).toContainEqual(["eq", ["place_id", "place-a"]]);
    expect(calls).toContainEqual(["is", ["redeemed_at", null]]);
    expect(calls).toContainEqual(["gt", ["expires_at", now.toISOString()]]);
    // Oldest first, so concurrent requests all settle on the same code.
    expect(calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
  });

  it("insertCode throws the raw database error so callers can detect collisions", async () => {
    const { client } = fakeClient({ error: { code: "23505", message: "duplicate" } });
    await expect(
      insertCode(client, {
        code: "FMY-4K7P", place_id: "place-a", itinerary_id: "it-1", device_id: "dev-1",
        offer_text: "Sobremesa", expires_at: now.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("isUniqueViolation recognizes Postgres error 23505 only", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });

  it("redeemCode is a single conditional update (atomic: unredeemed, unexpired, same place)", async () => {
    const { client, calls } = fakeClient({ data: { id: "c1", redeemed_at: now.toISOString() } });
    await expect(redeemCode(client, { code: "FMY-4K7P", placeId: "place-a", userId: "user-1", now })).resolves.toMatchObject({ id: "c1" });
    expect(calls).toContainEqual(["update", [{ redeemed_at: now.toISOString(), redeemed_by: "user-1" }]]);
    expect(calls).toContainEqual(["eq", ["code", "FMY-4K7P"]]);
    expect(calls).toContainEqual(["eq", ["place_id", "place-a"]]);
    expect(calls).toContainEqual(["is", ["redeemed_at", null]]);
    expect(calls).toContainEqual(["gt", ["expires_at", now.toISOString()]]);
  });

  it("redeemCode returns null when no row matched (already used, expired or another place)", async () => {
    const { client } = fakeClient({ data: null });
    await expect(redeemCode(client, { code: "FMY-4K7P", placeId: "place-a", userId: "user-1", now })).resolves.toBeNull();
  });

  it("listRedeemedCodes returns redeemed codes since a date", async () => {
    const since = new Date("2026-08-01T03:00:00Z");
    const { client, calls } = fakeClient({ data: [{ id: "c1" }] });
    await expect(listRedeemedCodes(client, "place-a", since)).resolves.toEqual([{ id: "c1" }]);
    expect(calls).toContainEqual(["gte", ["redeemed_at", since.toISOString()]]);
  });

  it("hasEverRedeemed is true when the count is positive", async () => {
    await expect(hasEverRedeemed(fakeClient({ count: 3 }).client, "place-a")).resolves.toBe(true);
    await expect(hasEverRedeemed(fakeClient({ count: 0 }).client, "place-a")).resolves.toBe(false);
  });
});
