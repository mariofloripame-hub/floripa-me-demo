import { describe, it, expect, beforeEach } from "vitest";
import { getDeviceId, readCachedCode, writeCachedCode, clearCachedCode } from "./deviceStorage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("getDeviceId", () => {
  it("creates an id once and reuses it", () => {
    const first = getDeviceId();
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(getDeviceId()).toBe(first);
  });
});

describe("cached codes", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  const cached = { code: "FMY-4K7P", offerText: "Sobremesa", expiresAt: "2026-09-28T15:00:00Z", redeemedAt: null };

  it("round-trips a code per place", () => {
    writeCachedCode("place-a", cached);
    expect(readCachedCode("place-a", now)).toEqual(cached);
    expect(readCachedCode("place-b", now)).toBeNull();
  });

  it("drops an expired code", () => {
    writeCachedCode("place-a", { ...cached, expiresAt: "2026-09-27T14:00:00Z" });
    expect(readCachedCode("place-a", now)).toBeNull();
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem("floripa_cortesia_place-a", "{not json");
    expect(readCachedCode("place-a", now)).toBeNull();
  });

  it("clears a code", () => {
    writeCachedCode("place-a", cached);
    clearCachedCode("place-a");
    expect(readCachedCode("place-a", now)).toBeNull();
  });
});
