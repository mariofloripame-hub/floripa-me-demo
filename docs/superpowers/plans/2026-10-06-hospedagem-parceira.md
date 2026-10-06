# Hospedagem parceira no roteiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tourists who answer "Ainda não tenho hospedagem" get a partner lodging card ("Onde ficar") at the top of their roteiro, with a WhatsApp availability request carrying their dates; each tap is recorded and shown in the lodging partner's panel.

**Architecture:** Lodgings are `places` rows with `category = 'Hospedagem'`, excluded from every activity pool. A pure `selectLodging` picks 1 featured + up to 2 alternatives at itinerary creation and stores their ids in `itineraries.lodging`. The roteiro page resolves those ids against live rows and renders a client `LodgingCard`; its buttons are plain links that fire a keepalive `POST /api/lodging-leads`. The partner panel branches to a lodging-specific dashboard.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase (postgrest-js, service-role client), zod v4, react-hook-form, Tailwind, vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-06-hospedagem-parceira-design.md`

## Global Constraints

- Category string is exactly `Hospedagem` (export it once as `LODGING_CATEGORY`; never retype the literal elsewhere).
- Quiz trigger is exactly `quiz_answers.region === "semhospedagem"`. No quiz changes.
- Tier order: `economico` → `R$`, `R$$`; `medio` (and unanswered) → `R$$`, `R$`; `alto` → `R$$$`, `R$$`. `Gratuito`/other ranges never picked.
- Max alternatives: 2. Guests stepper 1–20; defaults solo 1, casal 2, familia 3, amigos 4, otherwise 2.
- WhatsApp messages, verbatim:
  - with dates: `Olá! Encontrei vocês no Floripa.My. Vocês têm disponibilidade de {dd/MM} a {dd/MM} para {N} pessoas?`
  - without dates: `Olá! Encontrei vocês no Floripa.My. Gostaria de saber sobre disponibilidade para {N} pessoas.`
  - `1 pessoa` singular.
- UI copy, verbatim: card title `Onde ficar`; badge `Indicado pelo Floripa.My`; buttons `Consultar disponibilidade`, `Reservar pelo site`, `Ver outras opções`, `Já resolvi minha hospedagem`; fields `Entrada`, `Saída`, `Hóspedes`; admin hint `Hospedagem: R$ até 300/diária · R$$ 300–700 · R$$$ acima de 700`; panel metric `Pedidos de disponibilidade`.
- No tourist personal data stored. All DB access through `getSupabaseAdminClient()` on the server.
- **Deploy order:** migration `0006_hospedagem.sql` must be run in Supabase **before** pushing to `main` (admin PATCH sends the new columns). Never push without asking the user.
- Dev server on Windows: user runs `npm.cmd run dev`; check for a running one before starting another.
- Tests: `npm.cmd test -- <path>` (vitest run). Lint: `npm.cmd run lint`. Build: `npm.cmd run build`.

## Review Focus

1. A lodging WhatsApp typed with formatting or a leading trunk zero (`(48) 99999-0000`, `048 99999-0000`, `+55 48 99999-0000`) must become `5548999990000` — pinned in Task 5.
2. A roteiro whose featured lodging later stops being a partner (or is deleted) must promote the next alternative, or show no card — never a broken card — pinned in Task 4.
3. Creating an itinerary with no eligible lodging must not send a `lodging` key at all (so a missing column or old rows never break creation) — pinned in Task 3.
4. Check-out equal to check-in, or a check-in before today (São Paulo date), must block the buttons with an inline message — pinned in Task 5.
5. `localStorage` throwing (private mode) must still render the card and not crash on "Já resolvi" — pinned in Task 7.

---

## File Structure

New:
- `supabase/migrations/0006_hospedagem.sql` — columns + `lodging_leads` table.
- `src/lib/hospedagem/eligibility.ts` — `LODGING_CATEGORY`, `isLodging`, `isEligibleLodging`.
- `src/lib/hospedagem/fixtures.ts` — `makePlace()` test factory for hospedagem tests.
- `src/lib/hospedagem/selectLodging.ts` — pure selection at creation.
- `src/lib/hospedagem/resolveLodging.ts` — stored ids → live eligible places.
- `src/lib/hospedagem/contact.ts` — guests default, date validation, message, WhatsApp link.
- `src/lib/hospedagem/leadSchema.ts` — zod schema for a lead.
- `src/lib/hospedagem/queries.ts` — lead insert/list, suggestion list.
- `src/lib/hospedagem/recordLead.ts` — validate lead against itinerary, insert.
- `src/lib/hospedagem/dashboard.ts` — pure lodging dashboard builder.
- `src/lib/hospedagem/loadDashboard.ts` — loads data and builds it.
- `src/app/api/lodging-leads/route.ts` — POST endpoint.
- `src/components/roteiro/LodgingCard.tsx` — the "Onde ficar" card.
- `src/components/parceiro/LodgingDashboardView.tsx` — lodging partner panel.

Modified:
- `src/lib/supabase/types.ts` — `Place.booking_*`, `LodgingSelection`, `ItineraryRow.lodging`.
- `src/lib/itinerary/mapIcons.ts` — `Hospedagem` style (adds it to `CATEGORY_OPTIONS`).
- `src/lib/itinerary/filterCandidates.ts`, `src/lib/itinerary/simulatedPartners.ts` — exclude lodgings; export `stripContactInfo`.
- `src/lib/itinerary/createItinerary.ts` — compute and persist `lodging`.
- `src/app/roteiro/[slug]/page.tsx`, `src/components/roteiro/RoteiroView.tsx` — render the card.
- `src/lib/estabelecimentos/adminSchema.ts`, `src/app/api/admin/places/route.ts`, `src/app/api/admin/places/[id]/route.ts`, `src/components/admin/AdminPlaceForm.tsx` — booking fields.
- `src/lib/parceiro/dashboard.ts` (export helpers), `src/components/parceiro/DashboardView.tsx` (export `Card`, `deltaText`), `src/app/parceiro/page.tsx` — lodging branch.

---

### Task 1: Data model, category and eligibility

**Files:**
- Create: `supabase/migrations/0006_hospedagem.sql`
- Create: `src/lib/hospedagem/eligibility.ts`, `src/lib/hospedagem/fixtures.ts`
- Modify: `src/lib/supabase/types.ts`, `src/lib/itinerary/mapIcons.ts`
- Test: `src/lib/hospedagem/eligibility.test.ts`

**Interfaces:**
- Produces: `LODGING_CATEGORY: "Hospedagem"`; `isLodging(place: Pick<Place, "category">): boolean`; `isEligibleLodging(place: Place): boolean`; `interface LodgingSelection { featured_id: string; alternative_ids: string[] }` (in `src/lib/supabase/types.ts`); `Place.booking_whatsapp?: string | null`; `Place.booking_url?: string | null`; `ItineraryRow.lodging?: LodgingSelection | null`; `makePlace(overrides?: Partial<Place>): Place` (test-only).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0006_hospedagem.sql`:

```sql
-- supabase/migrations/0006_hospedagem.sql
-- Hospedagem parceira no roteiro (see docs/superpowers/specs/2026-10-06-hospedagem-parceira-design.md).

-- Lodging contact for reservations. Only meaningful for category 'Hospedagem'.
alter table places add column booking_whatsapp text;
alter table places add column booking_url text;

-- Lodging picked at itinerary creation: {"featured_id": uuid, "alternative_ids": [uuid]}.
-- Null = no lodging card (old itineraries, other quiz answers, no eligible partner).
alter table itineraries add column lodging jsonb;

create index itineraries_lodging_featured_idx on itineraries ((lodging->>'featured_id'));

-- One row per tap on "Consultar disponibilidade" / "Reservar pelo site".
-- No tourist personal data.
create table lodging_leads (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  itinerary_slug text not null,
  channel text not null check (channel in ('whatsapp', 'site')),
  check_in date,
  check_out date,
  guests int,
  created_at timestamptz not null default now()
);

create index lodging_leads_place_created_idx on lodging_leads (place_id, created_at);

-- Same hardening as 0002: no policies, so only the service-role client can touch it.
alter table lodging_leads enable row level security;
```

- [ ] **Step 2: Extend the types**

In `src/lib/supabase/types.ts`, add to `Place` (after `pending_offer_submitted_at`):

```ts
  booking_whatsapp?: string | null;
  booking_url?: string | null;
```

Add above `ItineraryRow`:

```ts
export interface LodgingSelection {
  featured_id: string;
  alternative_ids: string[];
}
```

and add to `ItineraryRow` (after `days`):

```ts
  lodging?: LodgingSelection | null;
```

- [ ] **Step 3: Add the map/category style**

In `src/lib/itinerary/mapIcons.ts`, add as the last entry of `CATEGORY_STYLES`:

```ts
  Hospedagem: { color: COLORS.turquoiseDeep, path: "M3 19V7M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6M7 11.5a1.5 1.5 0 1 0 0-.01" },
```

This automatically adds `Hospedagem` to `CATEGORY_OPTIONS` (admin + public signup).

- [ ] **Step 4: Write the test factory**

`src/lib/hospedagem/fixtures.ts`:

