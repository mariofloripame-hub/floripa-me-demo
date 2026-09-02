# Clube Local — subscriber coupon portal (design)

## Purpose

Give the "Sou de Floripa" button on the homepage a destination: a page where a resident can "subscribe" to a coupon club and browse/redeem discounts at partner establishments. This is a **clickable prototype** — no real accounts, no real payment processing. It follows the same demo-data approach already used for the hero carousel, the offer ribbon, and the partner-suggestions strip: static local data, `localStorage` for state, real integration deferred to a later pass.

## Non-goals

- No real authentication (Supabase Auth) — a name+email form is enough to simulate "signing up."
- No real payment gateway — "subscribing" just writes to `localStorage`.
- No real monthly reset of redeemed coupons — the redeemed count is a running total against the plan's limit, not tied to a calendar month.
- Not backed by the `places` table — real partner data there is too sparse today (2 rows, no `partner_offer` set, one region). Revisit this once partners are actually onboarded with offers.

## Route & flow

New route: `/clube` (`src/app/clube/page.tsx`, a `"use client"` page mirroring the self-contained style of `src/app/quiz/page.tsx`). One page, three steps held in component state:

1. **`plans`** (default) — hero + the two plan cards (Local, Local+). Picking a plan moves to `signup` with the chosen plan held in state.
2. **`signup`** — name + email form. Submitting persists a subscription object to `localStorage` and moves to `portal`.
3. **`portal`** — usage bar, region filter chips, category filter chips, coupon list with redeem buttons.

On mount, if `localStorage` already has a subscription, skip straight to `portal` (same pattern as the `favorite` flag in `RoteiroView`).

The homepage's "Sou de Floripa" `<button>` ([src/app/page.tsx:138](../../../src/app/page.tsx#L138), currently inert) becomes `<Link href="/clube">`.

## Data

`src/lib/clube/coupons.ts`:

```ts
export interface ClubePlan {
  id: "local" | "local+";
  name: string;
  priceLabel: string; // "R$19,90"
  couponsPerMonth: number;
  description: string;
}

export interface Coupon {
  id: string;
  name: string;
  neighborhood: string;
  region: "Sul" | "Leste" | "Norte" | "Centro" | "Universitário";
  category: "Gastronomia" | "Passeios" | "Bares" | "Compras" | "Bem-estar";
  offer: string;
  icon: string; // emoji
}

export const PLANS: ClubePlan[];
export const COUPONS: Coupon[]; // ~8 entries inspired by the reference screenshots
```

Region and category filter chips (with counts) are derived from `COUPONS` at render time, not hardcoded — so they stay correct as the list changes.

## Subscription state

`src/lib/clube/subscription.ts`: a small helper wrapping `localStorage` under key `floripa_clube_subscription`, storing:

```ts
interface ClubeSubscription {
  planId: "local" | "local+";
  name: string;
  email: string;
  redeemedCouponIds: string[];
}
```

`redeemedCouponIds.length` vs the plan's `couponsPerMonth` drives the usage bar and the redeem-limit check. Reading/writing localStorage is wrapped so SSR (no `window`) and a first-visit (`null`) are handled the same way page.tsx already handles `favorite`/`lastSlug` reads.

## Components / reuse

- **Usage bar**: reuse `ProgressBar` (`src/components/quiz/ProgressBar.tsx`) as `<ProgressBar current={redeemed} total={plan.couponsPerMonth} />` with a "cupons usados este mês" label above it.
- **Coupon card**: new, styled like `DayCard`'s activity card (`rounded-card border border-white/10 bg-white/5 p-3`) but with an emoji-in-colored-square avatar instead of a photo (no new image assets needed) — name, region pin + neighborhood, offer as a coral pill, "+ Resgatar" button.
- **Plan card**: new, matches the reference screenshot — bordered card, price, coupons-per-month, selectable.
- **Filter chips**: new, small rounded buttons with an emoji + label + count, active state styled like the existing pill/badge patterns already used elsewhere (turquoise accent).

## Redeem behavior

Clicking "+ Resgatar" on a coupon:
- Already redeemed → no-op (button already shows "✓ Resgatado", disabled).
- Not redeemed and `redeemedCouponIds.length < plan.couponsPerMonth` → add to `redeemedCouponIds`, persist, update the usage bar.
- Not redeemed and at the limit → button disabled, labeled "Limite atingido".

## Deviation from the reference screenshots

The reference's bottom CTA ("Assine agora e libere seus cupons") doesn't make sense once the visitor is already in the portal (they're already "subscribed"). Replace it with a small upsell card: if on the Local plan, "Quer mais cupons? Assine o Local+ →"; if already on Local+, omit it entirely. Confirmed with the user.

## Testing

Component tests in `src/app/clube/page.test.tsx` (mirroring `src/app/quiz/page.test.tsx`):
- Defaults to the `plans` step; both plan cards render.
- Picking a plan advances to `signup`.
- Submitting the signup form persists the subscription to `localStorage` and advances to `portal`.
- Remounting with an existing `localStorage` subscription skips straight to `portal`.
- Region and category filters narrow the visible coupon list.
- Redeeming a coupon increments the usage bar and persists.
- Redeeming is blocked once the plan's monthly limit is reached.
- An already-redeemed coupon shows the redeemed state instead of an active button.

Update `src/app/page.test.tsx` if it asserts anything about the "Sou de Floripa" button being a plain button.
