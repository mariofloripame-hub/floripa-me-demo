import type { ClubePlanId } from "./coupons";

export interface ClubeSubscription {
  planId: ClubePlanId;
  name: string;
  email: string;
  redeemedCouponIds: string[];
}

const STORAGE_KEY = "floripa_clube_subscription";

export function readSubscription(): ClubeSubscription | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.redeemedCouponIds)) return null;
    return parsed as ClubeSubscription;
  } catch {
    return null;
  }
}

export function writeSubscription(subscription: ClubeSubscription): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscription));
}

export function clearSubscription(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function redeemCoupon(subscription: ClubeSubscription, couponId: string, limit: number): ClubeSubscription {
  if (subscription.redeemedCouponIds.includes(couponId)) return subscription;
  if (subscription.redeemedCouponIds.length >= limit) return subscription;
  return { ...subscription, redeemedCouponIds: [...subscription.redeemedCouponIds, couponId] };
}