```ts
import type { Place } from "@/lib/supabase/types";

// Test-only factory: an eligible partner lodging unless overridden.
export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "lodge-1", region: "Norte", neighborhood: "Jurerê", name: "Pousada Teste",
    category: "Hospedagem", target_profiles: [], price_range: "R$$",
    point_type: "Pousada", short_description: "Pousada de teste", address: "Rua A, 1",
    opening_hours: null, phone: "48999990000", instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: 4.7, photos: [],
    is_partner: true, partner_plan: null, partner_offer: null, partner_status: "pago",
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    booking_whatsapp: "48999990000", booking_url: null,
    ...overrides,
  };
}
```

- [ ] **Step 5: Write the failing test**

`src/lib/hospedagem/eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isEligibleLodging, isLodging, LODGING_CATEGORY } from "./eligibility";
import { makePlace } from "./fixtures";
import { CATEGORY_OPTIONS } from "@/lib/estabelecimentos/schema";

describe("eligibility", () => {
  it("offers Hospedagem as a category", () => {
    expect(CATEGORY_OPTIONS).toContain(LODGING_CATEGORY);
  });

  it("recognizes lodgings by category", () => {
    expect(isLodging({ category: "Hospedagem" })).toBe(true);
    expect(isLodging({ category: "Gastronomia" })).toBe(false);
  });

  it("accepts a verified partner lodging with WhatsApp", () => {
    expect(isEligibleLodging(makePlace())).toBe(true);
  });

  it("accepts a lodging with only a booking link", () => {
    expect(isEligibleLodging(makePlace({ booking_whatsapp: null, booking_url: "https://x.com" }))).toBe(true);
  });

  it.each([
    ["not a partner", { is_partner: false }],
    ["not verified", { is_verified: false }],
    ["not a lodging", { category: "Gastronomia" }],
    ["no contact", { booking_whatsapp: "  ", booking_url: null }],
  ])("rejects a lodging that is %s", (_label, overrides) => {
    expect(isEligibleLodging(makePlace(overrides))).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm.cmd test -- src/lib/hospedagem/eligibility.test.ts`
Expected: FAIL — cannot resolve `./eligibility`.

- [ ] **Step 7: Implement**

`src/lib/hospedagem/eligibility.ts`:

```ts
import type { Place } from "@/lib/supabase/types";

export const LODGING_CATEGORY = "Hospedagem";

export function isLodging(place: Pick<Place, "category">): boolean {
  return place.category === LODGING_CATEGORY;
}

// A lodging can be suggested only if it pays (partner), was approved, and the
// tourist has some way to reach it.
export function isEligibleLodging(place: Place): boolean {
  const hasContact = Boolean(place.booking_whatsapp?.trim() || place.booking_url?.trim());
  return isLodging(place) && place.is_partner && place.is_verified && hasContact;
}
```

- [ ] **Step 8: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem src/lib/itinerary/mapIcons.test.ts src/lib/estabelecimentos`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0006_hospedagem.sql src/lib/supabase/types.ts src/lib/itinerary/mapIcons.ts src/lib/hospedagem
git commit -m "feat(hospedagem): data model, Hospedagem category and lodging eligibility"
```

---

### Task 2: Keep lodgings out of every activity pool

**Files:**
- Modify: `src/lib/itinerary/filterCandidates.ts`, `src/lib/itinerary/simulatedPartners.ts`
- Test: `src/lib/itinerary/filterCandidates.test.ts`, `src/lib/itinerary/simulatedPartners.test.ts`

**Interfaces:**
- Consumes: `isLodging` (Task 1).
- Produces: `stripContactInfo(p: Place): Place` exported from `simulatedPartners.ts`. `filterCandidates`, `selectPartners`, `selectPublicPlaces` never return lodgings (this covers LLM candidates, the map's nearby places, the swap/add sheet catalogue and the partners section).

- [ ] **Step 1: Write the failing tests**

Append inside `describe("filterCandidates", ...)` in `filterCandidates.test.ts`:

```ts
  it("never offers a lodging as an activity", () => {
    const places = [place({ id: "a" }), place({ id: "h", category: "Hospedagem", price_range: "R$" })];
    expect(filterCandidates(places, {}).map((p) => p.id)).toEqual(["a"]);
  });
```

Append at the end of `simulatedPartners.test.ts`:

```ts
describe("lodgings", () => {
  it("are left out of the partners section and the swap catalogue", () => {
    const places = [
      place({ id: "r", name: "Ostradamus", is_partner: true }),
      place({ id: "h", name: "Pousada X", category: "Hospedagem", is_partner: true }),
    ];
    expect(selectPartners(places).map((p) => p.id)).toEqual(["r"]);
    expect(selectPublicPlaces(places).map((p) => p.id)).toEqual(["r"]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm.cmd test -- src/lib/itinerary/filterCandidates.test.ts src/lib/itinerary/simulatedPartners.test.ts`
Expected: FAIL — `h` is included.

- [ ] **Step 3: Implement**

`filterCandidates.ts`: import `import { isLodging } from "@/lib/hospedagem/eligibility";` and change the final return to:

```ts
    return place.is_verified && !isLodging(place) && profileOk && priceOk && styleOk;
```

`simulatedPartners.ts`: import `isLodging`, change `function stripContactInfo` to `export function stripContactInfo`, add `.filter((p) => !isLodging(p))` as the second filter in `selectPartners`, and make `selectPublicPlaces`:

```ts
// Lodgings are never activities — they only appear in the "Onde ficar" card.
export function selectPublicPlaces(places: Place[]): Place[] {
  return places.filter((p) => p.is_verified && !isLodging(p)).map(stripContactInfo);
}
```

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- src/lib/itinerary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/filterCandidates.ts src/lib/itinerary/filterCandidates.test.ts src/lib/itinerary/simulatedPartners.ts src/lib/itinerary/simulatedPartners.test.ts
git commit -m "feat(hospedagem): keep lodgings out of activity, partner and swap lists"
```

---

### Task 3: Pick the lodging when the itinerary is created

**Files:**
- Create: `src/lib/hospedagem/selectLodging.ts`
- Modify: `src/lib/itinerary/createItinerary.ts`
- Test: `src/lib/hospedagem/selectLodging.test.ts`, `src/lib/itinerary/createItinerary.test.ts`

**Interfaces:**
- Consumes: `isEligibleLodging`, `LodgingSelection`, `ItineraryDay` (`src/lib/itinerary/assemble.ts`), `QuizAnswers`.
- Produces: `selectLodging(places: Place[], answers: QuizAnswers, days: ItineraryDay[], random?: () => number): LodgingSelection | null`; `MAX_LODGING_ALTERNATIVES = 2`. `createItinerary` sends `lodging` to `insertItinerary` only when non-null.

- [ ] **Step 1: Write the failing tests**

`src/lib/hospedagem/selectLodging.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectLodging } from "./selectLodging";
import { makePlace } from "./fixtures";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

const noShuffle = () => 0.999999; // Fisher-Yates with this keeps the input order

function activity(place_id: string) {
  return { place_id, name: place_id, time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null };
}
function daysWith(...ids: string[]): ItineraryDay[] {
  return [{ day_number: 1, theme: "Dia 1", activities: ids.map(activity) }];
}
const beachNorte = makePlace({ id: "b-norte", category: "Praia", region: "Norte", is_partner: false });
const beachSul = makePlace({ id: "b-sul", category: "Praia", region: "Sul", is_partner: false });

