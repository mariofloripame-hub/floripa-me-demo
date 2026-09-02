import { describe, it, expect, beforeEach } from "vitest";
import { readSubscription, writeSubscription, redeemCoupon, clearSubscription, type ClubeSubscription } from "./subscription";

describe("readSubscription / writeSubscription", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(readSubscription()).toBeNull();
  });

  it("round-trips a subscription through localStorage", () => {
    const sub: ClubeSubscription = { planId: "local", name: "Maria", email: "maria@example.com", redeemedCouponIds: ["ostradamus"] };
    writeSubscription(sub);
    expect(readSubscription()).toEqual(sub);
  });

  it("returns null instead of throwing when the stored value is corrupted JSON", () => {
    window.localStorage.setItem("floripa_clube_subscription", "not json");
    expect(readSubscription()).toBeNull();
  });

  it("returns null when the stored value is valid JSON but the wrong shape", () => {
    window.localStorage.setItem("floripa_clube_subscription", JSON.stringify({ planId: "local" }));
    expect(readSubscription()).toBeNull();
  });

  it("removes the stored subscription so readSubscription returns null afterward", () => {
    const sub: ClubeSubscription = { planId: "local", name: "Maria", email: "maria@example.com", redeemedCouponIds: ["ostradamus"] };
    writeSubscription(sub);
    expect(readSubscription()).toEqual(sub);
    clearSubscription();
    expect(readSubscription()).toBeNull();
  });
});

describe("redeemCoupon", () => {
  const base: ClubeSubscription = { planId: "local", name: "Maria", email: "maria@example.com", redeemedCouponIds: ["a"] };

  it("adds the coupon id when under the limit and not already redeemed", () => {
    const result = redeemCoupon(base, "b", 3);
    expect(result.redeemedCouponIds).toEqual(["a", "b"]);
  });

  it("returns the same object unchanged when the coupon is already redeemed", () => {
    const result = redeemCoupon(base, "a", 3);
    expect(result).toBe(base);
  });

  it("returns the same object unchanged when the limit has been reached", () => {
    const atLimit: ClubeSubscription = { ...base, redeemedCouponIds: ["a", "b", "c"] };
    const result = redeemCoupon(atLimit, "d", 3);
    expect(result).toBe(atLimit);
  });
});
