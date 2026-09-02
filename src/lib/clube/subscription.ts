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
    return JSON.parse(raw) as ClubeSubscription;
  } catch {
    return null;
  }
}

export function writeSubscription(subscription: ClubeSubscription): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscription));
}

export function redeemCoupon(subscription: ClubeSubscription, couponId: string, limit: number): ClubeSubscription {
  if (subscription.redeemedCouponIds.includes(couponId)) return subscription;
  if (subscription.redeemedCouponIds.length >= limit) return subscription;
  return { ...subscription, redeemedCouponIds: [...subscription.redeemedCouponIds, couponId] };
}