describe("selectLodging", () => {
  it.each([
    ["economico", "R$"],
    ["medio", "R$$"],
    ["alto", "R$$$"],
  ] as const)("prefers the %s tier", (budget, tier) => {
    const places = [
      makePlace({ id: "cheap", price_range: "R$" }),
      makePlace({ id: "mid", price_range: "R$$" }),
      makePlace({ id: "lux", price_range: "R$$$" }),
    ];
    const chosen = places.find((p) => p.price_range === tier)!.id;
    expect(selectLodging(places, { budget }, [], noShuffle)?.featured_id).toBe(chosen);
  });

  it("treats an unanswered budget as médio", () => {
    const places = [makePlace({ id: "cheap", price_range: "R$" }), makePlace({ id: "mid", price_range: "R$$" })];
    expect(selectLodging(places, {}, [], noShuffle)?.featured_id).toBe("mid");
  });

  it("falls back to the second tier, never to other tiers", () => {
    const places = [makePlace({ id: "mid", price_range: "R$$" }), makePlace({ id: "lux", price_range: "R$$$" })];
    expect(selectLodging(places, { budget: "economico" }, [], noShuffle)).toEqual({ featured_id: "mid", alternative_ids: [] });
  });

  it("never picks Gratuito", () => {
    expect(selectLodging([makePlace({ price_range: "Gratuito" })], { budget: "economico" }, [], noShuffle)).toBeNull();
  });

  it("prefers the roteiro's dominant region within a tier", () => {
    const places = [
      beachNorte, beachSul,
      makePlace({ id: "sul", region: "Sul" }),
      makePlace({ id: "norte", region: "norte " }),
    ];
    const days = daysWith("b-norte", "b-norte", "b-sul");
    expect(selectLodging(places, { budget: "medio" }, days, noShuffle)).toEqual({ featured_id: "norte", alternative_ids: ["sul"] });
  });

  it("counts any tied region as a match", () => {
    const places = [beachNorte, beachSul, makePlace({ id: "leste", region: "Leste" }), makePlace({ id: "sul", region: "Sul" })];
    const days = daysWith("b-norte", "b-sul");
    expect(selectLodging(places, { budget: "medio" }, days, noShuffle)?.featured_id).toBe("sul");
  });

  it("orders 1st tier before 2nd tier even when the 2nd tier matches the region", () => {
    const places = [beachNorte, makePlace({ id: "mid-sul", region: "Sul" }), makePlace({ id: "cheap-norte", region: "Norte", price_range: "R$" })];
    expect(selectLodging(places, { budget: "medio" }, daysWith("b-norte"), noShuffle)).toEqual({
      featured_id: "mid-sul",
      alternative_ids: ["cheap-norte"],
    });
  });

  it("returns at most 1 featured + 2 alternatives", () => {
    const places = ["a", "b", "c", "d"].map((id) => makePlace({ id }));
    const result = selectLodging(places, { budget: "medio" }, [], noShuffle);
    expect(result).toEqual({ featured_id: "a", alternative_ids: ["b", "c"] });
  });

  it("ignores ineligible lodgings", () => {
    const places = [makePlace({ id: "x", is_partner: false }), makePlace({ id: "y", booking_whatsapp: null, booking_url: null })];
    expect(selectLodging(places, { budget: "medio" }, [], noShuffle)).toBeNull();
  });

  it("rotates partners with the random source", () => {
    const places = [makePlace({ id: "a" }), makePlace({ id: "b" })];
    expect(selectLodging(places, { budget: "medio" }, [], () => 0)?.featured_id).toBe("b");
  });
});
```

Append to `src/lib/itinerary/createItinerary.test.ts` (inside the existing `describe`), plus this helper above the `describe`:

```ts
function recordingSupabase(places: unknown[]) {
  const inserted: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    if (table === "places") {
      chain.select = () => chain;
      chain.then = (resolve: (r: unknown) => void) => resolve({ data: places, error: null });
      return chain;
    }
    chain.insert = (row: Record<string, unknown>) => { inserted.push(row); return chain; };
    chain.select = () => chain;
    chain.single = () => Promise.resolve({ data: { id: "1", ...inserted[0] }, error: null });
    return chain;
  });
  return { supabase: { from } as unknown as SupabaseClient, inserted };
}
```

```ts
  it("stores the suggested lodging when the tourist has none", async () => {
    const lodge = place({ id: "lodge", category: "Hospedagem", price_range: "R$$", is_partner: true, booking_whatsapp: "48999990000" });
    const { supabase, inserted } = recordingSupabase([place(), lodge]);
    await createItinerary({ group: "solo", region: "semhospedagem" }, { supabase, anthropicClient: fakeAnthropic() });
    expect(inserted[0].lodging).toEqual({ featured_id: "lodge", alternative_ids: [] });
  });

  it("does not send a lodging key when no lodging applies", async () => {
    const { supabase, inserted } = recordingSupabase([place()]);
    await createItinerary({ group: "solo", region: "semhospedagem" }, { supabase, anthropicClient: fakeAnthropic() });
    expect("lodging" in inserted[0]).toBe(false);
  });

  it("does not suggest lodging to tourists who already have one", async () => {
    const lodge = place({ id: "lodge", category: "Hospedagem", price_range: "R$$", is_partner: true, booking_whatsapp: "48999990000" });
    const { supabase, inserted } = recordingSupabase([place(), lodge]);
    await createItinerary({ group: "solo", region: "norte" }, { supabase, anthropicClient: fakeAnthropic() });
    expect("lodging" in inserted[0]).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm.cmd test -- src/lib/hospedagem/selectLodging.test.ts src/lib/itinerary/createItinerary.test.ts`
Expected: FAIL — module missing / `lodging` undefined.

- [ ] **Step 3: Implement `selectLodging`**

`src/lib/hospedagem/selectLodging.ts`:

```ts
import type { LodgingSelection, Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import { isEligibleLodging } from "./eligibility";

export const MAX_LODGING_ALTERNATIVES = 2;

const TIERS_BY_BUDGET: Record<string, Place["price_range"][]> = {
  economico: ["R$", "R$$"],
  medio: ["R$$", "R$"],
  alto: ["R$$$", "R$$"],
};

function normalizeRegion(region: string | null | undefined): string {
  return (region ?? "").trim().toLowerCase();
}

// Regions holding the most roteiro activities. Ties all count; empty = no preference.
function dominantRegions(places: Place[], days: ItineraryDay[]): Set<string> {
  const regionById = new Map(places.map((p) => [p.id, normalizeRegion(p.region)]));
  const counts = new Map<string, number>();
  for (const day of days) {
    for (const activity of day.activities) {
      const region = regionById.get(activity.place_id);
      if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
    }
  }
  const max = Math.max(0, ...counts.values());
  return new Set([...counts].filter(([, count]) => max > 0 && count === max).map(([region]) => region));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectLodging(
  places: Place[],
  answers: QuizAnswers,
  days: ItineraryDay[],
  random: () => number = Math.random,
): LodgingSelection | null {
  const tiers = TIERS_BY_BUDGET[answers.budget ?? "medio"] ?? TIERS_BY_BUDGET.medio;
  const preferred = dominantRegions(places, days);
  const eligible = places.filter(isEligibleLodging);

  const ordered = tiers.flatMap((tier) => {
    const inTier = eligible.filter((p) => p.price_range === tier);
    const matches = inTier.filter((p) => preferred.has(normalizeRegion(p.region)));
    const others = inTier.filter((p) => !preferred.has(normalizeRegion(p.region)));
    return [...shuffle(matches, random), ...shuffle(others, random)];
  });

  if (ordered.length === 0) return null;
  return {
    featured_id: ordered[0].id,
    alternative_ids: ordered.slice(1, 1 + MAX_LODGING_ALTERNATIVES).map((p) => p.id),
  };
}
```

Note: with `random = () => 0.999999`, `j = i` every step, so order is kept; with `() => 0` two items swap — matching the tests.

- [ ] **Step 4: Wire into `createItinerary`**

In `src/lib/itinerary/createItinerary.ts` add `import { selectLodging } from "@/lib/hospedagem/selectLodging";` and replace the `return insertItinerary(...)` block with:

```ts
  // Only tourists without lodging get a suggestion. The key is omitted (not
  // null) when there is none, so creation never depends on the column.
  const lodging = answers.region === "semhospedagem" ? selectLodging(allPlaces, answers, days) : null;

  return insertItinerary(deps.supabase, {
    slug,
    quiz_answers: answers as Record<string, unknown>,
    welcome_message: generation.welcome_message,
    days,
    ...(lodging ? { lodging } : {}),
  });
```

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem src/lib/itinerary`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hospedagem/selectLodging.ts src/lib/hospedagem/selectLodging.test.ts src/lib/itinerary/createItinerary.ts src/lib/itinerary/createItinerary.test.ts
git commit -m "feat(hospedagem): pick a partner lodging by budget and roteiro region at creation"
```

---

### Task 4: Resolve the stored lodging against live data

**Files:**
- Create: `src/lib/hospedagem/resolveLodging.ts`
- Test: `src/lib/hospedagem/resolveLodging.test.ts`

**Interfaces:**
- Consumes: `isEligibleLodging`, `LodgingSelection`.
- Produces: `resolveLodging(selection: LodgingSelection | null | undefined, places: Place[]): Place[]` — featured first, only still-eligible rows, contact info stripped.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveLodging } from "./resolveLodging";
import { makePlace } from "./fixtures";

const a = makePlace({ id: "a", contact_email: "dono@pousada.com" });
const b = makePlace({ id: "b" });
const c = makePlace({ id: "c" });
const selection = { featured_id: "a", alternative_ids: ["b", "c"] };

describe("resolveLodging", () => {
  it("returns featured first, then alternatives", () => {
    expect(resolveLodging(selection, [c, b, a]).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("promotes the next alternative when the featured one is no longer a partner", () => {
    const places = [makePlace({ id: "a", is_partner: false }), b, c];
    expect(resolveLodging(selection, places).map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("drops deleted lodgings", () => {
    expect(resolveLodging(selection, [c]).map((p) => p.id)).toEqual(["c"]);
  });

  it("returns nothing without a selection", () => {
    expect(resolveLodging(null, [a])).toEqual([]);
    expect(resolveLodging(undefined, [a])).toEqual([]);
  });

  it("never sends the owner's contact data to the browser", () => {
    expect(resolveLodging(selection, [a])[0]).not.toHaveProperty("contact_email");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm.cmd test -- src/lib/hospedagem/resolveLodging.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
import type { LodgingSelection, Place } from "@/lib/supabase/types";
import { stripContactInfo } from "@/lib/itinerary/simulatedPartners";
import { isEligibleLodging } from "./eligibility";

// The itinerary stores only ids; partners may have left or changed since.
export function resolveLodging(selection: LodgingSelection | null | undefined, places: Place[]): Place[] {
  if (!selection) return [];
  const byId = new Map(places.map((p) => [p.id, p]));
  return [selection.featured_id, ...selection.alternative_ids]
    .map((id) => byId.get(id))
    .filter((p): p is Place => Boolean(p) && isEligibleLodging(p as Place))
    .map(stripContactInfo);
}
```

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hospedagem/resolveLodging.ts src/lib/hospedagem/resolveLodging.test.ts
git commit -m "feat(hospedagem): resolve stored lodging ids against live partner data"
```

---

### Task 5: Contact helpers — guests, dates, message, WhatsApp link

**Files:**
- Create: `src/lib/hospedagem/contact.ts`
- Test: `src/lib/hospedagem/contact.test.ts`

**Interfaces:**
- Produces:
  - `defaultGuests(group: string | undefined): number`
  - `MIN_GUESTS = 1`, `MAX_GUESTS = 20`
  - `validateStay(stay: { checkIn: string; checkOut: string }, today: string): string | null` — dates `YYYY-MM-DD` or `""`.
  - `formatStayDate(isoDate: string): string` → `dd/MM`
  - `buildAvailabilityMessage(input: { checkIn: string; checkOut: string; guests: number }): string`
  - `normalizeWhatsapp(raw: string | null | undefined): string | null`
  - `whatsappLink(raw: string | null | undefined, message: string): string | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  buildAvailabilityMessage, defaultGuests, formatStayDate, normalizeWhatsapp, validateStay, whatsappLink,
} from "./contact";

describe("defaultGuests", () => {
  it.each([["solo", 1], ["casal", 2], ["familia", 3], ["amigos", 4], [undefined, 2], ["outro", 2]])(
    "%s → %i", (group, expected) => expect(defaultGuests(group)).toBe(expected),
  );
});

describe("validateStay", () => {
  const today = "2026-10-06";
  it("accepts both empty", () => expect(validateStay({ checkIn: "", checkOut: "" }, today)).toBeNull());
  it("accepts a valid stay", () => expect(validateStay({ checkIn: "2026-10-06", checkOut: "2026-10-09" }, today)).toBeNull());
  it("asks for the check-out", () => expect(validateStay({ checkIn: "2026-10-10", checkOut: "" }, today)).toBe("Preencha a data de saída"));
  it("asks for the check-in", () => expect(validateStay({ checkIn: "", checkOut: "2026-10-10" }, today)).toBe("Preencha a data de entrada"));
  it("rejects a past check-in", () =>
    expect(validateStay({ checkIn: "2026-10-05", checkOut: "2026-10-09" }, today)).toBe("A entrada não pode ser no passado"));
  it("rejects check-out on the check-in day", () =>
    expect(validateStay({ checkIn: "2026-10-09", checkOut: "2026-10-09" }, today)).toBe("A saída precisa ser depois da entrada"));
});

describe("buildAvailabilityMessage", () => {
  it("includes dates and guests", () => {
    expect(buildAvailabilityMessage({ checkIn: "2027-01-12", checkOut: "2027-01-15", guests: 2 })).toBe(
      "Olá! Encontrei vocês no Floripa.My. Vocês têm disponibilidade de 12/01 a 15/01 para 2 pessoas?",
    );
  });
  it("works without dates", () => {
    expect(buildAvailabilityMessage({ checkIn: "", checkOut: "", guests: 3 })).toBe(
      "Olá! Encontrei vocês no Floripa.My. Gostaria de saber sobre disponibilidade para 3 pessoas.",
    );
  });
  it("uses the singular for one guest", () => {
    expect(buildAvailabilityMessage({ checkIn: "", checkOut: "", guests: 1 })).toContain("para 1 pessoa.");
  });
  it("formats dates as dd/MM", () => expect(formatStayDate("2026-03-07")).toBe("07/03"));
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["(48) 99999-0000", "5548999990000"],
    ["048 99999-0000", "5548999990000"],
    ["+55 48 99999-0000", "5548999990000"],
    ["48 3333-0000", "554833330000"],
    ["", null],
    [null, null],
    ["123", null],
  ])("%s → %s", (raw, expected) => expect(normalizeWhatsapp(raw)).toBe(expected));
});

describe("whatsappLink", () => {
  it("builds an encoded wa.me link", () => {
    expect(whatsappLink("(48) 99999-0000", "Olá! 12/01?")).toBe("https://wa.me/5548999990000?text=Ol%C3%A1!%2012%2F01%3F");
  });
  it("returns null without a usable number", () => expect(whatsappLink("", "x")).toBeNull());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm.cmd test -- src/lib/hospedagem/contact.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 20;

const GUESTS_BY_GROUP: Record<string, number> = { solo: 1, casal: 2, familia: 3, amigos: 4 };

export function defaultGuests(group: string | undefined): number {
  return (group && GUESTS_BY_GROUP[group]) || 2;
}

// Dates are the `YYYY-MM-DD` strings of <input type="date">, so plain string
// comparison orders them correctly.
export function validateStay(stay: { checkIn: string; checkOut: string }, today: string): string | null {
  const { checkIn, checkOut } = stay;
  if (!checkIn && !checkOut) return null;
  if (!checkOut) return "Preencha a data de saída";
  if (!checkIn) return "Preencha a data de entrada";
  if (checkIn < today) return "A entrada não pode ser no passado";
  if (checkOut <= checkIn) return "A saída precisa ser depois da entrada";
  return null;
}

export function formatStayDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export function buildAvailabilityMessage({ checkIn, checkOut, guests }: { checkIn: string; checkOut: string; guests: number }): string {
  const people = guests === 1 ? "1 pessoa" : `${guests} pessoas`;
  const intro = "Olá! Encontrei vocês no Floripa.My.";
  if (checkIn && checkOut) {
    return `${intro} Vocês têm disponibilidade de ${formatStayDate(checkIn)} a ${formatStayDate(checkOut)} para ${people}?`;
  }
  return `${intro} Gostaria de saber sobre disponibilidade para ${people}.`;
}

// Accepts what people type in the admin: masks, a trunk "0", or +55.
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function whatsappLink(raw: string | null | undefined, message: string): string | null {
  const number = normalizeWhatsapp(raw);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem/contact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hospedagem/contact.ts src/lib/hospedagem/contact.test.ts
git commit -m "feat(hospedagem): availability message, date validation and WhatsApp link"
```

---

### Task 6: Record leads — queries, lib and API route

**Files:**
- Create: `src/lib/hospedagem/leadSchema.ts`, `src/lib/hospedagem/queries.ts`, `src/lib/hospedagem/recordLead.ts`, `src/app/api/lodging-leads/route.ts`
- Test: `src/lib/hospedagem/recordLead.test.ts`, `src/app/api/lodging-leads/route.test.ts`

**Interfaces:**
- Consumes: `getItineraryBySlug` (`src/lib/supabase/queries.ts`).
- Produces:
  - `lodgingLeadSchema` (zod) and `type LodgingLeadInput = { slug: string; place_id: string; channel: "whatsapp" | "site"; check_in: string | null; check_out: string | null; guests: number | null }`
  - `interface LodgingLeadRow { id: string; place_id: string; itinerary_slug: string; channel: "whatsapp" | "site"; check_in: string | null; check_out: string | null; guests: number | null; created_at: string }`
  - `insertLodgingLead(client, row: Omit<LodgingLeadRow, "id" | "created_at">): Promise<void>`
  - `listLodgingLeads(client, placeId: string, since: Date): Promise<LodgingLeadRow[]>`
  - `listLodgingSuggestions(client, placeId: string, since: Date): Promise<{ created_at: string }[]>`
  - `class LeadNotAllowedError extends Error`; `recordLodgingLead(client, lead: LodgingLeadInput): Promise<void>`
  - `POST /api/lodging-leads` → 201 `{ ok: true }` | 400 | 502

- [ ] **Step 1: Write the failing tests**

`src/lib/hospedagem/recordLead.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/queries", () => ({ getItineraryBySlug: vi.fn() }));
vi.mock("./queries", () => ({ insertLodgingLead: vi.fn() }));

import { recordLodgingLead, LeadNotAllowedError } from "./recordLead";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { insertLodgingLead } from "./queries";

const client = {} as SupabaseClient;
const lead = { slug: "abc", place_id: "11111111-1111-4111-8111-111111111111", channel: "whatsapp" as const, check_in: "2027-01-12", check_out: "2027-01-15", guests: 2 };

beforeEach(() => vi.mocked(insertLodgingLead).mockReset());

describe("recordLodgingLead", () => {
  it("inserts a lead for a lodging suggested in that roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: "x", alternative_ids: [lead.place_id] } } as never);
    await recordLodgingLead(client, lead);
    expect(insertLodgingLead).toHaveBeenCalledWith(client, {
      place_id: lead.place_id, itinerary_slug: "abc", channel: "whatsapp", check_in: "2027-01-12", check_out: "2027-01-15", guests: 2,
    });
  });

  it("rejects a place not suggested in that roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue({ lodging: { featured_id: "x", alternative_ids: [] } } as never);
    await expect(recordLodgingLead(client, lead)).rejects.toBeInstanceOf(LeadNotAllowedError);
    expect(insertLodgingLead).not.toHaveBeenCalled();
  });

  it("rejects an unknown roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    await expect(recordLodgingLead(client, lead)).rejects.toBeInstanceOf(LeadNotAllowedError);
  });
});
```

`src/app/api/lodging-leads/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/hospedagem/recordLead", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hospedagem/recordLead")>();
  return { ...actual, recordLodgingLead: vi.fn() };
});

