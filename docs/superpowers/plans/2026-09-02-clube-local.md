# Clube Local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/clube`, a clickable prototype subscriber portal — pick a plan, "sign up" (name+email, no real auth), then browse and redeem demo coupons, all persisted to `localStorage`.

**Architecture:** One client page (`src/app/clube/page.tsx`) drives a 3-step flow (`plans` → `signup` → `portal`) using local component state. Static demo data (`src/lib/clube/coupons.ts`) and a small `localStorage` wrapper (`src/lib/clube/subscription.ts`) are the only "backend." Two small presentational components (`PlanCard`, `CouponCard`) are shared between the page and their own tests. The homepage's inert "Sou de Floripa" button becomes a link into this flow.

**Tech Stack:** Next.js App Router (client components), React state + `useEffect`, Tailwind (existing `graphite`/`turquoise`/`blue`/`coral`/`ink`/`ink-dim` tokens and `rounded-card`/`rounded-pill` radii), Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-02-clube-local-design.md](../specs/2026-09-02-clube-local-design.md)

## Global Constraints

- No real authentication or payment processing — everything is `localStorage`-backed, matching the spec's non-goals.
- `localStorage` key is exactly `floripa_clube_subscription`.
- Plans: Local = R$19,90/mês, 3 cupons/mês. Local+ = R$34,90/mês, 6 cupons/mês.
- Region/category filter options and their counts are derived from the coupon data at render time, never hardcoded.
- Follow existing color tokens/utilities only: `graphite`, `graphite-deep`, `turquoise`, `blue`, `coral`, `ink`, `ink-dim`, `rounded-card` (14px), `rounded-pill` (20px). Do not invent new tokens.

---

## Task 1: Coupon data and derived filter options

**Files:**
- Create: `src/lib/clube/coupons.ts`
- Test: `src/lib/clube/coupons.test.ts`

**Interfaces:**
- Produces: `ClubePlanId` (`"local" | "local+"`), `ClubePlan`, `Coupon`, `FilterOption`, `PLANS: ClubePlan[]`, `COUPONS: Coupon[]`, `regionOptions(coupons: Coupon[]): FilterOption[]`, `categoryOptions(coupons: Coupon[]): FilterOption[]`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/clube/coupons.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { COUPONS, PLANS, regionOptions, categoryOptions } from "./coupons";

describe("clube coupon data", () => {
  it("has two plans, Local and Local+, with the right prices and limits", () => {
    expect(PLANS).toEqual([
      { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" },
      { id: "local+", name: "Local+", priceLabel: "R$34,90", couponsPerMonth: 6, description: "6 cupons por mês" },
    ]);
  });

  it("has coupons with unique ids", () => {
    const ids = COUPONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COUPONS.length).toBeGreaterThan(0);
  });
});

describe("regionOptions", () => {
  it("returns one option per distinct region present in the given coupons, with a count each", () => {
    const coupons = [
      { id: "a", name: "A", neighborhood: "X", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "b", name: "B", neighborhood: "Y", region: "Sul" as const, category: "Bares" as const, offer: "o", icon: "🍹" },
      { id: "c", name: "C", neighborhood: "Z", region: "Centro" as const, category: "Compras" as const, offer: "o", icon: "🛍️" },
    ];
    const result = regionOptions(coupons);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.value === "Sul")?.count).toBe(2);
    expect(result.find((r) => r.value === "Centro")?.count).toBe(1);
  });
});

describe("categoryOptions", () => {
  it("returns one option per distinct category present in the given coupons, with a count each", () => {
    const coupons = [
      { id: "a", name: "A", neighborhood: "X", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "b", name: "B", neighborhood: "Y", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "c", name: "C", neighborhood: "Z", region: "Centro" as const, category: "Compras" as const, offer: "o", icon: "🛍️" },
    ];
    const result = categoryOptions(coupons);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.value === "Gastronomia")?.count).toBe(2);
    expect(result.find((r) => r.value === "Compras")?.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/clube/coupons.test.ts`
Expected: FAIL — `Cannot find module './coupons'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/clube/coupons.ts`:

```ts
export type ClubePlanId = "local" | "local+";

export interface ClubePlan {
  id: ClubePlanId;
  name: string;
  priceLabel: string;
  couponsPerMonth: number;
  description: string;
}

export type CouponRegion = "Sul" | "Leste" | "Norte" | "Centro" | "Universitário";
export type CouponCategory = "Gastronomia" | "Passeios" | "Bares" | "Compras" | "Bem-estar";

export interface Coupon {
  id: string;
  name: string;
  neighborhood: string;
  region: CouponRegion;
  category: CouponCategory;
  offer: string;
  icon: string;
}

export const PLANS: ClubePlan[] = [
  { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" },
  { id: "local+", name: "Local+", priceLabel: "R$34,90", couponsPerMonth: 6, description: "6 cupons por mês" },
];

export const COUPONS: Coupon[] = [
  { id: "ostradamus", name: "Ostradamus", neighborhood: "Ribeirão da Ilha", region: "Sul", category: "Gastronomia", offer: "30% off no prato principal", icon: "🦪" },
  { id: "bar-do-arantes", name: "Bar do Arantes", neighborhood: "Pântano do Sul", region: "Sul", category: "Gastronomia", offer: "Entrada grátis a cada 2 pratos", icon: "🐟" },
  { id: "surfoco", name: "Surfoco", neighborhood: "Campeche", region: "Sul", category: "Passeios", offer: "15% off na conta", icon: "🏄" },
  { id: "paradoxo-fermentacao", name: "Paradoxo de Fermentação", neighborhood: "Campeche", region: "Sul", category: "Bares", offer: "2ª cerveja por R$1", icon: "🍺" },
  { id: "via-gastronomica-coqueiros", name: "Via Gastronômica Coqueiros", neighborhood: "Continente", region: "Centro", category: "Gastronomia", offer: "Petisco cortesia", icon: "🌊" },
  { id: "shopping-iguatemi", name: "Shopping Iguatemi", neighborhood: "Santa Mônica", region: "Centro", category: "Compras", offer: "10% off em loja parceira", icon: "🛍️" },
  { id: "studio-bem-estar-trindade", name: "Studio Bem-Estar Trindade", neighborhood: "Trindade", region: "Universitário", category: "Bem-estar", offer: "1ª sessão com 30% off", icon: "🧘" },
  { id: "spa-carvoeira", name: "Spa Carvoeira", neighborhood: "Carvoeira", region: "Universitário", category: "Bem-estar", offer: "20% off em massagem", icon: "💆" },
];

export interface FilterOption {
  value: string;
  label: string;
  icon: string;
  count: number;
}

const REGION_ICONS: Record<CouponRegion, string> = {
  Sul: "🌴",
  Leste: "🌊",
  Norte: "🌴",
  Centro: "🏛️",
  Universitário: "🎓",
};

const CATEGORY_ICONS: Record<CouponCategory, string> = {
  Gastronomia: "🍽️",
  Passeios: "🎢",
  Bares: "🍹",
  Compras: "🛍️",
  "Bem-estar": "💆",
};

export function regionOptions(coupons: Coupon[]): FilterOption[] {
  const regions = [...new Set(coupons.map((c) => c.region))];
  return regions.map((region) => ({
    value: region,
    label: region,
    icon: REGION_ICONS[region],
    count: coupons.filter((c) => c.region === region).length,
  }));
}

export function categoryOptions(coupons: Coupon[]): FilterOption[] {
  const categories = [...new Set(coupons.map((c) => c.category))];
  return categories.map((category) => ({
    value: category,
    label: category,
    icon: CATEGORY_ICONS[category],
    count: coupons.filter((c) => c.category === category).length,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/clube/coupons.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clube/coupons.ts src/lib/clube/coupons.test.ts
git commit -m "Add Clube Local demo coupon/plan data with derived filter options"
```

---

## Task 2: Subscription persistence (localStorage)

**Files:**
- Create: `src/lib/clube/subscription.ts`
- Test: `src/lib/clube/subscription.test.ts`

**Interfaces:**
- Consumes: `ClubePlanId` from `./coupons` (Task 1).
- Produces: `ClubeSubscription`, `readSubscription(): ClubeSubscription | null`, `writeSubscription(subscription: ClubeSubscription): void`, `redeemCoupon(subscription: ClubeSubscription, couponId: string, limit: number): ClubeSubscription`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/clube/subscription.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { readSubscription, writeSubscription, redeemCoupon, type ClubeSubscription } from "./subscription";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/clube/subscription.test.ts`
Expected: FAIL — `Cannot find module './subscription'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/clube/subscription.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/clube/subscription.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clube/subscription.ts src/lib/clube/subscription.test.ts
git commit -m "Add localStorage-backed Clube Local subscription helpers"
```

---

## Task 3: PlanCard component

**Files:**
- Create: `src/components/clube/PlanCard.tsx`
- Test: `src/components/clube/PlanCard.test.tsx`

**Interfaces:**
- Consumes: `ClubePlan` from `@/lib/clube/coupons` (Task 1).
- Produces: `PlanCard({ plan, onSelect }: { plan: ClubePlan; onSelect: (planId: ClubePlanId) => void })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/clube/PlanCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlanCard } from "./PlanCard";
import type { ClubePlan } from "@/lib/clube/coupons";

const plan: ClubePlan = { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" };

describe("PlanCard", () => {
  it("shows the plan name, price, and description", () => {
    render(<PlanCard plan={plan} onSelect={vi.fn()} />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("R$19,90")).toBeInTheDocument();
    expect(screen.getByText("3 cupons por mês")).toBeInTheDocument();
  });

  it("calls onSelect with the plan id when clicked", () => {
    const onSelect = vi.fn();
    render(<PlanCard plan={plan} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("local");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clube/PlanCard.test.tsx`
Expected: FAIL — `Cannot find module './PlanCard'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/clube/PlanCard.tsx`:

```tsx
import type { ClubePlan, ClubePlanId } from "@/lib/clube/coupons";

export function PlanCard({ plan, onSelect }: { plan: ClubePlan; onSelect: (planId: ClubePlanId) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className="flex flex-1 flex-col items-center gap-1 rounded-card border border-white/15 bg-white/5 px-4 py-5 text-center transition-colors hover:border-turquoise/60"
    >
      <span className="font-display text-sm font-bold text-ink">{plan.name}</span>
      <span className="font-display text-2xl font-extrabold text-turquoise">
        {plan.priceLabel}
        <span className="text-xs font-medium text-ink-dim">/mês</span>
      </span>
      <span className="text-xs text-ink-dim">{plan.description}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/clube/PlanCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/clube/PlanCard.tsx src/components/clube/PlanCard.test.tsx
git commit -m "Add PlanCard component for Clube Local"
```

---

## Task 4: CouponCard component

**Files:**
- Create: `src/components/clube/CouponCard.tsx`
- Test: `src/components/clube/CouponCard.test.tsx`

**Interfaces:**
- Consumes: `Coupon` from `@/lib/clube/coupons` (Task 1).
- Produces: `CouponCard({ coupon, redeemed, limitReached, onRedeem }: { coupon: Coupon; redeemed: boolean; limitReached: boolean; onRedeem: (couponId: string) => void })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/clube/CouponCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CouponCard } from "./CouponCard";
import type { Coupon } from "@/lib/clube/coupons";

const coupon: Coupon = {
  id: "ostradamus", name: "Ostradamus", neighborhood: "Ribeirão da Ilha",
  region: "Sul", category: "Gastronomia", offer: "30% off no prato principal", icon: "🦪",
};

describe("CouponCard", () => {
  it("shows the name, neighborhood, and offer", () => {
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={false} onRedeem={vi.fn()} />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText(/ribeirão da ilha/i)).toBeInTheDocument();
    expect(screen.getByText(/30% off no prato principal/i)).toBeInTheDocument();
  });

  it("calls onRedeem with the coupon id when the active Resgatar button is clicked", () => {
    const onRedeem = vi.fn();
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={false} onRedeem={onRedeem} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Resgatar" }));
    expect(onRedeem).toHaveBeenCalledWith("ostradamus");
  });

  it("shows a disabled Resgatado state when already redeemed", () => {
    render(<CouponCard coupon={coupon} redeemed={true} limitReached={false} onRedeem={vi.fn()} />);
    expect(screen.getByRole("button", { name: "✓ Resgatado" })).toBeDisabled();
  });

  it("shows a disabled Limite atingido state when the plan limit is reached and this coupon wasn't redeemed", () => {
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={true} onRedeem={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Limite atingido" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/clube/CouponCard.test.tsx`
Expected: FAIL — `Cannot find module './CouponCard'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/clube/CouponCard.tsx`:

```tsx
import type { Coupon } from "@/lib/clube/coupons";

export function CouponCard({
  coupon,
  redeemed,
  limitReached,
  onRedeem,
}: {
  coupon: Coupon;
  redeemed: boolean;
  limitReached: boolean;
  onRedeem: (couponId: string) => void;
}) {
  const disabled = redeemed || limitReached;

  return (
    <div className="flex items-center gap-3 rounded-card border border-white/10 bg-white/5 p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl" aria-hidden>
        {coupon.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-ink">{coupon.name}</p>
        <p className="truncate text-xs text-ink-dim">📍 {coupon.neighborhood}</p>
        <span className="mt-1 inline-block rounded-pill bg-coral/15 px-2 py-0.5 text-[10px] font-bold text-coral">
          🎁 {coupon.offer}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRedeem(coupon.id)}
        className={`shrink-0 rounded-pill px-3 py-2 text-xs font-bold ${
          redeemed
            ? "bg-turquoise/20 text-turquoise"
            : limitReached
              ? "cursor-not-allowed bg-white/10 text-ink-dim"
              : "bg-ink text-graphite hover:bg-ink/80"
        }`}
      >
        {redeemed ? "✓ Resgatado" : limitReached ? "Limite atingido" : "+ Resgatar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/clube/CouponCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/clube/CouponCard.tsx src/components/clube/CouponCard.test.tsx
git commit -m "Add CouponCard component for Clube Local"
```

---

## Task 5: The `/clube` page (plans → signup → portal)

**Files:**
- Create: `src/app/clube/page.tsx`
- Test: `src/app/clube/page.test.tsx`

**Interfaces:**
- Consumes: `PLANS`, `COUPONS`, `regionOptions`, `categoryOptions`, `ClubePlanId` from `@/lib/clube/coupons` (Task 1); `ClubeSubscription`, `readSubscription`, `writeSubscription`, `redeemCoupon` from `@/lib/clube/subscription` (Task 2); `PlanCard` (Task 3); `CouponCard` (Task 4); `ProgressBar` from `@/components/quiz/ProgressBar` (existing, `{ current, total }` props).
- Produces: default-exported `ClubePage` React component at route `/clube`.

- [ ] **Step 1: Write the failing test**

Create `src/app/clube/page.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import ClubePage from "./page";

function seedSubscription(overrides: Partial<{ planId: "local" | "local+"; redeemedCouponIds: string[] }> = {}) {
  window.localStorage.setItem(
    "floripa_clube_subscription",
    JSON.stringify({
      planId: "local",
      name: "Ana",
      email: "ana@example.com",
      redeemedCouponIds: [],
      ...overrides,
    }),
  );
}

describe("ClubePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the two plans by default", () => {
    render(<ClubePage />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Local+")).toBeInTheDocument();
  });

  it("advances to the signup form after picking a plan", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByText("Local+"));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByText(/plano local\+/i)).toBeInTheDocument();
  });

  it("persists the subscription and advances to the portal on signup", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByText("Local"));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "maria@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /assinar plano local →/i }));

    expect(screen.getByText(/cupons usados este mês/i)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("floripa_clube_subscription") ?? "{}");
    expect(saved.name).toBe("Maria");
    expect(saved.email).toBe("maria@example.com");
    expect(saved.planId).toBe("local");
    expect(saved.redeemedCouponIds).toEqual([]);
  });

  it("skips straight to the portal when a subscription already exists", () => {
    seedSubscription();
    render(<ClubePage />);
    expect(screen.getByText(/cupons usados este mês/i)).toBeInTheDocument();
    expect(screen.queryByText("Local+")).not.toBeInTheDocument();
  });

  it("filters the coupon list by region and by category", () => {
    seedSubscription();
    render(<ClubePage />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Centro"));
    expect(screen.queryByText("Ostradamus")).not.toBeInTheDocument();
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Todas"));
    fireEvent.click(screen.getByText("Compras"));
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();
    expect(screen.queryByText("Studio Bem-Estar Trindade")).not.toBeInTheDocument();
  });

  it("redeeming a coupon updates the usage bar and persists, and blocks further redemption once the limit is reached", () => {
    seedSubscription({ redeemedCouponIds: ["ostradamus", "bar-do-arantes"] });
    render(<ClubePage />);
    expect(screen.getByText(/2\/3 cupons usados/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "+ Resgatar" })[0]);

    expect(screen.getByText(/3\/3 cupons usados/i)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("floripa_clube_subscription") ?? "{}");
    expect(saved.redeemedCouponIds).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Limite atingido" }).length).toBeGreaterThan(0);
  });

  it("shows the Local+ upsell card only when subscribed to Local", () => {
    seedSubscription({ planId: "local" });
    const { unmount } = render(<ClubePage />);
    expect(screen.getByText(/quer mais cupons/i)).toBeInTheDocument();
    unmount();

    window.localStorage.clear();
    seedSubscription({ planId: "local+" });
    render(<ClubePage />);
    expect(screen.queryByText(/quer mais cupons/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/clube/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/clube/page.tsx`:

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { PlanCard } from "@/components/clube/PlanCard";
import { CouponCard } from "@/components/clube/CouponCard";
import { PLANS, COUPONS, regionOptions, categoryOptions, type ClubePlanId } from "@/lib/clube/coupons";
import { readSubscription, writeSubscription, redeemCoupon, type ClubeSubscription } from "@/lib/clube/subscription";

type Step = "plans" | "signup" | "portal";

function findPlan(planId: ClubePlanId) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0];
}

function PlansStep({ onSelectPlan }: { onSelectPlan: (planId: ClubePlanId) => void }) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <Link
        href="/"
        aria-label="Voltar"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink"
      >
        ←
      </Link>
      <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-blue/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue">
        ⭐ Para quem mora em Floripa
      </span>
      <h1 className="font-display text-3xl font-extrabold text-ink">
        Vantagens reais, todo <span className="text-turquoise">mês.</span>
      </h1>
      <p className="text-sm text-ink-dim">
        Assine o Clube Local e escolha seus cupons em restaurantes, passeios e lojas parceiras — descontos que se
        pagam na primeira visita.
      </p>
      <div className="flex gap-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
        ))}
      </div>
    </div>
  );
}

function SignupStep({
  planId,
  onSubmit,
}: {
  planId: ClubePlanId;
  onSubmit: (input: { name: string; email: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const plan = findPlan(planId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), email: email.trim() });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-extrabold text-ink">Quase lá!</h1>
      <p className="text-sm text-ink-dim">
        Plano {plan.name} · {plan.priceLabel}/mês · {plan.description}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          required
          aria-label="Nome"
          className="rounded-pill border border-white/10 bg-graphite px-4 py-3 text-sm text-ink placeholder:text-ink-dim"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          required
          aria-label="E-mail"
          className="rounded-pill border border-white/10 bg-graphite px-4 py-3 text-sm text-ink placeholder:text-ink-dim"
        />
        <button
          type="submit"
          className="rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 text-sm font-display font-extrabold text-graphite"
        >
          Assinar plano {plan.name} →
        </button>
      </form>
    </div>
  );
}

function PortalStep({
  subscription,
  onRedeem,
}: {
  subscription: ClubeSubscription;
  onRedeem: (couponId: string) => void;
}) {
  const [region, setRegion] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const plan = findPlan(subscription.planId);
  const limitReached = subscription.redeemedCouponIds.length >= plan.couponsPerMonth;

  const filtered = COUPONS.filter(
    (c) => (!region || c.region === region) && (!category || c.category === category),
  );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div>
        <p className="text-xs font-bold text-ink-dim">
          {subscription.redeemedCouponIds.length}/{plan.couponsPerMonth} cupons usados este mês
        </p>
        <ProgressBar current={subscription.redeemedCouponIds.length} total={plan.couponsPerMonth} />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-turquoise">📍 Escolha a região</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRegion(null)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
              region === null ? "border-turquoise bg-turquoise/10 text-turquoise" : "border-white/10 bg-white/5 text-ink-dim"
            }`}
          >
            <span aria-hidden>🏝️</span>
            <span>Todas</span>
            <span className="text-[10px] font-medium text-ink-dim">{COUPONS.length}</span>
          </button>
          {regionOptions(COUPONS).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRegion(opt.value)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
                region === opt.value ? "border-turquoise bg-turquoise/10 text-turquoise" : "border-white/10 bg-white/5 text-ink-dim"
              }`}
            >
              <span aria-hidden>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className="text-[10px] font-medium text-ink-dim">{opt.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-pill px-4 py-2 text-xs font-bold ${
            category === null ? "bg-ink text-graphite" : "bg-white/10 text-ink-dim"
          }`}
        >
          Tudo
        </button>
        {categoryOptions(COUPONS).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCategory(opt.value)}
            className={`shrink-0 rounded-pill px-4 py-2 text-xs font-bold ${
              category === opt.value ? "bg-ink text-graphite" : "bg-white/10 text-ink-dim"
            }`}
          >
            <span aria-hidden>{opt.icon}</span> <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((coupon) => (
          <CouponCard
            key={coupon.id}
            coupon={coupon}
            redeemed={subscription.redeemedCouponIds.includes(coupon.id)}
            limitReached={limitReached}
            onRedeem={onRedeem}
          />
        ))}
      </div>

      {subscription.planId === "local" && (
        <div className="rounded-card border border-turquoise/30 bg-turquoise/5 p-4 text-center">
          <p className="text-sm font-bold text-ink">Quer mais cupons?</p>
          <p className="mt-1 text-xs text-ink-dim">Assine o Local+ e resgate até 6 por mês.</p>
        </div>
      )}
    </div>
  );
}

export default function ClubePage() {
  const [step, setStep] = useState<Step>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<ClubePlanId>("local");
  const [subscription, setSubscription] = useState<ClubeSubscription | null>(null);

  useEffect(() => {
    const existing = readSubscription();
    if (existing) {
      setSubscription(existing);
      setStep("portal");
    }
  }, []);

  function handleSelectPlan(planId: ClubePlanId) {
    setSelectedPlanId(planId);
    setStep("signup");
  }

  function handleSignup({ name, email }: { name: string; email: string }) {
    const newSubscription: ClubeSubscription = { planId: selectedPlanId, name, email, redeemedCouponIds: [] };
    writeSubscription(newSubscription);
    setSubscription(newSubscription);
    setStep("portal");
  }

  function handleRedeem(couponId: string) {
    if (!subscription) return;
    const plan = findPlan(subscription.planId);
    const updated = redeemCoupon(subscription, couponId, plan.couponsPerMonth);
    if (updated === subscription) return;
    writeSubscription(updated);
    setSubscription(updated);
  }

  return (
    <main className="min-h-dvh bg-graphite text-ink">
      {step === "plans" && <PlansStep onSelectPlan={handleSelectPlan} />}
      {step === "signup" && <SignupStep planId={selectedPlanId} onSubmit={handleSignup} />}
      {step === "portal" && subscription && <PortalStep subscription={subscription} onRedeem={handleRedeem} />}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/clube/page.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/clube/page.tsx src/app/clube/page.test.tsx
git commit -m "Add the Clube Local portal page (plans, signup, coupon browsing)"
```

---

## Task 6: Wire up the homepage "Sou de Floripa" button

**Files:**
- Modify: `src/app/page.tsx` (the inert button, currently around line 138)
- Modify: `src/app/page.test.tsx` (add one test)

**Interfaces:**
- Consumes: the `/clube` route added in Task 5. No new exports.

- [ ] **Step 1: Write the failing test**

`src/app/page.test.tsx` currently reads exactly:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import WelcomePage from "./page";

describe("WelcomePage", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the welcome headline and a link to the quiz", () => {
    render(<WelcomePage />);
    expect(screen.getByText(/descubra/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /criar meu roteiro/i })).toHaveAttribute("href", "/quiz");
  });

  it("does not show a 'continuar' link when there is no saved itinerary", () => {
    render(<WelcomePage />);
    expect(screen.queryByText(/continuar meu último roteiro/i)).not.toBeInTheDocument();
  });

  it("shows a 'continuar' link to the last saved itinerary when one exists", () => {
    window.localStorage.setItem("floripa_last_itinerary_slug", "abc123");
    render(<WelcomePage />);
    expect(screen.getByRole("link", { name: /continuar meu último roteiro/i })).toHaveAttribute(
      "href",
      "/roteiro/abc123",
    );
  });
});
```

Add a new test inside the same `describe` block, right after the "renders the welcome headline" test:

```tsx
  it("links 'Sou de Floripa' to the Clube Local portal", () => {
    render(<WelcomePage />);
    expect(screen.getByRole("link", { name: /sou de floripa/i })).toHaveAttribute("href", "/clube");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/page.test.tsx`
Expected: FAIL — no role "link" with name matching "sou de floripa" (it's currently a `<button>`).

- [ ] **Step 3: Update the implementation**

In `src/app/page.tsx`, replace the inert button:

```tsx
            <button
              type="button"
              className="w-full rounded-pill border border-turquoise/50 bg-transparent py-2 text-center text-xs font-display font-bold text-turquoise transition hover:bg-turquoise/10 active:scale-[0.98]"
            >
              Sou de Floripa
            </button>
```

with a link to `/clube`:

```tsx
            <Link
              href="/clube"
              className="w-full rounded-pill border border-turquoise/50 bg-transparent py-2 text-center text-xs font-display font-bold text-turquoise transition hover:bg-turquoise/10 active:scale-[0.98]"
            >
              Sou de Floripa
            </Link>
```

`Link` from `next/link` is already imported in this file (used for the "Criar meu roteiro →" button right above it) — no new import needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Run the full suite and lint**

Run: `npx vitest run`
Expected: all test files pass.

Run: `npx eslint src/lib/clube src/components/clube src/app/clube src/app/page.tsx src/app/page.test.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "Link the homepage 'Sou de Floripa' button to /clube"
```

---

## Manual verification (after all tasks)

1. Start the dev server (check first whether one is already running on port 3000 before starting a second — two `next dev` processes sharing the same `.next` directory corrupt each other's build cache).
2. Open `/`, click "Sou de Floripa" → should land on `/clube` showing the two plan cards.
3. Pick a plan → signup form appears, pre-filled with nothing; submit with a name and email → portal appears with the usage bar at 0/N.
4. Click region and category filters → the coupon list narrows correctly; click "Todas"/"Tudo" to reset.
5. Redeem coupons up to the plan's limit → usage bar fills, remaining unredeemed coupons switch to "Limite atingido"; already-redeemed ones show "✓ Resgatado".
6. Refresh the page → should land straight on the portal (not the plans screen), with the same redeemed state.
7. Check `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow) and the browser console for errors, the same way prior features in this session were verified.