import { POST } from "./route";
import { recordLodgingLead, LeadNotAllowedError } from "@/lib/hospedagem/recordLead";

const PLACE_ID = "3f1c2a9e-8b7d-4c6e-9f10-1a2b3c4d5e6f";
const valid = { slug: "abc123", place_id: PLACE_ID, channel: "whatsapp", check_in: "2027-01-12", check_out: "2027-01-15", guests: 2 };
function post(body: unknown) {
  return new Request("http://localhost/api/lodging-leads", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => vi.mocked(recordLodgingLead).mockReset());

describe("POST /api/lodging-leads", () => {
  it("records a valid lead", async () => {
    expect((await POST(post(valid))).status).toBe(201);
    expect(recordLodgingLead).toHaveBeenCalledWith({}, valid);
  });

  it("accepts a lead without dates", async () => {
    expect((await POST(post({ ...valid, check_in: null, check_out: null }))).status).toBe(201);
  });

  it.each([
    ["unknown channel", { ...valid, channel: "telefone" }],
    ["non-uuid place", { ...valid, place_id: "nope" }],
    ["check-out before check-in", { ...valid, check_out: "2027-01-10" }],
    ["only one date", { ...valid, check_out: null }],
    ["too many guests", { ...valid, guests: 21 }],
  ])("returns 400 for %s", async (_label, body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(recordLodgingLead).not.toHaveBeenCalled();
  });

  it("returns 400 when the place was not suggested in that roteiro", async () => {
    vi.mocked(recordLodgingLead).mockRejectedValue(new LeadNotAllowedError());
    expect((await POST(post(valid))).status).toBe(400);
  });

  it("returns 502 on database failure", async () => {
    vi.mocked(recordLodgingLead).mockRejectedValue(new Error("db down"));
    expect((await POST(post(valid))).status).toBe(502);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm.cmd test -- src/lib/hospedagem/recordLead.test.ts src/app/api/lodging-leads`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement the schema**

`src/lib/hospedagem/leadSchema.ts`:

```ts
import { z } from "zod";
import { MAX_GUESTS, MIN_GUESTS } from "./contact";

export const lodgingLeadSchema = z
  .object({
    slug: z.string().trim().min(1).max(100),
    place_id: z.uuid(),
    channel: z.enum(["whatsapp", "site"]),
    check_in: z.iso.date().nullable(),
    check_out: z.iso.date().nullable(),
    guests: z.number().int().min(MIN_GUESTS).max(MAX_GUESTS).nullable(),
  })
  .refine((lead) => (lead.check_in === null) === (lead.check_out === null), "Informe as duas datas ou nenhuma")
  .refine((lead) => !lead.check_in || !lead.check_out || lead.check_out > lead.check_in, "Saída depois da entrada");

export type LodgingLeadInput = z.infer<typeof lodgingLeadSchema>;
```

- [ ] **Step 4: Implement the queries**

`src/lib/hospedagem/queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LodgingLeadRow {
  id: string;
  place_id: string;
  itinerary_slug: string;
  channel: "whatsapp" | "site";
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  created_at: string;
}

export async function insertLodgingLead(
  client: SupabaseClient,
  row: Omit<LodgingLeadRow, "id" | "created_at">,
): Promise<void> {
  const { error } = await client.from("lodging_leads").insert(row);
  if (error) throw error;
}

export async function listLodgingLeads(client: SupabaseClient, placeId: string, since: Date): Promise<LodgingLeadRow[]> {
  const { data, error } = await client
    .from("lodging_leads")
    .select("*")
    .eq("place_id", placeId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data ?? []) as LodgingLeadRow[];
}

// Roteiros where the lodging was the featured suggestion.
export async function listLodgingSuggestions(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<{ created_at: string }[]> {
  const { data, error } = await client
    .from("itineraries")
    .select("created_at")
    .eq("lodging->>featured_id", placeId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data ?? []) as { created_at: string }[];
}
```

- [ ] **Step 5: Implement `recordLodgingLead`**

`src/lib/hospedagem/recordLead.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { insertLodgingLead } from "./queries";
import type { LodgingLeadInput } from "./leadSchema";

export class LeadNotAllowedError extends Error {}

// Only lodgings actually suggested in that roteiro count, so the partner
// panel can't be inflated with arbitrary ids.
export async function recordLodgingLead(client: SupabaseClient, lead: LodgingLeadInput): Promise<void> {
  const itinerary = await getItineraryBySlug(client, lead.slug);
  const lodging = itinerary?.lodging;
  const suggested = lodging ? [lodging.featured_id, ...lodging.alternative_ids] : [];
  if (!suggested.includes(lead.place_id)) throw new LeadNotAllowedError();

  await insertLodgingLead(client, {
    place_id: lead.place_id,
    itinerary_slug: lead.slug,
    channel: lead.channel,
    check_in: lead.check_in,
    check_out: lead.check_out,
    guests: lead.guests,
  });
}
```

- [ ] **Step 6: Implement the route**

`src/app/api/lodging-leads/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { lodgingLeadSchema } from "@/lib/hospedagem/leadSchema";
import { LeadNotAllowedError, recordLodgingLead } from "@/lib/hospedagem/recordLead";

export async function POST(request: Request) {
  const parsed = lodgingLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    await recordLodgingLead(getSupabaseAdminClient(), parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotAllowedError) {
      return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
    }
    console.error("Lodging lead recording failed", error);
    return NextResponse.json({ error: "Não foi possível registrar." }, { status: 502 });
  }
}
```

- [ ] **Step 7: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem src/app/api/lodging-leads`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/hospedagem/leadSchema.ts src/lib/hospedagem/queries.ts src/lib/hospedagem/recordLead.ts src/lib/hospedagem/recordLead.test.ts src/app/api/lodging-leads
git commit -m "feat(hospedagem): record availability requests per suggested lodging"
```

---

### Task 7: "Onde ficar" card in the roteiro

**Files:**
- Create: `src/components/roteiro/LodgingCard.tsx`
- Modify: `src/components/roteiro/RoteiroView.tsx`, `src/app/roteiro/[slug]/page.tsx`
- Test: `src/components/roteiro/LodgingCard.test.tsx`

**Interfaces:**
- Consumes: `resolveLodging` (Task 4); `defaultGuests`, `validateStay`, `buildAvailabilityMessage`, `whatsappLink`, `MIN_GUESTS`, `MAX_GUESTS` (Task 5); `POST /api/lodging-leads` body `LodgingLeadInput` (Task 6); `EstablishmentModal`, `placeToDetail`; `getPlaceImage`; `dayKey` from `src/lib/time/saoPaulo`.
- Produces: `LodgingCard({ slug, options, group }: { slug: string; options: Place[]; group?: string })`; `RoteiroView` gains prop `lodging?: Place[]`.

- [ ] **Step 1: Write the failing test**

`src/components/roteiro/LodgingCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LodgingCard } from "./LodgingCard";
import { makePlace } from "@/lib/hospedagem/fixtures";

vi.mock("next/image", () => ({ default: (props: { alt: string }) => <img alt={props.alt} /> }));

const featured = makePlace({ id: "11111111-1111-4111-8111-111111111111", name: "Pousada Sol", partner_offer: "10% off reservando pelo Floripa.My" });
const alt = makePlace({ id: "22222222-2222-4222-8222-222222222222", name: "Hotel Mar", booking_whatsapp: null, booking_url: "https://hotelmar.com" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00-03:00"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function whatsappButton() {
  return screen.getByRole("link", { name: "Consultar disponibilidade" });
}

describe("LodgingCard", () => {
  it("shows the featured lodging with badge and offer", () => {
    render(<LodgingCard slug="abc" options={[featured, alt]} group="casal" />);
    expect(screen.getByText("Onde ficar")).toBeInTheDocument();
    expect(screen.getByText("Pousada Sol")).toBeInTheDocument();
    expect(screen.getByText("Indicado pelo Floripa.My")).toBeInTheDocument();
    expect(screen.getByText("10% off reservando pelo Floripa.My")).toBeInTheDocument();
  });

  it("opens WhatsApp with dates and guests from the group", () => {
    render(<LodgingCard slug="abc" options={[featured]} group="casal" />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2027-01-15" } });
    expect(decodeURIComponent(whatsappButton().getAttribute("href")!)).toContain("de 12/01 a 15/01 para 2 pessoas?");
  });

  it("records the lead when the button is tapped", () => {
    render(<LodgingCard slug="abc" options={[featured]} group="solo" />);
    fireEvent.click(whatsappButton());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/lodging-leads");
    expect(init?.keepalive).toBe(true);
    expect(JSON.parse(init?.body as string)).toEqual({
      slug: "abc", place_id: featured.id, channel: "whatsapp", check_in: null, check_out: null, guests: 1,
    });
  });

  it("blocks the buttons while only one date is filled", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    expect(screen.getByText("Preencha a data de saída")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Consultar disponibilidade" })).toBeNull();
    expect(screen.getByRole("button", { name: "Consultar disponibilidade" })).toBeDisabled();
  });

  it("blocks a check-out on the check-in day", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2027-01-12" } });
    expect(screen.getByText("A saída precisa ser depois da entrada")).toBeInTheDocument();
  });

  it("limits the check-in to today in São Paulo", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.getByLabelText("Entrada")).toHaveAttribute("min", "2026-10-06");
  });

  it("swaps to an alternative, using the site link when there is no WhatsApp", () => {
    render(<LodgingCard slug="abc" options={[featured, alt]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver outras opções" }));
    fireEvent.click(screen.getByRole("button", { name: /Hotel Mar/ }));
    expect(screen.getByRole("link", { name: "Reservar pelo site" })).toHaveAttribute("href", "https://hotelmar.com");
    expect(screen.queryByRole("link", { name: "Consultar disponibilidade" })).toBeNull();
  });

  it("hides itself on 'Já resolvi minha hospedagem' and remembers it", () => {
    const { unmount } = render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.click(screen.getByRole("button", { name: "Já resolvi minha hospedagem" }));
    expect(screen.queryByText("Onde ficar")).toBeNull();
    unmount();
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.queryByText("Onde ficar")).toBeNull();
  });

  it("still renders and hides when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.getByText("Onde ficar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Já resolvi minha hospedagem" }));
    expect(screen.queryByText("Onde ficar")).toBeNull();
  });

  it("renders nothing without options", () => {
    const { container } = render(<LodgingCard slug="abc" options={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm.cmd test -- src/components/roteiro/LodgingCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the card**

`src/components/roteiro/LodgingCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Place } from "@/lib/supabase/types";
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import { dayKey } from "@/lib/time/saoPaulo";
import {
  buildAvailabilityMessage, defaultGuests, MAX_GUESTS, MIN_GUESTS, validateStay, whatsappLink,
} from "@/lib/hospedagem/contact";
import { EstablishmentModal, placeToDetail, type EstablishmentDetail } from "./EstablishmentModal";

type Channel = "whatsapp" | "site";

function hiddenKey(slug: string): string {
  return `floripa_lodging_hidden_${slug}`;
}

function readHidden(slug: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(slug)) === "1";
  } catch {
    return false;
  }
}

function writeHidden(slug: string) {
  try {
    window.localStorage.setItem(hiddenKey(slug), "1");
  } catch {
    // storage blocked (private mode) — the card just hides for this visit
  }
}

const primaryClass = "flex-1 rounded-pill bg-coral px-4 py-3 text-center text-sm font-display font-extrabold text-graphite";
const secondaryClass = "flex-1 rounded-pill border border-white/30 px-4 py-3 text-center text-sm font-bold text-ink";
const inputClass = "w-full rounded-lg border border-white/20 bg-graphite/60 px-3 py-2 text-sm text-ink";

export function LodgingCard({ slug, options, group }: { slug: string; options: Place[]; group?: string }) {
  const [hidden, setHidden] = useState(false);
  const [featuredId, setFeaturedId] = useState(options[0]?.id);
  const [showOthers, setShowOthers] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(defaultGuests(group));
  const [detail, setDetail] = useState<EstablishmentDetail | null>(null);

  useEffect(() => {
    setHidden(readHidden(slug));
  }, [slug]);

  const featured = options.find((p) => p.id === featuredId) ?? options[0];
  if (!featured || hidden) return null;

  const others = options.filter((p) => p.id !== featured.id);
  const today = dayKey(new Date());
  const stayError = validateStay({ checkIn, checkOut }, today);
  const message = buildAvailabilityMessage({ checkIn, checkOut, guests });
  const whatsappHref = whatsappLink(featured.booking_whatsapp, message);
  const siteHref = featured.booking_url?.trim() || null;

  function track(channel: Channel) {
    fetch("/api/lodging-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        slug,
        place_id: featured.id,
        channel,
        check_in: checkIn || null,
        check_out: checkOut || null,
        guests,
      }),
    }).catch(() => {
      // tracking never blocks the tourist
    });
  }

  function contactButton(label: string, href: string | null, channel: Channel, primary: boolean) {
    if (!href) return null;
    const className = primary ? primaryClass : secondaryClass;
    if (stayError) {
      return (
        <button type="button" disabled className={`${className} opacity-50`}>
          {label}
        </button>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(channel)} className={className}>
        {label}
      </a>
    );
  }

  return (
    <section className="rounded-card border-2 border-turquoise/60 bg-white/10 p-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-turquoise">🏨 Onde ficar</h2>

      <button type="button" onClick={() => setDetail(placeToDetail(featured))} className="mt-3 flex w-full gap-3 text-left">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-graphite">
          <Image src={getPlaceImage(featured.name, featured.photos[0])} alt={featured.name} fill sizes="96px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-pill bg-turquoise px-2 py-0.5 text-[10px] font-bold text-graphite">
            Indicado pelo Floripa.My
          </span>
          <p className="mt-1 font-display text-base font-bold">{featured.name}</p>
          <p className="text-xs text-ink-dim">
            {featured.neighborhood} · {featured.price_range}
            {featured.rating ? ` · ⭐ ${featured.rating.toFixed(1).replace(".", ",")}` : ""}
          </p>
        </div>
      </button>

      {featured.partner_offer && (
        <p className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-xs font-bold text-coral">🏷️ {featured.partner_offer}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-dim">
          Entrada
          <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-ink-dim">
          Saída
          <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-dim">Hóspedes</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menos hóspedes" disabled={guests <= MIN_GUESTS} onClick={() => setGuests((g) => g - 1)} className="h-8 w-8 rounded-full border border-white/30 disabled:opacity-40">−</button>
          <span aria-live="polite" className="w-6 text-center font-bold">{guests}</span>
          <button type="button" aria-label="Mais hóspedes" disabled={guests >= MAX_GUESTS} onClick={() => setGuests((g) => g + 1)} className="h-8 w-8 rounded-full border border-white/30 disabled:opacity-40">+</button>
        </div>
      </div>

      {stayError && <p className="mt-2 text-xs font-bold text-coral">{stayError}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {contactButton("Consultar disponibilidade", whatsappHref, "whatsapp", true)}
        {contactButton("Reservar pelo site", siteHref, "site", !whatsappHref)}
      </div>

      {others.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowOthers((v) => !v)} className="text-xs font-bold text-turquoise">
            Ver outras opções
          </button>
          {showOthers && (
            <div className="mt-2 flex flex-col gap-2">
              {others.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => { setFeaturedId(place.id); setShowOthers(false); }}
                  className="flex items-center gap-3 rounded-card border border-white/10 bg-graphite/40 p-2 text-left"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-graphite">
                    <Image src={getPlaceImage(place.name, place.photos[0])} alt={place.name} fill sizes="48px" className="object-cover" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{place.name}</span>
                    <span className="block text-xs text-ink-dim">{place.neighborhood} · {place.price_range}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => { writeHidden(slug); setHidden(true); }}
        className="mt-3 block text-xs text-ink-dim underline"
      >
        Já resolvi minha hospedagem
      </button>

      <EstablishmentModal detail={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
```

- [ ] **Step 4: Run the component test**

Run: `npm.cmd test -- src/components/roteiro/LodgingCard.test.tsx`
Expected: PASS. (The wrapping `<label>` names each date input, so `getByLabelText("Entrada")` finds it.)

- [ ] **Step 5: Wire into the page and view**

`src/app/roteiro/[slug]/page.tsx`: add `import { resolveLodging } from "@/lib/hospedagem/resolveLodging";` and pass to `RoteiroView`:

```tsx
      lodging={resolveLodging(itinerary.lodging, places)}
```

`src/components/roteiro/RoteiroView.tsx`: import `LodgingCard`, add `lodging = []` to the destructured props with type `lodging?: Place[];`, and insert right before the `{/* days */}` block (the `<div className="relative mt-6 flex flex-col gap-6 px-6">` that maps `days`):

```tsx
      {lodging.length > 0 && (
        <div className="relative mt-6 px-6">
          <LodgingCard slug={itinerary.slug} options={lodging} group={group} />
        </div>
      )}
```

- [ ] **Step 6: Run the roteiro tests**

Run: `npm.cmd test -- src/components/roteiro src/app/roteiro`
Expected: PASS.

- [ ] **Step 7: Visual check (throwaway, not committed)**

Create `src/app/dev-hospedagem/page.tsx` rendering `<main className="min-h-dvh bg-graphite p-6 text-ink"><LodgingCard slug="dev" options={[...]} group="casal" /></main>` with three inline demo `Place` objects built from `makePlace` (one with offer + WhatsApp, one site-only, one with both). Ask the user whether a dev server is running (`npm.cmd run dev`); open `http://localhost:3000/dev-hospedagem` and screenshot at 390px and 1280px wide: default, "Ver outras opções" open, alternative without WhatsApp, a date error. Fix layout issues, then delete `src/app/dev-hospedagem/` (`git status` must not show it).

- [ ] **Step 8: Commit**

```bash
git add src/components/roteiro/LodgingCard.tsx src/components/roteiro/LodgingCard.test.tsx src/components/roteiro/RoteiroView.tsx "src/app/roteiro/[slug]/page.tsx"
git commit -m "feat(hospedagem): 'Onde ficar' card with WhatsApp availability request"
```

---

### Task 8: Booking fields in the admin

**Files:**
- Modify: `src/lib/estabelecimentos/adminSchema.ts`, `src/app/api/admin/places/route.ts`, `src/app/api/admin/places/[id]/route.ts`, `src/components/admin/AdminPlaceForm.tsx`
- Test: `src/lib/estabelecimentos/adminSchema.test.ts`

**Interfaces:**
- Consumes: `LODGING_CATEGORY`.
- Produces: `adminPlaceFieldsSchema` gains `booking_whatsapp: string` and `booking_url: string` (default `""`); `normalizeLodgingFields<T>(fields: T)` sets both to `null` when `category` is present and not `Hospedagem`, and turns empty strings into `null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/estabelecimentos/adminSchema.test.ts` (add `normalizeLodgingFields` to its import from `./adminSchema`; `validPayload` is the existing fixture in that file):

```ts
describe("lodging booking fields", () => {
  it("accepts an http(s) booking link", () => {
    expect(adminPlaceFieldsSchema.safeParse(validPayload({ booking_url: "https://pousada.com/reservas" })).success).toBe(true);
  });

  it("rejects a booking link that is not a URL", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ booking_url: "pousada.com" }));
    expect(result.success).toBe(false);
  });

  it("nulls booking fields for other categories", () => {
    expect(normalizeLodgingFields({ category: "Gastronomia", booking_whatsapp: "48999990000", booking_url: "https://x.com" }))
      .toMatchObject({ booking_whatsapp: null, booking_url: null });
  });

  it("keeps booking fields for Hospedagem and turns blanks into null", () => {
    expect(normalizeLodgingFields({ category: "Hospedagem", booking_whatsapp: "48999990000", booking_url: "" }))
      .toMatchObject({ booking_whatsapp: "48999990000", booking_url: null });
  });

  it("leaves a patch without category or booking keys untouched", () => {
    expect(normalizeLodgingFields({ name: "X" })).toEqual({ name: "X" });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm.cmd test -- src/lib/estabelecimentos/adminSchema.test.ts`
Expected: FAIL — `normalizeLodgingFields` missing; invalid URL accepted.

- [ ] **Step 3: Implement the schema**

In `adminSchema.ts`, add `import { LODGING_CATEGORY } from "@/lib/hospedagem/eligibility";`, add to `adminPlaceFieldsSchema` (after `partner_offer`):

```ts
  booking_whatsapp: z.string().trim().optional().default(""),
  booking_url: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Use um link começando com http:// ou https://"),
```

and at the end of the file:

```ts
type LodgingFieldsInput = { category?: string; booking_whatsapp?: string | null; booking_url?: string | null };
type NormalizedLodgingFields<T> = Omit<T, "booking_whatsapp" | "booking_url"> & {
  booking_whatsapp?: string | null;
  booking_url?: string | null;
};

// Booking contact only exists for lodgings; blanks are stored as null.
export function normalizeLodgingFields<T extends LodgingFieldsInput>(fields: T): NormalizedLodgingFields<T> {
  const notLodging = fields.category !== undefined && fields.category !== LODGING_CATEGORY;
  const result: NormalizedLodgingFields<T> = { ...fields };
  for (const key of ["booking_whatsapp", "booking_url"] as const) {
    if (notLodging) result[key] = null;
    else if (key in fields) result[key] = fields[key] || null;
  }
  return result;
}
```

- [ ] **Step 4: Apply in the routes**

`src/app/api/admin/places/route.ts` POST: import `normalizeLodgingFields` and change `...parsed.data,` to `...normalizeLodgingFields(parsed.data),`.

`src/app/api/admin/places/[id]/route.ts` PATCH: import `normalizeLodgingFields` and `type AdminPlacePatch`; replace `updatePlace(getSupabaseAdminClient(), id, patch)` with:

```ts
    const updated = await updatePlace(getSupabaseAdminClient(), id, normalizeLodgingFields(patch as AdminPlacePatch));
```

- [ ] **Step 5: Add the form fields**

In `AdminPlaceForm.tsx`:
- import `useEffect` from react and `LODGING_CATEGORY` from `@/lib/hospedagem/eligibility`;
- add `setValue, getValues` to the `useForm` destructure;
- in `defaultsFor`, add `booking_whatsapp: "", booking_url: ""` to the create defaults and `booking_whatsapp: place.booking_whatsapp ?? "", booking_url: place.booking_url ?? ""` to the edit defaults;
- after `const isPartner = watch("is_partner");` add:

```tsx
  const isLodgingCategory = watch("category") === LODGING_CATEGORY;

  // Most pousadas answer reservations on the same number — start from it.
  useEffect(() => {
    if (isLodgingCategory && !getValues("booking_whatsapp")) {
      setValue("booking_whatsapp", getValues("phone"));
    }
  }, [isLodgingCategory, getValues, setValue]);
```

- right after the `price_range` `<FieldError …/>` line add:

```tsx
        {isLodgingCategory && (
          <p className="text-xs text-teal-ink/60">Hospedagem: R$ até 300/diária · R$$ 300–700 · R$$$ acima de 700</p>
        )}
```

- after the `instagram` input (end of "Localização e contato") add:

```tsx
        {isLodgingCategory && (
          <>
            <input {...register("booking_whatsapp")} placeholder="WhatsApp para reservas" className={inputClass} />
            <FieldError message={errors.booking_whatsapp?.message} />
            <input {...register("booking_url")} placeholder="Link de reserva (opcional)" className={inputClass} />
            <FieldError message={errors.booking_url?.message} />
          </>
        )}
```

- [ ] **Step 6: Run tests and type check**

Run: `npm.cmd test -- src/lib/estabelecimentos src/app/api/admin src/components/admin` then `npx.cmd tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/estabelecimentos/adminSchema.ts src/lib/estabelecimentos/adminSchema.test.ts src/app/api/admin/places src/components/admin/AdminPlaceForm.tsx
git commit -m "feat(admin): WhatsApp and booking link for Hospedagem places"
```

---

### Task 9: Lodging partner panel

**Files:**
- Create: `src/lib/hospedagem/dashboard.ts`, `src/lib/hospedagem/loadDashboard.ts`, `src/components/parceiro/LodgingDashboardView.tsx`
- Modify: `src/lib/parceiro/dashboard.ts` (export `isBetween`, `perDayThisMonth`, `byNewest`), `src/components/parceiro/DashboardView.tsx` (export `Card`, `deltaText`), `src/app/parceiro/page.tsx`
- Test: `src/lib/hospedagem/dashboard.test.ts`, `src/components/parceiro/LodgingDashboardView.test.tsx`

**Interfaces:**
- Consumes: `LodgingLeadRow`, `listLodgingLeads`, `listLodgingSuggestions` (Task 6); `formatStayDate` (Task 5); `isLodging` (Task 1); `monthStart`, `formatDayMonth`, `formatTime` (`src/lib/time/saoPaulo`); `DayCount`, `DailyBars`.
- Produces:

```ts
export interface LodgingRequest { createdAt: string; channel: "whatsapp" | "site"; stay: string | null; guests: number | null }
export interface LodgingDashboard {
  requestsThisMonth: number;
  requestsLastMonth: number;
  whatsappThisMonth: number;
  siteThisMonth: number;
  requestsPerDay: DayCount[];
  suggestedThisMonth: number;
  latestRequests: LodgingRequest[];
}
buildLodgingDashboard(input: { now: Date; leads: LodgingLeadRow[]; suggestions: { created_at: string }[] }): LodgingDashboard
loadLodgingDashboard(client: SupabaseClient, place: Place, now?: Date): Promise<LodgingDashboard>
LodgingDashboardView({ dashboard }: { dashboard: LodgingDashboard })
```

- [ ] **Step 1: Write the failing tests**

`src/lib/hospedagem/dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildLodgingDashboard } from "./dashboard";
import type { LodgingLeadRow } from "./queries";

const now = new Date("2026-10-06T15:00:00-03:00");
function lead(created_at: string, overrides: Partial<LodgingLeadRow> = {}): LodgingLeadRow {
  return { id: created_at, place_id: "p", itinerary_slug: "s", channel: "whatsapp", check_in: null, check_out: null, guests: 2, created_at, ...overrides };
}

describe("buildLodgingDashboard", () => {
  const leads = [
    lead("2026-10-02T13:00:00Z", { check_in: "2027-01-12", check_out: "2027-01-15" }),
    lead("2026-10-05T13:00:00Z", { channel: "site" }),
    lead("2026-09-20T13:00:00Z"),
  ];
  const dashboard = buildLodgingDashboard({
    now,
    leads,
    suggestions: [{ created_at: "2026-10-01T12:00:00Z" }, { created_at: "2026-10-03T12:00:00Z" }, { created_at: "2026-09-10T12:00:00Z" }],
  });

  it("counts requests this month vs last month", () => {
    expect(dashboard.requestsThisMonth).toBe(2);
    expect(dashboard.requestsLastMonth).toBe(1);
  });

  it("splits this month's requests by channel", () => {
    expect(dashboard.whatsappThisMonth).toBe(1);
    expect(dashboard.siteThisMonth).toBe(1);
  });

  it("counts roteiros that suggested the lodging this month", () => {
    expect(dashboard.suggestedThisMonth).toBe(2);
  });

  it("has one bar per day so far this month", () => {
    expect(dashboard.requestsPerDay).toHaveLength(6);
    expect(dashboard.requestsPerDay[1].count).toBe(1);
  });

  it("lists the latest requests newest first, with the stay", () => {
    expect(dashboard.latestRequests.map((r) => r.stay)).toEqual([null, "12/01 → 15/01", null]);
  });
});
```

`src/components/parceiro/LodgingDashboardView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LodgingDashboardView } from "./LodgingDashboardView";
import type { LodgingDashboard } from "@/lib/hospedagem/dashboard";

const dashboard: LodgingDashboard = {
  requestsThisMonth: 7, requestsLastMonth: 4, whatsappThisMonth: 5, siteThisMonth: 2,
  requestsPerDay: [{ dayKey: "2026-10-01", label: "1", count: 3 }],
  suggestedThisMonth: 31,
  latestRequests: [{ createdAt: "2026-10-05T17:30:00Z", channel: "whatsapp", stay: "12/01 → 15/01", guests: 2 }],
};

describe("LodgingDashboardView", () => {
  it("shows availability requests with the monthly delta and channel split", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText("Pedidos de disponibilidade")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("↑ 3 vs mês anterior")).toBeInTheDocument();
    expect(screen.getByText("💬 5 pelo WhatsApp · 🔗 2 pelo site")).toBeInTheDocument();
  });

  it("shows how often the lodging was suggested", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText("Sua hospedagem foi sugerida em 31 roteiros este mês")).toBeInTheDocument();
  });

  it("lists the latest requests", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText(/12\/01 → 15\/01 · 2 hóspedes/)).toBeInTheDocument();
  });

  it("has no courtesy blocks", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.queryByText(/cortesia/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm.cmd test -- src/lib/hospedagem/dashboard.test.ts src/components/parceiro/LodgingDashboardView.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Export the shared helpers**

In `src/lib/parceiro/dashboard.ts`, add `export` to `function isBetween`, `function perDayThisMonth` and `function byNewest`. In `src/components/parceiro/DashboardView.tsx`, add `export` to `function Card` and `function deltaText`.

- [ ] **Step 4: Implement the builder and loader**

`src/lib/hospedagem/dashboard.ts`:

```ts
import { monthStart } from "@/lib/time/saoPaulo";
import { byNewest, isBetween, perDayThisMonth, type DayCount } from "@/lib/parceiro/dashboard";
import { formatStayDate } from "./contact";
import type { LodgingLeadRow } from "./queries";

const MAX_LATEST_REQUESTS = 10;

export interface LodgingRequest {
  createdAt: string;
  channel: "whatsapp" | "site";
  stay: string | null;
  guests: number | null;
}

export interface LodgingDashboard {
  requestsThisMonth: number;
  requestsLastMonth: number;
  whatsappThisMonth: number;
  siteThisMonth: number;
  requestsPerDay: DayCount[];
  suggestedThisMonth: number;
  latestRequests: LodgingRequest[];
}

export function buildLodgingDashboard({
  now,
  leads,
  suggestions,
}: {
  now: Date;
  leads: LodgingLeadRow[];
  suggestions: { created_at: string }[];
}): LodgingDashboard {
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);
  const current = leads.filter((l) => isBetween(l.created_at, thisMonth, null));

  return {
    requestsThisMonth: current.length,
    requestsLastMonth: leads.filter((l) => isBetween(l.created_at, lastMonth, thisMonth)).length,
    whatsappThisMonth: current.filter((l) => l.channel === "whatsapp").length,
    siteThisMonth: current.filter((l) => l.channel === "site").length,
    requestsPerDay: perDayThisMonth(current.map((l) => l.created_at), now),
    suggestedThisMonth: suggestions.filter((s) => isBetween(s.created_at, thisMonth, null)).length,
    latestRequests: byNewest(leads, (l) => l.created_at)
      .slice(0, MAX_LATEST_REQUESTS)
      .map((l) => ({
        createdAt: l.created_at,
        channel: l.channel,
        stay: l.check_in && l.check_out ? `${formatStayDate(l.check_in)} → ${formatStayDate(l.check_out)}` : null,
        guests: l.guests,
      })),
  };
}
```

`src/lib/hospedagem/loadDashboard.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place } from "@/lib/supabase/types";
import { monthStart } from "@/lib/time/saoPaulo";
import { buildLodgingDashboard, type LodgingDashboard } from "./dashboard";
import { listLodgingLeads, listLodgingSuggestions } from "./queries";

export async function loadLodgingDashboard(client: SupabaseClient, place: Place, now: Date = new Date()): Promise<LodgingDashboard> {
  const since = monthStart(now, -1);
  const [leads, suggestions] = await Promise.all([
    listLodgingLeads(client, place.id, since),
    listLodgingSuggestions(client, place.id, since),
  ]);
  return buildLodgingDashboard({ now, leads, suggestions });
}
```

- [ ] **Step 5: Implement the view**

`src/components/parceiro/LodgingDashboardView.tsx`:

```tsx
import type { LodgingDashboard } from "@/lib/hospedagem/dashboard";
import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import { DailyBars } from "./DailyBars";
import { Card, deltaText } from "./DashboardView";

const CHANNEL_LABEL = { whatsapp: "WhatsApp", site: "Site" } as const;

export function LodgingDashboardView({ dashboard }: { dashboard: LodgingDashboard }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Pedidos de disponibilidade</p>
        <p className="font-display text-4xl font-extrabold">{dashboard.requestsThisMonth}</p>
        <p className="text-xs font-bold text-turquoise-deep">{deltaText(dashboard.requestsThisMonth, dashboard.requestsLastMonth)}</p>
        <p className="text-sm text-teal-ink/70">
          💬 {dashboard.whatsappThisMonth} pelo WhatsApp · 🔗 {dashboard.siteThisMonth} pelo site
        </p>
        <DailyBars data={dashboard.requestsPerDay} label="Pedidos de disponibilidade por dia" />
      </Card>

      <Card>
        <p className="font-display text-base font-extrabold">
          Sua hospedagem foi sugerida em {dashboard.suggestedThisMonth} roteiros este mês
        </p>
        <p className="text-sm text-teal-ink/60">Turistas sem hospedagem que receberam você como primeira indicação.</p>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold">Últimos pedidos</h2>
        {dashboard.latestRequests.length === 0 ? (
          <p className="text-sm text-teal-ink/60">Nenhum pedido ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {dashboard.latestRequests.map((request) => (
              <li key={request.createdAt} className="flex justify-between gap-3 border-b border-teal-ink/5 pb-2 last:border-0">
                <span>
                  {CHANNEL_LABEL[request.channel]}
                  {request.stay ? ` · ${request.stay}` : " · sem datas"}
                  {request.guests ? ` · ${request.guests} hóspedes` : ""}
                </span>
                <span className="shrink-0 text-teal-ink/50">
                  {formatDayMonth(new Date(request.createdAt))} {formatTime(new Date(request.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Branch the partner page**

In `src/app/parceiro/page.tsx`, import `isLodging`, `loadLodgingDashboard`, `LodgingDashboardView`, and replace everything from `const dashboard = await loadDashboard(...)` to the end of the returned JSX with:

```tsx
  const client = getSupabaseAdminClient();
  if (isLodging(place)) {
    const lodgingDashboard = await loadLodgingDashboard(client, place);
    return (
      <PartnerShell placeName={place.name} plan={place.partner_plan} active="painel">
        <LodgingDashboardView dashboard={lodgingDashboard} />
      </PartnerShell>
    );
  }
  const dashboard = await loadDashboard(client, place);
  return (
    <PartnerShell placeName={place.name} plan={place.partner_plan} active="painel">
      <DashboardView
        dashboard={dashboard}
        plan={place.partner_plan}
        liveOffer={liveOfferText(place)}
        pendingOffer={place.pending_offer ?? null}
        hasPending={hasPendingOffer({ pending_offer_submitted_at: place.pending_offer_submitted_at ?? null })}
      />
    </PartnerShell>
  );
```

- [ ] **Step 7: Run tests**

Run: `npm.cmd test -- src/lib/hospedagem src/lib/parceiro src/components/parceiro src/app/parceiro`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/hospedagem/dashboard.ts src/lib/hospedagem/dashboard.test.ts src/lib/hospedagem/loadDashboard.ts src/components/parceiro/LodgingDashboardView.tsx src/components/parceiro/LodgingDashboardView.test.tsx src/lib/parceiro/dashboard.ts src/components/parceiro/DashboardView.tsx src/app/parceiro/page.tsx
git commit -m "feat(parceiro): availability-request panel for lodging partners"
```

---

### Task 10: Full verification and rollout with the user

**Files:** none new.

- [ ] **Step 1: Whole suite, lint, build**

Run: `npm.cmd test` then `npm.cmd run lint` then `npm.cmd run build`
Expected: all pass. Fix anything red before continuing.

- [ ] **Step 2: Guide the user through the migration (click by click)**

The user is not technical with Supabase. Give these steps in Portuguese: open supabase.com → project → **SQL Editor** → **New query** → paste the full contents of `supabase/migrations/0006_hospedagem.sql` → **Run** → confirm "Success. No rows returned". Wait for confirmation before anything else.

- [ ] **Step 3: End-to-end in the user's local environment**

With the user's dev server running: in `/admin`, create "Pousada Teste Floripa.My" with category Hospedagem, price R$$, region Norte, WhatsApp = the user's own number, Aprovado + É parceiro. Take the quiz choosing "Ainda não tenho hospedagem" and budget Médio. Confirm the "Onde ficar" card appears, fill dates, tap "Consultar disponibilidade", confirm WhatsApp opens with the message. Log into `/parceiro` as that place (contact e-mail = the user's) and confirm "Pedidos de disponibilidade = 1". Then delete the test place in `/admin` (cascade deletes its leads).

- [ ] **Step 4: Ask before pushing**

Ask the user to confirm the push to `main` (push = production deploy). Only after the migration ran in Supabase.
