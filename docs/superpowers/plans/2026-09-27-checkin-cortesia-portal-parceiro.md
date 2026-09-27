# Check-in por Cortesia + Portal do Parceiro (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tourist generate a single-use courtesy code from their roteiro (no signup), let the partner's staff validate it in a magic-link partner portal, and show the partner a dashboard proving how many customers came through Floripa.My — plus a partner-edited, founder-approved offer flow.

**Architecture:** A new `courtesy_codes` table (service-role access only, like every other table) holds codes; pure modules (`src/lib/cortesia/*`, `src/lib/parceiro/dashboard.ts`, `src/lib/ofertas/pendingOffer.ts`, `src/lib/time/saoPaulo.ts`) hold all rules and are unit-tested; thin Next.js route handlers wire them to Supabase. Partner identity uses Supabase Auth magic links via `@supabase/ssr` (cookie session, `token_hash` email flow so the link works on any device); a logged-in email maps to the partner place whose `contact_email` matches. The existing middleware is extended to gate `/parceiro/*` and `/api/parceiro/*`.

**Tech Stack:** Next.js 15 App Router + middleware (Node runtime), React 19, TypeScript, Zod 4, `@supabase/supabase-js`, new `@supabase/ssr`, Tailwind 4, Vitest + Testing Library (jsdom).

**Spec:** [docs/superpowers/specs/2026-09-27-checkin-cortesia-portal-parceiro-design.md](../specs/2026-09-27-checkin-cortesia-portal-parceiro-design.md)

## Global Constraints

- UI copy is pt-BR and uses the spec's exact strings (e.g. "Resgate sua cortesia", "Mostre este código no balcão", the five validation messages, "Confirmar entrega").
- Code format: `FMY-` + 4 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no `0 O 1 I L`). Codes are unique across all rows (never reused).
- Code validity: 24h from creation (`CODE_TTL_MS = 86_400_000`), single use.
- "Month" = calendar month in `America/Sao_Paulo` (fixed UTC-3; Brazil has no DST since 2019).
- Partner offer text: max 120 characters (`MAX_OFFER_LENGTH = 120`). Empty submission = removal request.
- A place has a **live offer** only when `is_partner && is_verified && partner_offer.trim() !== ""`. Simulated partners from `src/lib/itinerary/simulatedPartners.ts` (is_partner false) must never get the "Resgate sua cortesia" button.
- All database reads/writes go through `getSupabaseAdminClient()` on the server. New tables get RLS enabled with no policies. Supabase Auth is used only for partner identity; `SUPABASE_ANON_KEY` is server-only (never `NEXT_PUBLIC_`).
- No tourist accounts. The only new dependency is `@supabase/ssr`.
- Partner pages use the light admin look (`bg-sand`, `text-teal-ink`, `BrandWordmark`); tourist UI keeps the dark roteiro look (`bg-graphite`, `text-ink`).
- Before starting a dev server, check whether one is already running; never run two against the same `.next`.
- Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Two staff members (or one double tap) confirming the same code at the same moment must result in exactly one redemption; the second sees "Este código já foi usado em…". Pinned in Task 5 (redeem update carries `redeemed_at is null` + `expires_at > now` conditions) and Task 12 (confirm route returns 409 with the used message when the update matches nothing).
- A tourist who generated the code at the hotel and has no signal at the restaurant must still see the code. Pinned in Task 7 (sheet keeps showing the cached code when the status request throws).
- A partner who logs in with different casing/whitespace than the `contact_email` stored in admin (`Carlos@Box32.com ` vs `carlos@box32.com`) must still reach their place. Pinned in Task 9.
- Simulated partners with fake offers must not show the courtesy button (nobody could validate those codes). Pinned in Task 4.
- A magic link or login form with `next=https://evil.com` or `next=//evil.com` must never redirect off-site. Pinned in Task 9 (`safeNextPath`) and used by Tasks 11.

---

## Task 1: Database migration and types

**Files:**
- Create: `supabase/migrations/0005_checkin_cortesia.sql`
- Create: `src/lib/cortesia/types.ts`
- Modify: `src/lib/supabase/types.ts` (add two optional fields to `Place`)

**Interfaces:**
- Produces: `CourtesyCodeRow`, `NewCourtesyCode` (in `src/lib/cortesia/types.ts`); `Place.pending_offer?: string | null`, `Place.pending_offer_submitted_at?: string | null`; SQL function `itineraries_with_place(p_place_id uuid, p_since timestamptz)` returning `(id uuid, created_at timestamptz, quiz_answers jsonb)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_checkin_cortesia.sql
-- Check-in por cortesia + Portal do Parceiro (Fase 1).

-- Partner-submitted offer waiting for founder approval. `pending_offer_submitted_at`
-- being non-null is what marks "there is a pending submission"; an empty
-- `pending_offer` with a timestamp means "the partner asked to remove the offer".
alter table places add column pending_offer text;
alter table places add column pending_offer_submitted_at timestamptz;

create table courtesy_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  place_id uuid not null references places(id) on delete cascade,
  itinerary_id uuid references itineraries(id) on delete set null,
  device_id text not null,
  offer_text text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid
);

create index courtesy_codes_place_redeemed_idx on courtesy_codes (place_id, redeemed_at);
create index courtesy_codes_device_place_idx on courtesy_codes (device_id, place_id, created_at);

-- Same hardening as 0002: no policies, so only the service-role client can touch it.
alter table courtesy_codes enable row level security;

-- Roteiros that currently contain the place (activities carry `place_id` inside
-- the `days` JSON). Uses the itinerary's current state: a place the tourist
-- swapped out no longer counts.
create or replace function itineraries_with_place(p_place_id uuid, p_since timestamptz)
returns table (id uuid, created_at timestamptz, quiz_answers jsonb)
language sql
stable
as $$
  select i.id, i.created_at, i.quiz_answers
  from itineraries i
  where i.created_at >= p_since
    and jsonb_path_exists(
      i.days,
      '$[*].activities[*] ? (@.place_id == $pid)',
      jsonb_build_object('pid', p_place_id::text)
    )
  order by i.created_at desc;
$$;

-- Functions are executable by PUBLIC by default; keep this one server-only.
revoke execute on function itineraries_with_place(uuid, timestamptz) from public, anon, authenticated;
grant execute on function itineraries_with_place(uuid, timestamptz) to service_role;
```

- [ ] **Step 2: Add the courtesy code types**

```ts
// src/lib/cortesia/types.ts
export interface CourtesyCodeRow {
  id: string;
  code: string;
  place_id: string;
  itinerary_id: string | null;
  device_id: string;
  offer_text: string;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
}

export type NewCourtesyCode = Pick<
  CourtesyCodeRow,
  "code" | "place_id" | "itinerary_id" | "device_id" | "offer_text" | "expires_at"
>;
```

- [ ] **Step 3: Add the pending-offer fields to `Place`**

In `src/lib/supabase/types.ts`, inside `interface Place`, after `submission_source?: string;` add:

```ts
  pending_offer?: string | null;
  pending_offer_submitted_at?: string | null;
```

(Optional, like the `contact_*` fields, so existing test fixtures keep compiling.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

The SQL is applied to Supabase by the founder in Task 17 (setup guide). Nothing before Task 17's manual test needs the real database.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_checkin_cortesia.sql src/lib/cortesia/types.ts src/lib/supabase/types.ts
git commit -m "feat(cortesia): add courtesy_codes table, pending offer columns and appearances function

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: São Paulo time helpers

**Files:**
- Create: `src/lib/time/saoPaulo.ts`
- Test: `src/lib/time/saoPaulo.test.ts`

**Interfaces:**
- Produces:
  - `saoPauloParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number }`
  - `dayKey(date: Date): string` → `"2026-09-26"`
  - `formatDayMonth(date: Date): string` → `"26/09"`
  - `formatTime(date: Date): string` → `"23h30"`
  - `monthStart(date: Date, monthOffset?: number): Date` → first instant of the São Paulo calendar month (offset `-1` = previous month)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/time/saoPaulo.test.ts
import { describe, it, expect } from "vitest";
import { saoPauloParts, dayKey, formatDayMonth, formatTime, monthStart } from "./saoPaulo";

describe("saoPaulo time helpers", () => {
  // 02:30 UTC on the 27th is still 23:30 on the 26th in São Paulo (UTC-3).
  const lateNight = new Date("2026-09-27T02:30:00Z");

  it("reads calendar parts in São Paulo time, not UTC", () => {
    expect(saoPauloParts(lateNight)).toEqual({ year: 2026, month: 9, day: 26, hour: 23, minute: 30 });
  });

  it("builds a São Paulo day key", () => {
    expect(dayKey(lateNight)).toBe("2026-09-26");
  });

  it("formats day/month and time the Brazilian way", () => {
    expect(formatDayMonth(lateNight)).toBe("26/09");
    expect(formatTime(new Date("2026-09-27T16:05:00Z"))).toBe("13h05");
  });

  it("returns the first instant of the São Paulo month", () => {
    // 02:00 UTC on Oct 1st is still Sep 30th in São Paulo.
    expect(monthStart(new Date("2026-10-01T02:00:00Z")).toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("moves across the year boundary with a negative offset", () => {
    expect(monthStart(new Date("2026-01-15T12:00:00Z"), -1).toISOString()).toBe("2025-12-01T03:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/time/saoPaulo.test.ts`
Expected: FAIL — cannot resolve `./saoPaulo`.

- [ ] **Step 3: Implement**

```ts
// src/lib/time/saoPaulo.ts
const TIME_ZONE = "America/Sao_Paulo";
// Brazil abolished daylight saving time in 2019, so São Paulo is a fixed UTC-3.
const UTC_OFFSET = "-03:00";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface SaoPauloParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function saoPauloParts(date: Date): SaoPauloParts {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function dayKey(date: Date): string {
  const { year, month, day } = saoPauloParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatDayMonth(date: Date): string {
  const { month, day } = saoPauloParts(date);
  return `${pad(day)}/${pad(month)}`;
}

export function formatTime(date: Date): string {
  const { hour, minute } = saoPauloParts(date);
  return `${pad(hour)}h${pad(minute)}`;
}

export function monthStart(date: Date, monthOffset = 0): Date {
  const { year, month } = saoPauloParts(date);
  const total = year * 12 + (month - 1) + monthOffset;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return new Date(`${targetYear}-${pad(targetMonth)}-01T00:00:00${UTC_OFFSET}`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/time/saoPaulo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/time/saoPaulo.ts src/lib/time/saoPaulo.test.ts
git commit -m "feat(time): add São Paulo calendar helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Courtesy code core (generate, normalize, check, labels)

**Files:**
- Create: `src/lib/cortesia/code.ts`, `src/lib/cortesia/checkCode.ts`, `src/lib/cortesia/labels.ts`
- Test: `src/lib/cortesia/code.test.ts`, `src/lib/cortesia/checkCode.test.ts`, `src/lib/cortesia/labels.test.ts`

**Interfaces:**
- Consumes: `CourtesyCodeRow` (Task 1); `dayKey`, `formatDayMonth`, `formatTime` (Task 2).
- Produces:
  - `CODE_PREFIX = "FMY-"`, `CODE_ALPHABET`, `CODE_TTL_MS`
  - `generateCode(randomInt?: (max: number) => number): string`
  - `normalizeCode(input: string): string | null` → canonical `"FMY-XXXX"` or `null`
  - `type CheckResult = { status: "valid"; offerText: string } | { status: "not_found" } | { status: "used"; redeemedAt: string } | { status: "expired" } | { status: "other_place" }`
  - `checkCode(row: CourtesyCodeRow | null, placeId: string, now: Date): CheckResult`
  - `checkMessage(result: CheckResult): string`
  - `validityLabel(expiresAt: string, now: Date): string`, `usedLabel(redeemedAt: string): string`, `relativeTime(iso: string, now: Date): string`

- [ ] **Step 1: Write the failing tests for `code.ts`**

```ts
// src/lib/cortesia/code.test.ts
import { describe, it, expect } from "vitest";
import { generateCode, normalizeCode, CODE_ALPHABET, CODE_TTL_MS } from "./code";

describe("generateCode", () => {
  it("produces FMY- plus 4 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^FMY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    }
  });

  it("uses the injected random source", () => {
    expect(generateCode(() => 0)).toBe(`FMY-${CODE_ALPHABET[0].repeat(4)}`);
  });

  it("never contains ambiguous characters in the alphabet", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("lasts 24 hours", () => {
    expect(CODE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("normalizeCode", () => {
  it.each([
    ["FMY-4K7P", "FMY-4K7P"],
    ["fmy-4k7p", "FMY-4K7P"],
    ["4k7p", "FMY-4K7P"],
    [" fmy 4k7p ", "FMY-4K7P"],
    ["FMY4K7P", "FMY-4K7P"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeCode(input)).toBe(expected);
  });

  it.each(["", "FMY-", "4K7", "4K7PP", "FMY-4K0P", "FMY-4KOP", "ABC-4K7P"])("rejects %j", (input) => {
    expect(normalizeCode(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/code.test.ts`
Expected: FAIL — cannot resolve `./code`.

- [ ] **Step 3: Implement `code.ts`**

```ts
// src/lib/cortesia/code.ts
export const CODE_PREFIX = "FMY-";
// No 0/O, 1/I/L — the code is read aloud at a counter.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_BODY_LENGTH = 4;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;

function secureRandomInt(max: number): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function generateCode(randomInt: (max: number) => number = secureRandomInt): string {
  let body = "";
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}${body}`;
}

export function normalizeCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  const prefix = CODE_PREFIX.replace("-", "");
  const body =
    compact.length === prefix.length + CODE_BODY_LENGTH && compact.startsWith(prefix)
      ? compact.slice(prefix.length)
      : compact;
  if (body.length !== CODE_BODY_LENGTH) return null;
  if (![...body].every((char) => CODE_ALPHABET.includes(char))) return null;
  return `${CODE_PREFIX}${body}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/code.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `checkCode.ts`**

```ts
// src/lib/cortesia/checkCode.test.ts
import { describe, it, expect } from "vitest";
import { checkCode, checkMessage } from "./checkCode";
import type { CourtesyCodeRow } from "./types";

const now = new Date("2026-09-27T15:00:00Z");

function row(overrides: Partial<CourtesyCodeRow> = {}): CourtesyCodeRow {
  return {
    id: "c1", code: "FMY-4K7P", place_id: "place-a", itinerary_id: "it-1", device_id: "dev-1",
    offer_text: "Sobremesa cortesia", created_at: "2026-09-27T12:00:00Z",
    expires_at: "2026-09-28T12:00:00Z", redeemed_at: null, redeemed_by: null,
    ...overrides,
  };
}

describe("checkCode", () => {
  it("is not_found when there is no row", () => {
    expect(checkCode(null, "place-a", now)).toEqual({ status: "not_found" });
  });

  it("is other_place when the code belongs to another establishment", () => {
    expect(checkCode(row({ place_id: "place-b" }), "place-a", now)).toEqual({ status: "other_place" });
  });

  it("is used when already redeemed, carrying when", () => {
    expect(checkCode(row({ redeemed_at: "2026-09-27T16:10:00Z" }), "place-a", now)).toEqual({
      status: "used",
      redeemedAt: "2026-09-27T16:10:00Z",
    });
  });

  it("is expired at or after expires_at", () => {
    expect(checkCode(row({ expires_at: "2026-09-27T15:00:00Z" }), "place-a", now)).toEqual({ status: "expired" });
  });

  it("is valid with the offer text snapshotted at generation (even if the live offer changed or was removed)", () => {
    expect(checkCode(row({ offer_text: "Texto antigo" }), "place-a", now)).toEqual({
      status: "valid",
      offerText: "Texto antigo",
    });
  });
});

describe("checkMessage", () => {
  it("uses the spec's copy for each outcome", () => {
    expect(checkMessage({ status: "valid", offerText: "Sobremesa cortesia" })).toBe("Código válido: Sobremesa cortesia");
    expect(checkMessage({ status: "not_found" })).toBe("Código não encontrado. Confira as letras com o cliente.");
    expect(checkMessage({ status: "expired" })).toBe("Código expirado. Peça ao cliente para gerar um novo no app.");
    expect(checkMessage({ status: "other_place" })).toBe("Este código é de outro estabelecimento.");
  });

  it("shows the São Paulo date and time a code was used", () => {
    expect(checkMessage({ status: "used", redeemedAt: "2026-09-27T16:10:00Z" })).toBe(
      "Este código já foi usado em 27/09 às 13h10.",
    );
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/checkCode.test.ts`
Expected: FAIL — cannot resolve `./checkCode`.

- [ ] **Step 7: Implement `checkCode.ts`**

```ts
// src/lib/cortesia/checkCode.ts
import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import type { CourtesyCodeRow } from "./types";

export type CheckResult =
  | { status: "valid"; offerText: string }
  | { status: "not_found" }
  | { status: "used"; redeemedAt: string }
  | { status: "expired" }
  | { status: "other_place" };

export function checkCode(row: CourtesyCodeRow | null, placeId: string, now: Date): CheckResult {
  if (!row) return { status: "not_found" };
  if (row.place_id !== placeId) return { status: "other_place" };
  if (row.redeemed_at) return { status: "used", redeemedAt: row.redeemed_at };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { status: "expired" };
  return { status: "valid", offerText: row.offer_text };
}

export function checkMessage(result: CheckResult): string {
  switch (result.status) {
    case "valid":
      return `Código válido: ${result.offerText}`;
    case "not_found":
      return "Código não encontrado. Confira as letras com o cliente.";
    case "used": {
      const redeemedAt = new Date(result.redeemedAt);
      return `Este código já foi usado em ${formatDayMonth(redeemedAt)} às ${formatTime(redeemedAt)}.`;
    }
    case "expired":
      return "Código expirado. Peça ao cliente para gerar um novo no app.";
    case "other_place":
      return "Este código é de outro estabelecimento.";
  }
}
```

- [ ] **Step 8: Write the failing tests for `labels.ts`**

```ts
// src/lib/cortesia/labels.test.ts
import { describe, it, expect } from "vitest";
import { validityLabel, usedLabel, relativeTime } from "./labels";

describe("validityLabel", () => {
  const now = new Date("2026-09-27T17:30:00Z"); // 14h30 in São Paulo

  it("says amanhã for a code expiring the next São Paulo day", () => {
    expect(validityLabel("2026-09-28T17:30:00Z", now)).toBe("válido até amanhã, 14h30");
  });

  it("says hoje for a code expiring the same São Paulo day", () => {
    expect(validityLabel("2026-09-27T22:00:00Z", now)).toBe("válido até hoje, 19h00");
  });
});

describe("usedLabel", () => {
  it("shows the São Paulo day it was used", () => {
    expect(usedLabel("2026-09-28T01:00:00Z")).toBe("✓ Cortesia usada em 27/09");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  it.each([
    ["2026-09-27T14:59:40Z", "agora"],
    ["2026-09-27T14:46:00Z", "há 14 min"],
    ["2026-09-27T12:00:00Z", "há 3 h"],
    ["2026-09-26T15:00:00Z", "há 1 dia"],
    ["2026-09-24T15:00:00Z", "há 3 dias"],
  ])("formats %s as %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/labels.test.ts`
Expected: FAIL — cannot resolve `./labels`.

- [ ] **Step 10: Implement `labels.ts`**

```ts
// src/lib/cortesia/labels.ts
import { dayKey, formatDayMonth, formatTime } from "@/lib/time/saoPaulo";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function validityLabel(expiresAt: string, now: Date): string {
  const expires = new Date(expiresAt);
  const expiresDay = dayKey(expires);
  const when =
    expiresDay === dayKey(now)
      ? "hoje"
      : expiresDay === dayKey(new Date(now.getTime() + DAY_MS))
        ? "amanhã"
        : formatDayMonth(expires);
  return `válido até ${when}, ${formatTime(expires)}`;
}

export function usedLabel(redeemedAt: string): string {
  return `✓ Cortesia usada em ${formatDayMonth(new Date(redeemedAt))}`;
}

export function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE_MS) return "agora";
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
```

- [ ] **Step 11: Run all three test files**

Run: `npx vitest run src/lib/cortesia`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/cortesia/code.ts src/lib/cortesia/code.test.ts src/lib/cortesia/checkCode.ts src/lib/cortesia/checkCode.test.ts src/lib/cortesia/labels.ts src/lib/cortesia/labels.test.ts
git commit -m "feat(cortesia): code generation, normalization, validation rules and labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Live offers

**Files:**
- Create: `src/lib/cortesia/liveOffers.ts`
- Test: `src/lib/cortesia/liveOffers.test.ts`

**Interfaces:**
- Consumes: `Place`.
- Produces: `liveOfferText(place: Pick<Place, "is_partner" | "is_verified" | "partner_offer">): string | null`; `liveOfferMap(places: Place[]): Record<string, string>` (place id → live offer text).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/cortesia/liveOffers.test.ts
import { describe, it, expect } from "vitest";
import { liveOfferText, liveOfferMap } from "./liveOffers";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar", category: "Gastronomia",
    target_profiles: [], price_range: "R$$", point_type: "Restaurante", short_description: "",
    address: "", opening_hours: null, phone: null, instagram: null, notes: null, google_place_id: null,
    lat: null, lng: null, rating: null, photos: [], is_partner: true, partner_plan: null,
    partner_offer: "Sobremesa cortesia", partner_status: null, special_needs_tags: [], is_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("liveOfferText", () => {
  it("returns the trimmed offer for a verified real partner", () => {
    expect(liveOfferText(place({ partner_offer: "  Sobremesa cortesia " }))).toBe("Sobremesa cortesia");
  });

  it.each([
    ["not a real partner (e.g. a simulated one)", { is_partner: false }],
    ["not verified", { is_verified: false }],
    ["offer is null", { partner_offer: null }],
    ["offer is blank", { partner_offer: "   " }],
  ])("is null when %s", (_label, overrides) => {
    expect(liveOfferText(place(overrides as Partial<Place>))).toBeNull();
  });
});

describe("liveOfferMap", () => {
  it("maps only places with a live offer", () => {
    const places = [
      place({ id: "a", partner_offer: "Chopp em dobro" }),
      place({ id: "b", is_partner: false, partner_offer: "Oferta simulada" }),
      place({ id: "c", partner_offer: null }),
    ];
    expect(liveOfferMap(places)).toEqual({ a: "Chopp em dobro" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/liveOffers.test.ts`
Expected: FAIL — cannot resolve `./liveOffers`.

- [ ] **Step 3: Implement**

```ts
// src/lib/cortesia/liveOffers.ts
import type { Place } from "@/lib/supabase/types";

// A courtesy code needs a real partner behind it to validate it, so the
// simulated partners (is_partner false, fake offers injected for UI preview)
// never count as having a live offer.
export function liveOfferText(place: Pick<Place, "is_partner" | "is_verified" | "partner_offer">): string | null {
  if (!place.is_partner || !place.is_verified) return null;
  const offer = place.partner_offer?.trim();
  return offer ? offer : null;
}

export function liveOfferMap(places: Place[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const place of places) {
    const offer = liveOfferText(place);
    if (offer) map[place.id] = offer;
  }
  return map;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/liveOffers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cortesia/liveOffers.ts src/lib/cortesia/liveOffers.test.ts
git commit -m "feat(cortesia): derive live offers from real verified partners only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Courtesy code database queries

**Files:**
- Create: `src/lib/cortesia/queries.ts`
- Test: `src/lib/cortesia/queries.test.ts`

**Interfaces:**
- Consumes: `CourtesyCodeRow`, `NewCourtesyCode` (Task 1).
- Produces:
  - `findCodeByCode(client, code: string): Promise<CourtesyCodeRow | null>`
  - `findReusableCode(client, args: { deviceId: string; placeId: string; now: Date }): Promise<CourtesyCodeRow | null>`
  - `insertCode(client, row: NewCourtesyCode): Promise<CourtesyCodeRow>` (throws the raw Postgrest error; unique violation has `code === "23505"`)
  - `isUniqueViolation(error: unknown): boolean`
  - `redeemCode(client, args: { code: string; placeId: string; userId: string; now: Date }): Promise<CourtesyCodeRow | null>` (null when nothing matched)
  - `listRedeemedCodes(client, placeId: string, since: Date): Promise<CourtesyCodeRow[]>`
  - `hasEverRedeemed(client, placeId: string): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/cortesia/queries.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/queries.test.ts`
Expected: FAIL — cannot resolve `./queries`.

- [ ] **Step 3: Implement**

```ts
// src/lib/cortesia/queries.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourtesyCodeRow, NewCourtesyCode } from "./types";

const TABLE = "courtesy_codes";

export async function findCodeByCode(client: SupabaseClient, code: string): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client.from(TABLE).select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function findReusableCode(
  client: SupabaseClient,
  { deviceId, placeId, now }: { deviceId: string; placeId: string; now: Date },
): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("device_id", deviceId)
    .eq("place_id", placeId)
    .is("redeemed_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function insertCode(client: SupabaseClient, row: NewCourtesyCode): Promise<CourtesyCodeRow> {
  const { data, error } = await client.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data as CourtesyCodeRow;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

// One UPDATE with every condition in its WHERE clause: Postgres re-checks the
// row under concurrent updates, so two simultaneous confirmations of the same
// code can't both succeed.
export async function redeemCode(
  client: SupabaseClient,
  { code, placeId, userId, now }: { code: string; placeId: string; userId: string; now: Date },
): Promise<CourtesyCodeRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .update({ redeemed_at: now.toISOString(), redeemed_by: userId })
    .eq("code", code)
    .eq("place_id", placeId)
    .is("redeemed_at", null)
    .gt("expires_at", now.toISOString())
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as CourtesyCodeRow | null;
}

export async function listRedeemedCodes(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<CourtesyCodeRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("place_id", placeId)
    .gte("redeemed_at", since.toISOString())
    .order("redeemed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourtesyCodeRow[];
}

export async function hasEverRedeemed(client: SupabaseClient, placeId: string): Promise<boolean> {
  const { count, error } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .not("redeemed_at", "is", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cortesia/queries.ts src/lib/cortesia/queries.test.ts
git commit -m "feat(cortesia): database queries with atomic redeem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Issue a code + tourist API routes

**Files:**
- Create: `src/lib/cortesia/issueCode.ts`, `src/app/api/cortesia/route.ts`, `src/app/api/cortesia/[code]/route.ts`
- Test: `src/lib/cortesia/issueCode.test.ts`, `src/app/api/cortesia/route.test.ts`, `src/app/api/cortesia/[code]/route.test.ts`

**Interfaces:**
- Consumes: `getPlaceById`, `getItineraryBySlug` (`@/lib/supabase/queries`); `liveOfferText` (Task 4); `generateCode`, `normalizeCode`, `CODE_TTL_MS` (Task 3); `findReusableCode`, `insertCode`, `isUniqueViolation`, `findCodeByCode` (Task 5).
- Produces:
  - `interface IssuedCode { code: string; offerText: string; expiresAt: string }`
  - `issueCode(client, args: { placeId: string; itinerarySlug: string; deviceId: string; now?: Date; generate?: () => string }): Promise<IssuedCode>`
  - `class NoLiveOfferError`, `class RoteiroNotFoundError`
  - `POST /api/cortesia` body `{ placeId, itinerarySlug, deviceId }` → 200 `IssuedCode` | 400 | 404 | 409 | 502
  - `GET /api/cortesia/[code]?deviceId=` → 200 `{ status: "active"; expiresAt } | { status: "used"; redeemedAt } | { status: "expired" }` | 404

- [ ] **Step 1: Write the failing tests for `issueCode`**

```ts
// src/lib/cortesia/issueCode.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), getItineraryBySlug: vi.fn() }));
vi.mock("./queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./queries")>();
  return { ...actual, findReusableCode: vi.fn(), insertCode: vi.fn() };
});

import { issueCode, NoLiveOfferError, RoteiroNotFoundError } from "./issueCode";
import { getPlaceById, getItineraryBySlug } from "@/lib/supabase/queries";
import { findReusableCode, insertCode } from "./queries";

const client = {} as SupabaseClient;
const now = new Date("2026-09-27T15:00:00Z");
const args = { placeId: "place-a", itinerarySlug: "abc123", deviceId: "device-123", now };

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset().mockResolvedValue({
    id: "place-a", is_partner: true, is_verified: true, partner_offer: "Sobremesa cortesia",
  } as never);
  vi.mocked(getItineraryBySlug).mockReset().mockResolvedValue({ id: "it-1", slug: "abc123" } as never);
  vi.mocked(findReusableCode).mockReset().mockResolvedValue(null);
  vi.mocked(insertCode).mockReset().mockImplementation(async (_c, row) => ({
    ...row, id: "c1", created_at: now.toISOString(), redeemed_at: null, redeemed_by: null,
  }));
});

describe("issueCode", () => {
  it("creates a 24h code snapshotting the live offer and the roteiro", async () => {
    const issued = await issueCode(client, { ...args, generate: () => "FMY-4K7P" });
    expect(issued).toEqual({ code: "FMY-4K7P", offerText: "Sobremesa cortesia", expiresAt: "2026-09-28T15:00:00.000Z" });
    expect(insertCode).toHaveBeenCalledWith(client, {
      code: "FMY-4K7P", place_id: "place-a", itinerary_id: "it-1", device_id: "device-123",
      offer_text: "Sobremesa cortesia", expires_at: "2026-09-28T15:00:00.000Z",
    });
  });

  it("returns the existing unused code for the same device and place", async () => {
    vi.mocked(findReusableCode).mockResolvedValue({
      code: "FMY-AAAA", offer_text: "Texto antigo", expires_at: "2026-09-28T10:00:00Z",
    } as never);
    await expect(issueCode(client, args)).resolves.toEqual({
      code: "FMY-AAAA", offerText: "Texto antigo", expiresAt: "2026-09-28T10:00:00Z",
    });
    expect(insertCode).not.toHaveBeenCalled();
  });

  it("retries with a new code on a collision", async () => {
    const codes = ["FMY-AAAA", "FMY-BBBB"];
    vi.mocked(insertCode)
      .mockRejectedValueOnce({ code: "23505" })
      .mockImplementationOnce(async (_c, row) => ({ ...row, id: "c2", created_at: "", redeemed_at: null, redeemed_by: null }));
    const issued = await issueCode(client, { ...args, generate: () => codes.shift()! });
    expect(issued.code).toBe("FMY-BBBB");
  });

  it("rethrows errors that aren't collisions", async () => {
    vi.mocked(insertCode).mockRejectedValue(new Error("db down"));
    await expect(issueCode(client, args)).rejects.toThrow("db down");
  });

  it("refuses places without a live offer", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "place-a", is_partner: false, is_verified: true, partner_offer: "Simulada" } as never);
    await expect(issueCode(client, args)).rejects.toBeInstanceOf(NoLiveOfferError);
  });

  it("refuses an unknown roteiro", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    await expect(issueCode(client, args)).rejects.toBeInstanceOf(RoteiroNotFoundError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/issueCode.test.ts`
Expected: FAIL — cannot resolve `./issueCode`.

- [ ] **Step 3: Implement `issueCode.ts`**

```ts
// src/lib/cortesia/issueCode.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById } from "@/lib/supabase/queries";
import { CODE_TTL_MS, generateCode } from "./code";
import { liveOfferText } from "./liveOffers";
import { findReusableCode, insertCode, isUniqueViolation } from "./queries";
import type { CourtesyCodeRow } from "./types";

const MAX_ATTEMPTS = 5;

export interface IssuedCode {
  code: string;
  offerText: string;
  expiresAt: string;
}

export class NoLiveOfferError extends Error {}
export class RoteiroNotFoundError extends Error {}

function toIssued(row: Pick<CourtesyCodeRow, "code" | "offer_text" | "expires_at">): IssuedCode {
  return { code: row.code, offerText: row.offer_text, expiresAt: row.expires_at };
}

export async function issueCode(
  client: SupabaseClient,
  {
    placeId,
    itinerarySlug,
    deviceId,
    now = new Date(),
    generate = () => generateCode(),
  }: { placeId: string; itinerarySlug: string; deviceId: string; now?: Date; generate?: () => string },
): Promise<IssuedCode> {
  const place = await getPlaceById(client, placeId);
  const offerText = place ? liveOfferText(place) : null;
  if (!offerText) throw new NoLiveOfferError(`Place ${placeId} has no live offer`);

  const itinerary = await getItineraryBySlug(client, itinerarySlug);
  if (!itinerary) throw new RoteiroNotFoundError(`Itinerary ${itinerarySlug} not found`);

  const existing = await findReusableCode(client, { deviceId, placeId, now });
  if (existing) return toIssued(existing);

  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const row = await insertCode(client, {
        code: generate(),
        place_id: placeId,
        itinerary_id: itinerary.id,
        device_id: deviceId,
        offer_text: offerText,
        expires_at: expiresAt,
      });
      return toIssued(row);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not generate a unique courtesy code");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/issueCode.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

```ts
// src/app/api/cortesia/route.test.ts
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

beforeEach(() => vi.mocked(issueCode).mockReset());

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
    vi.mocked(issueCode).mockRejectedValue(new Error("db down"));
    expect((await POST(post(valid))).status).toBe(502);
  });
});
```

```ts
// src/app/api/cortesia/[code]/route.test.ts
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

beforeEach(() => vi.mocked(findCodeByCode).mockReset());

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
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx vitest run src/app/api/cortesia`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 7: Implement the routes**

```ts
// src/app/api/cortesia/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { issueCode, NoLiveOfferError, RoteiroNotFoundError } from "@/lib/cortesia/issueCode";

const bodySchema = z.object({
  placeId: z.uuid(),
  itinerarySlug: z.string().trim().min(1).max(100),
  deviceId: z.string().trim().min(8).max(100),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    const issued = await issueCode(getSupabaseAdminClient(), parsed.data);
    return NextResponse.json(issued);
  } catch (error) {
    if (error instanceof NoLiveOfferError) {
      return NextResponse.json({ error: "Este estabelecimento não tem cortesia ativa." }, { status: 409 });
    }
    if (error instanceof RoteiroNotFoundError) {
      return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
    }
    console.error("Courtesy code issue failed", error);
    return NextResponse.json({ error: "Não foi possível gerar o código." }, { status: 502 });
  }
}
```

```ts
// src/app/api/cortesia/[code]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { normalizeCode } from "@/lib/cortesia/code";
import { findCodeByCode } from "@/lib/cortesia/queries";

const NOT_FOUND = { error: "Código não encontrado" };

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";
  const code = normalizeCode(rawCode);
  if (!code || !deviceId) return NextResponse.json(NOT_FOUND, { status: 404 });

  const row = await findCodeByCode(getSupabaseAdminClient(), code);
  // Only the device that generated the code may read its status.
  if (!row || row.device_id !== deviceId) return NextResponse.json(NOT_FOUND, { status: 404 });

  if (row.redeemed_at) return NextResponse.json({ status: "used", redeemedAt: row.redeemed_at });
  if (new Date(row.expires_at).getTime() <= Date.now()) return NextResponse.json({ status: "expired" });
  return NextResponse.json({ status: "active", expiresAt: row.expires_at });
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `npx vitest run src/lib/cortesia src/app/api/cortesia`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/cortesia/issueCode.ts src/lib/cortesia/issueCode.test.ts src/app/api/cortesia
git commit -m "feat(cortesia): issue courtesy codes and expose their status to the tourist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Tourist device storage + CourtesySheet

**Files:**
- Create: `src/lib/cortesia/deviceStorage.ts`, `src/components/roteiro/CourtesySheet.tsx`
- Test: `src/lib/cortesia/deviceStorage.test.ts`, `src/components/roteiro/CourtesySheet.test.tsx`

**Interfaces:**
- Consumes: `validityLabel`, `usedLabel` (Task 3); `POST /api/cortesia`, `GET /api/cortesia/[code]` (Task 6).
- Produces:
  - `interface CachedCode { code: string; offerText: string; expiresAt: string; redeemedAt: string | null }`
  - `getDeviceId(): string`, `readCachedCode(placeId: string, now?: Date): CachedCode | null`, `writeCachedCode(placeId: string, value: CachedCode): void`, `clearCachedCode(placeId: string): void`
  - `<CourtesySheet placeId placeName itinerarySlug onClose />`, a dialog labelled `Cortesia <placeName>`

- [ ] **Step 1: Write the failing storage tests**

```ts
// src/lib/cortesia/deviceStorage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getDeviceId, readCachedCode, writeCachedCode, clearCachedCode } from "./deviceStorage";

beforeEach(() => window.localStorage.clear());

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cortesia/deviceStorage.test.ts`
Expected: FAIL — cannot resolve `./deviceStorage`.

- [ ] **Step 3: Implement `deviceStorage.ts`**

```ts
// src/lib/cortesia/deviceStorage.ts
// Browser-only helpers. Storage can be blocked (private mode), so every access
// is guarded and the feature degrades to "works for this page view".
const DEVICE_KEY = "floripa_device_id";
let memoryDeviceId: string | null = null;

export interface CachedCode {
  code: string;
  offerText: string;
  expiresAt: string;
  redeemedAt: string | null;
}

function codeKey(placeId: string): string {
  return `floripa_cortesia_${placeId}`;
}

export function getDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
}

export function readCachedCode(placeId: string, now: Date = new Date()): CachedCode | null {
  try {
    const raw = window.localStorage.getItem(codeKey(placeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCode;
    if (typeof parsed?.code !== "string" || typeof parsed.expiresAt !== "string") return null;
    if (new Date(parsed.expiresAt).getTime() <= now.getTime()) return null;
    return { ...parsed, redeemedAt: parsed.redeemedAt ?? null };
  } catch {
    return null;
  }
}

export function writeCachedCode(placeId: string, value: CachedCode): void {
  try {
    window.localStorage.setItem(codeKey(placeId), JSON.stringify(value));
  } catch {
    // Storage blocked — the code still shows for this page view.
  }
}

export function clearCachedCode(placeId: string): void {
  try {
    window.localStorage.removeItem(codeKey(placeId));
  } catch {
    // Nothing to clear.
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/deviceStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing sheet tests**

```tsx
// src/components/roteiro/CourtesySheet.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CourtesySheet } from "./CourtesySheet";
import { writeCachedCode } from "@/lib/cortesia/deviceStorage";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

function renderSheet() {
  return render(<CourtesySheet placeId="place-a" placeName="Ostradamus" itinerarySlug="abc123" onClose={() => {}} />);
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CourtesySheet", () => {
  it("generates a code when there is none cached and caches it", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(200, { code: "FMY-4K7P", offerText: "Sobremesa cortesia", expiresAt: "2999-01-01T00:00:00Z" }));
    renderSheet();
    expect(await screen.findByText("FMY-4K7P")).toBeInTheDocument();
    expect(screen.getByText("Sobremesa cortesia")).toBeInTheDocument();
    expect(screen.getByText("Mostre este código no balcão")).toBeInTheDocument();
    expect(screen.getByText(/uso único/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cortesia");
    expect(JSON.parse(init.body)).toMatchObject({ placeId: "place-a", itinerarySlug: "abc123" });
    expect(window.localStorage.getItem("floripa_cortesia_place-a")).toContain("FMY-4K7P");
  });

  it("shows the cached code without generating a new one", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockReturnValueOnce(jsonResponse(200, { status: "active", expiresAt: "2999-01-01T00:00:00Z" }));
    renderSheet();
    expect(await screen.findByText("FMY-AAAA")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/cortesia\/FMY-AAAA\?deviceId=/);
  });

  it("keeps showing the cached code when offline", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderSheet();
    expect(await screen.findByText("FMY-AAAA")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("FMY-AAAA")).toBeInTheDocument();
  });

  it("shows the used state once the partner validated it", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockReturnValueOnce(jsonResponse(200, { status: "used", redeemedAt: "2026-09-27T16:10:00Z" }));
    renderSheet();
    expect(await screen.findByText("✓ Cortesia usada em 27/09")).toBeInTheDocument();
  });

  it("offers a retry when generation fails", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(502, { error: "x" }));
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    fetchMock.mockReturnValueOnce(jsonResponse(200, { code: "FMY-4K7P", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
```

Note on the retry test: the second mock is registered after the click but before the effect's fetch resolves, because the effect runs asynchronously after the state update. If it proves flaky, register both `mockReturnValueOnce` calls before rendering.

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/roteiro/CourtesySheet.test.tsx`
Expected: FAIL — cannot resolve `./CourtesySheet`.

- [ ] **Step 7: Implement `CourtesySheet.tsx`**

```tsx
// src/components/roteiro/CourtesySheet.tsx
"use client";

import { useEffect, useState } from "react";
import {
  clearCachedCode,
  getDeviceId,
  readCachedCode,
  writeCachedCode,
  type CachedCode,
} from "@/lib/cortesia/deviceStorage";
import { usedLabel, validityLabel } from "@/lib/cortesia/labels";

type SheetState = { kind: "loading" } | { kind: "ready"; code: CachedCode } | { kind: "error" };

async function requestNewCode(placeId: string, itinerarySlug: string): Promise<CachedCode | null> {
  const response = await fetch("/api/cortesia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, itinerarySlug, deviceId: getDeviceId() }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { code: string; offerText: string; expiresAt: string };
  const cached: CachedCode = { ...body, redeemedAt: null };
  writeCachedCode(placeId, cached);
  return cached;
}

export function CourtesySheet({
  placeId,
  placeName,
  itinerarySlug,
  onClose,
}: {
  placeId: string;
  placeName: string;
  itinerarySlug: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const show = (next: SheetState) => {
      if (!cancelled) setState(next);
    };

    async function issueFresh() {
      const fresh = await requestNewCode(placeId, itinerarySlug).catch(() => null);
      show(fresh ? { kind: "ready", code: fresh } : { kind: "error" });
    }

    async function run() {
      const cached = readCachedCode(placeId);
      if (!cached) {
        await issueFresh();
        return;
      }
      show({ kind: "ready", code: cached });
      if (cached.redeemedAt) return;
      try {
        const response = await fetch(
          `/api/cortesia/${encodeURIComponent(cached.code)}?deviceId=${encodeURIComponent(getDeviceId())}`,
        );
        if (response.status === 404) {
          clearCachedCode(placeId);
          await issueFresh();
          return;
        }
        if (!response.ok) return;
        const status = (await response.json()) as { status: string; redeemedAt?: string };
        if (status.status === "used" && status.redeemedAt) {
          const used = { ...cached, redeemedAt: status.redeemedAt };
          writeCachedCode(placeId, used);
          show({ kind: "ready", code: used });
        } else if (status.status === "expired") {
          clearCachedCode(placeId);
          await issueFresh();
        }
      } catch {
        // Offline at the venue: keep showing the cached code.
      }
    }

    setState({ kind: "loading" });
    void run();
    return () => {
      cancelled = true;
    };
  }, [placeId, itinerarySlug, attempt]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cortesia ${placeName}`}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-t-2xl bg-graphite p-6 text-center sm:rounded-2xl"
      >
        <div className="flex w-full items-start justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-coral">🎁 Cortesia Floripa.My</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-ink-dim hover:text-ink">
            ✕
          </button>
        </div>
        <h2 className="font-display text-lg font-extrabold text-ink">{placeName}</h2>

        {state.kind === "loading" && <p className="py-8 text-sm text-ink-dim">Gerando seu código...</p>}

        {state.kind === "error" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-ink-dim">
              Não foi possível gerar seu código. Verifique sua conexão e tente de novo.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-pill bg-turquoise px-4 py-2 text-sm font-bold text-graphite"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <p className="text-sm text-ink">{state.code.offerText}</p>
            <div
              className={`w-full rounded-card border-2 border-dashed py-5 font-display text-4xl font-extrabold tracking-[0.2em] ${
                state.code.redeemedAt ? "border-white/15 text-ink-dim line-through" : "border-coral text-ink"
              }`}
            >
              {state.code.code}
            </div>
            {state.code.redeemedAt ? (
              <p className="text-sm font-bold text-turquoise">{usedLabel(state.code.redeemedAt)}</p>
            ) : (
              <>
                <p className="text-sm font-bold text-ink">Mostre este código no balcão</p>
                <p className="text-xs text-ink-dim">
                  {validityLabel(state.code.expiresAt, new Date())} · uso único
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run src/lib/cortesia/deviceStorage.test.ts src/components/roteiro/CourtesySheet.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/cortesia/deviceStorage.ts src/lib/cortesia/deviceStorage.test.ts src/components/roteiro/CourtesySheet.tsx src/components/roteiro/CourtesySheet.test.tsx
git commit -m "feat(roteiro): courtesy code sheet with offline cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Wire the courtesy button into the roteiro

**Files:**
- Modify: `src/components/roteiro/DayCard.tsx` (remove `EXCLUSIVE_OFFER_PLACES`, add props, button, sheet)
- Modify: `src/components/roteiro/RoteiroView.tsx` (new `liveOffers` prop, pass to `DayCard`)
- Modify: `src/app/roteiro/[slug]/page.tsx` (compute `liveOfferMap(places)`)
- Test: `src/components/roteiro/DayCard.test.tsx`

**Interfaces:**
- Consumes: `liveOfferMap` (Task 4), `CourtesySheet` (Task 7).
- Produces: `DayCard` props `liveOffers?: Record<string, string>` and `itinerarySlug?: string`; `RoteiroView` prop `liveOffers?: Record<string, string>`.

- [ ] **Step 1: Replace the ribbon test and add button tests**

In `src/components/roteiro/DayCard.test.tsx`, replace the whole `it("shows the exclusive offer ribbon only for places on the offer list", ...)` block with:

```tsx
  it("shows the exclusive offer ribbon only for activities with a live offer", () => {
    render(<DayCard day={day} liveOffers={{ p2: "Sobremesa cortesia" }} />);
    expect(screen.getAllByText(/oferta exclusiva/i)).toHaveLength(1);
  });

  it("shows no ribbon when nothing has a live offer", () => {
    render(<DayCard day={day} />);
    expect(screen.queryByText(/oferta exclusiva/i)).not.toBeInTheDocument();
  });

  it("shows 'Resgate sua cortesia' only on activities with a live offer", () => {
    render(<DayCard day={day} liveOffers={{ p2: "Sobremesa cortesia" }} itinerarySlug="abc123" />);
    expect(screen.getAllByRole("button", { name: /resgate sua cortesia/i })).toHaveLength(1);
  });

  it("hides the courtesy button without an itinerary slug", () => {
    render(<DayCard day={day} liveOffers={{ p2: "Sobremesa cortesia" }} />);
    expect(screen.queryByRole("button", { name: /resgate sua cortesia/i })).not.toBeInTheDocument();
  });

  it("opens the courtesy sheet for that place when the button is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: "FMY-4K7P", offerText: "Sobremesa cortesia", expiresAt: "2999-01-01T00:00:00Z" }),
      }),
    );
    window.localStorage.clear();
    render(<DayCard day={day} liveOffers={{ p2: "Sobremesa cortesia" }} itinerarySlug="abc123" />);
    fireEvent.click(screen.getByRole("button", { name: /resgate sua cortesia/i }));
    expect(await screen.findByRole("dialog", { name: "Cortesia Ostradamus" })).toBeInTheDocument();
    expect(await screen.findByText("FMY-4K7P")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/roteiro/DayCard.test.tsx`
Expected: FAIL — the courtesy tests fail (no button, ribbon still keyed on names).

- [ ] **Step 3: Update `DayCard.tsx`**

1. Delete the line `const EXCLUSIVE_OFFER_PLACES = new Set(["Zilá", "Restaurante do Ceará"]);`.
2. Add the import next to the `SwapSheet` import:

```tsx
import { CourtesySheet } from "./CourtesySheet";
```

3. Change the `DayCard` signature to add the two props:

```tsx
export function DayCard({
  day,
  partners = [],
  places = [],
  liveOffers = {},
  itinerarySlug,
  onRemove,
  onAddActivity,
  onReplace,
}: {
  day: ItineraryDay;
  partners?: Place[];
  places?: Place[];
  liveOffers?: Record<string, string>;
  itinerarySlug?: string;
  onRemove?: (placeId: string) => void;
  onAddActivity?: (input: { name: string; time: string }) => void;
  onReplace?: (oldPlaceId: string, newPlaceId: string) => void;
}) {
```

4. Below `const [swapping, setSwapping] = ...` add:

```tsx
  const [redeeming, setRedeeming] = useState<ItineraryActivity | null>(null);
```

5. Replace the ribbon condition `{EXCLUSIVE_OFFER_PLACES.has(act.name) && (` with:

```tsx
                  {liveOffers[act.place_id] && (
```

6. Right after the closing `</div>` of the `mt-2 flex flex-wrap items-center gap-1.5` badges row (still inside `<div className="min-w-0 flex-1">`), add:

```tsx
                    {itinerarySlug && liveOffers[act.place_id] && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRedeeming(act);
                        }}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-pill bg-coral px-3 py-1.5 text-[11px] font-extrabold text-graphite print:hidden"
                      >
                        🎁 Resgate sua cortesia
                      </button>
                    )}
```

7. After the `{swapping && onReplace && (...)}` block, before `</section>`, add:

```tsx
      {redeeming && itinerarySlug && (
        <CourtesySheet
          placeId={redeeming.place_id}
          placeName={displayName(redeeming.name)}
          itinerarySlug={itinerarySlug}
          onClose={() => setRedeeming(null)}
        />
      )}
```

- [ ] **Step 4: Update `RoteiroView.tsx`**

Add `liveOffers = {}` to the destructured props and `liveOffers?: Record<string, string>;` to the props type, then pass two new props to `DayCard`:

```tsx
          <DayCard
            key={day.day_number}
            day={day}
            partners={partners}
            places={places}
            liveOffers={liveOffers}
            itinerarySlug={itinerary.slug}
            onRemove={(placeId) => handleRemove(day.day_number, placeId)}
            onAddActivity={(input) => handleAddActivity(day.day_number, input)}
            onReplace={(oldPlaceId, newPlaceId) => handleReplace(day.day_number, oldPlaceId, newPlaceId)}
          />
```

- [ ] **Step 5: Update the roteiro page**

In `src/app/roteiro/[slug]/page.tsx` add the import and prop:

```tsx
import { liveOfferMap } from "@/lib/cortesia/liveOffers";
```

```tsx
  return (
    <RoteiroView
      itinerary={itinerary}
      partners={partners}
      places={selectPublicPlaces(places)}
      liveOffers={liveOfferMap(places)}
      tips={tips}
    />
  );
```

(`liveOfferMap` reads the raw `places`, so the simulated offers that `selectPartners` injects never produce a button.)

- [ ] **Step 6: Run the roteiro tests**

Run: `npx vitest run src/components/roteiro src/app`
Expected: PASS.

- [ ] **Step 7: Visual check**

Check whether a dev server is already running (e.g. `netstat -ano | findstr :3000` in PowerShell). Reuse it if so; otherwise start `npm run dev`. The real button only appears for a verified partner with an offer, so for the screenshot temporarily pass `liveOffers={{ [someActivityPlaceId]: "Sobremesa cortesia" }}` in the page (don't commit that), open a roteiro (`npm run demo:itinerary` prints a URL), and screenshot at 390px and desktop width: the button on the card, and the sheet after tapping it (the sheet will show the error state without the migration — that's expected until Task 17; check layout only). Revert the temporary change.

- [ ] **Step 8: Commit**

```bash
git add src/components/roteiro/DayCard.tsx src/components/roteiro/DayCard.test.tsx src/components/roteiro/RoteiroView.tsx "src/app/roteiro/[slug]/page.tsx"
git commit -m "feat(roteiro): 'Resgate sua cortesia' button driven by live partner offers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Partner auth foundation

**Files:**
- Modify: `package.json` / `package-lock.json` (add `@supabase/ssr`)
- Modify: `.env.local.example`
- Create: `src/lib/parceiro/authEnv.ts`, `src/lib/parceiro/supabaseServer.ts`, `src/lib/parceiro/middlewareSession.ts`, `src/lib/parceiro/context.ts`, `src/lib/parceiro/safeNextPath.ts`
- Test: `src/lib/parceiro/context.test.ts`, `src/lib/parceiro/safeNextPath.test.ts`

**Interfaces:**
- Consumes: `listPartners` (`@/lib/supabase/queries`), `getSupabaseAdminClient`.
- Produces:
  - `getSupabaseAuthEnv(): { url: string; anonKey: string }`
  - `createPartnerServerClient(): Promise<SupabaseClient>` (cookie-bound, for route handlers and server components)
  - `refreshPartnerSession(request: NextRequest): Promise<{ userId: string | null; response: NextResponse }>`
  - `findPartnerPlaceByEmail(client: SupabaseClient, email: string): Promise<Place | null>`
  - `interface PartnerContext { userId: string; email: string; place: Place }`, `getPartnerContext(): Promise<PartnerContext | null>`
  - `safeNextPath(next: string | null | undefined): string` (defaults to `/parceiro`)

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/ssr`
Expected: added to `dependencies`.

- [ ] **Step 2: Document the new env vars**

Append to `.env.local.example`:

```
# Chave pública (anon) do Supabase — usada só no servidor para o login dos parceiros.
SUPABASE_ANON_KEY=

# Número de WhatsApp de suporte aos parceiros (só dígitos, com DDI e DDD, ex.: 5548999999999).
WHATSAPP_CONTATO=
```

- [ ] **Step 3: Write the failing tests**

```ts
// src/lib/parceiro/safeNextPath.test.ts
import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it.each([
    ["/parceiro", "/parceiro"],
    ["/parceiro/validar", "/parceiro/validar"],
  ])("keeps %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([null, undefined, "", "https://evil.com", "//evil.com", "/admin", "/parceiros/cadastro", "/parceiro/../admin", "/parceiro\\..\\admin"])(
    "falls back to /parceiro for %s",
    (input) => {
      expect(safeNextPath(input)).toBe("/parceiro");
    },
  );
});
```

```ts
// src/lib/parceiro/context.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ listPartners: vi.fn() }));
vi.mock("./supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));

import { findPartnerPlaceByEmail, getPartnerContext } from "./context";
import { listPartners } from "@/lib/supabase/queries";
import { createPartnerServerClient } from "./supabaseServer";

const box32 = { id: "place-a", name: "Box 32", contact_email: "carlos@box32.com" };

beforeEach(() => {
  vi.mocked(listPartners).mockReset().mockResolvedValue([
    { id: "place-b", name: "Outro", contact_email: null },
    box32,
  ] as never);
});

function sessionWith(user: { id: string; email?: string } | null) {
  vi.mocked(createPartnerServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as SupabaseClient);
}

describe("findPartnerPlaceByEmail", () => {
  it("matches ignoring case and surrounding spaces", async () => {
    await expect(findPartnerPlaceByEmail({} as SupabaseClient, " Carlos@BOX32.com ")).resolves.toEqual(box32);
  });

  it("returns null when no partner has that email", async () => {
    await expect(findPartnerPlaceByEmail({} as SupabaseClient, "ninguem@x.com")).resolves.toBeNull();
  });
});

describe("getPartnerContext", () => {
  it("returns the user and their place", async () => {
    sessionWith({ id: "user-1", email: "carlos@box32.com" });
    await expect(getPartnerContext()).resolves.toEqual({ userId: "user-1", email: "carlos@box32.com", place: box32 });
  });

  it("is null without a session", async () => {
    sessionWith(null);
    await expect(getPartnerContext()).resolves.toBeNull();
  });

  it("is null when the logged-in email is no longer a partner's", async () => {
    sessionWith({ id: "user-2", email: "ex-parceiro@x.com" });
    await expect(getPartnerContext()).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run src/lib/parceiro`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement**

```ts
// src/lib/parceiro/safeNextPath.ts
const DEFAULT_PATH = "/parceiro";

// Only ever redirect back into the partner portal after login.
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return DEFAULT_PATH;
  if (next !== DEFAULT_PATH && !next.startsWith(`${DEFAULT_PATH}/`)) return DEFAULT_PATH;
  if (next.includes("..") || next.includes("\\") || next.includes("//")) return DEFAULT_PATH;
  return next;
}
```

```ts
// src/lib/parceiro/authEnv.ts
export function getSupabaseAuthEnv(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  return { url, anonKey };
}
```

```ts
// src/lib/parceiro/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAuthEnv } from "./authEnv";

// Supabase Auth client bound to the request cookies — partner identity only.
// Data access still goes through getSupabaseAdminClient().
export async function createPartnerServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseAuthEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}
```

```ts
// src/lib/parceiro/middlewareSession.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthEnv } from "./authEnv";

// Refreshes the partner's Supabase session cookies (if any) and reports who is logged in.
export async function refreshPartnerSession(
  request: NextRequest,
): Promise<{ userId: string | null; response: NextResponse }> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseAuthEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { userId: user?.id ?? null, response };
}
```

```ts
// src/lib/parceiro/context.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPartners } from "@/lib/supabase/queries";
import type { Place } from "@/lib/supabase/types";
import { createPartnerServerClient } from "./supabaseServer";

export interface PartnerContext {
  userId: string;
  email: string;
  place: Place;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// One email = one establishment (chains are out of scope); the first match wins.
export async function findPartnerPlaceByEmail(client: SupabaseClient, email: string): Promise<Place | null> {
  const target = normalizeEmail(email);
  const partners = await listPartners(client);
  return partners.find((p) => p.contact_email && normalizeEmail(p.contact_email) === target) ?? null;
}

export async function getPartnerContext(): Promise<PartnerContext | null> {
  const supabase = await createPartnerServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const place = await findPartnerPlaceByEmail(getSupabaseAdminClient(), user.email);
  if (!place) return null;
  return { userId: user.id, email: user.email, place };
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/lib/parceiro && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.local.example src/lib/parceiro
git commit -m "feat(parceiro): Supabase Auth session helpers and partner lookup by email

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Middleware gate for the partner portal

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/middleware.test.ts`

**Interfaces:**
- Consumes: `refreshPartnerSession` (Task 9), existing admin helpers.
- Produces: async `middleware(request)`; public partner paths `/parceiro/entrar`, `/parceiro/auth/callback`, `/api/parceiro/login`.

- [ ] **Step 1: Rewrite the middleware tests**

Replace `src/middleware.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/parceiro/middlewareSession", () => ({ refreshPartnerSession: vi.fn() }));

import { middleware } from "./middleware";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";
import { refreshPartnerSession } from "@/lib/parceiro/middlewareSession";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
  vi.mocked(refreshPartnerSession).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function requestFor(path: string, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) headers.cookie = `${ADMIN_SESSION_COOKIE}=${cookieValue}`;
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

function partnerSession(userId: string | null) {
  vi.mocked(refreshPartnerSession).mockResolvedValue({ userId, response: NextResponse.next() });
}

describe("middleware — admin", () => {
  it("lets /admin/login through with no cookie", async () => {
    expect((await middleware(requestFor("/admin/login"))).status).toBe(200);
  });

  it("lets /api/admin/login through with no cookie", async () => {
    expect((await middleware(requestFor("/api/admin/login"))).status).toBe(200);
  });

  it("redirects an unauthenticated page request to /admin/login", async () => {
    const response = await middleware(requestFor("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("returns 401 for an unauthenticated API request", async () => {
    expect((await middleware(requestFor("/api/admin/places"))).status).toBe(401);
  });

  it("lets an authenticated page request through", async () => {
    expect((await middleware(requestFor("/admin", createAdminSessionToken()))).status).toBe(200);
  });

  it("lets an authenticated API request through", async () => {
    expect((await middleware(requestFor("/api/admin/places", createAdminSessionToken()))).status).toBe(200);
  });

  it("blocks a request with a tampered cookie", async () => {
    expect((await middleware(requestFor("/admin", "tampered"))).status).toBe(307);
  });

  it("never consults the partner session for admin paths", async () => {
    await middleware(requestFor("/admin"));
    expect(refreshPartnerSession).not.toHaveBeenCalled();
  });
});

describe("middleware — parceiro", () => {
  it.each(["/parceiro/entrar", "/parceiro/auth/callback", "/api/parceiro/login"])(
    "lets public path %s through without a session",
    async (path) => {
      expect((await middleware(requestFor(path))).status).toBe(200);
      expect(refreshPartnerSession).not.toHaveBeenCalled();
    },
  );

  it("redirects a logged-out page request to the login, remembering where it was going", async () => {
    partnerSession(null);
    const response = await middleware(requestFor("/parceiro/validar"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/parceiro/entrar?next=%2Fparceiro%2Fvalidar");
  });

  it("returns 401 for a logged-out API request", async () => {
    partnerSession(null);
    expect((await middleware(requestFor("/api/parceiro/validar"))).status).toBe(401);
  });

  it("lets a logged-in partner through", async () => {
    partnerSession("user-1");
    expect((await middleware(requestFor("/parceiro"))).status).toBe(200);
  });

  it("does not accept the admin cookie as a partner session", async () => {
    partnerSession(null);
    expect((await middleware(requestFor("/parceiro", createAdminSessionToken()))).status).toBe(307);
  });
});
```

- [ ] **Step 2: Run to verify the partner tests fail**

Run: `npx vitest run src/middleware.test.ts`
Expected: FAIL — partner paths go through the admin gate.

- [ ] **Step 3: Rewrite `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/adminAuth";
import { refreshPartnerSession } from "@/lib/parceiro/middlewareSession";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];
const PUBLIC_PARTNER_PATHS = ["/parceiro/entrar", "/parceiro/auth/callback", "/api/parceiro/login"];

function isPartnerPath(pathname: string): boolean {
  return pathname === "/parceiro" || pathname.startsWith("/parceiro/") || pathname.startsWith("/api/parceiro/");
}

function adminGate(request: NextRequest): NextResponse {
  if (PUBLIC_ADMIN_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (isValidAdminSession(cookie)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

async function partnerGate(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PARTNER_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const { userId, response } = await refreshPartnerSession(request);
  if (userId) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const login = new URL("/parceiro/entrar", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  return isPartnerPath(request.nextUrl.pathname) ? partnerGate(request) : adminGate(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/parceiro/:path*", "/api/parceiro/:path*"],
  // adminAuth.ts uses Node's `crypto` (createHash/timingSafeEqual), which
  // the default Edge Runtime doesn't support — run this middleware on the
  // Node.js runtime instead.
  runtime: "nodejs",
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat(parceiro): gate the partner portal with the Supabase session in middleware

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Magic-link login, callback, logout and the /parceiro/entrar page

**Files:**
- Create: `src/app/api/parceiro/login/route.ts`, `src/app/api/parceiro/logout/route.ts`, `src/app/parceiro/auth/callback/route.ts`, `src/app/parceiro/entrar/page.tsx`, `src/components/parceiro/PartnerLoginForm.tsx`
- Test: `src/app/api/parceiro/login/route.test.ts`, `src/app/parceiro/auth/callback/route.test.ts`, `src/components/parceiro/PartnerLoginForm.test.tsx`

**Interfaces:**
- Consumes: `createPartnerServerClient`, `findPartnerPlaceByEmail`, `safeNextPath` (Task 9).
- Produces:
  - `POST /api/parceiro/login` body `{ email, next? }` → 200 `{ ok: true }` always for a valid email (never reveals partners), 400 for an invalid email.
  - `GET /parceiro/auth/callback?token_hash=&type=email&next=` → redirect to `next` on success, else to `/parceiro/entrar?erro=link`.
  - `POST /api/parceiro/logout` → 200 `{ ok: true }`.
  - `<PartnerLoginForm next linkError whatsapp />`.

The magic-link email template is changed by the founder (Task 17) to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`. `emailRedirectTo` therefore always carries a `?next=` query so the `&` is valid.

- [ ] **Step 1: Write the failing route tests**

```ts
// src/app/api/parceiro/login/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ findPartnerPlaceByEmail: vi.fn() }));
vi.mock("@/lib/parceiro/supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));

import { POST } from "./route";
import { findPartnerPlaceByEmail } from "@/lib/parceiro/context";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";

const signInWithOtp = vi.fn();

function post(body: unknown) {
  return new Request("https://floripa.my/api/parceiro/login", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
  vi.mocked(createPartnerServerClient).mockResolvedValue({ auth: { signInWithOtp } } as never);
  vi.mocked(findPartnerPlaceByEmail).mockReset();
});

describe("POST /api/parceiro/login", () => {
  it("sends a magic link to a partner email, pointing at the callback with next", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    const response = await POST(post({ email: " carlos@box32.com ", next: "/parceiro/validar" }));
    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "carlos@box32.com",
      options: {
        emailRedirectTo: "https://floripa.my/parceiro/auth/callback?next=%2Fparceiro%2Fvalidar",
        shouldCreateUser: true,
      },
    });
  });

  it("answers the same way for a non-partner email, without sending anything", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue(null);
    const response = await POST(post({ email: "curioso@x.com" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("ignores an off-site next", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    await POST(post({ email: "carlos@box32.com", next: "https://evil.com" }));
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://floripa.my/parceiro/auth/callback?next=%2Fparceiro",
    );
  });

  it("still answers ok when sending fails (logged, not revealed)", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    signInWithOtp.mockResolvedValue({ error: new Error("rate limited") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(post({ email: "carlos@box32.com" }))).status).toBe(200);
  });

  it("returns 400 for an invalid email", async () => {
    expect((await POST(post({ email: "nao-e-email" }))).status).toBe(400);
  });
});
```

```ts
// src/app/parceiro/auth/callback/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/parceiro/supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));

import { GET } from "./route";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";

const verifyOtp = vi.fn();

beforeEach(() => {
  verifyOtp.mockReset();
  vi.mocked(createPartnerServerClient).mockResolvedValue({ auth: { verifyOtp } } as never);
});

describe("GET /parceiro/auth/callback", () => {
  it("verifies the token and redirects to next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro%2Fvalidar&token_hash=abc&type=email"),
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/validar");
  });

  it("sends an invalid or expired link back to the login with an error", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro&token_hash=abc&type=email"));
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/entrar?erro=link");
  });

  it("rejects a link without a token", async () => {
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro"));
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/entrar?erro=link");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("never redirects off-site", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new Request("https://floripa.my/parceiro/auth/callback?next=https%3A%2F%2Fevil.com&token_hash=abc&type=email"),
    );
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/app/api/parceiro/login src/app/parceiro/auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the routes**

```ts
// src/app/api/parceiro/login/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { findPartnerPlaceByEmail } from "@/lib/parceiro/context";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!z.email().safeParse(email).success) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }
  const next = safeNextPath(typeof body?.next === "string" ? body.next : null);

  // Same answer whether or not the email belongs to a partner — never reveal who is one.
  try {
    const place = await findPartnerPlaceByEmail(getSupabaseAdminClient(), email);
    if (place) {
      const supabase = await createPartnerServerClient();
      const origin = new URL(request.url).origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/parceiro/auth/callback?next=${encodeURIComponent(next)}`,
          shouldCreateUser: true,
        },
      });
      if (error) console.error("Partner magic link failed", error);
    }
  } catch (error) {
    console.error("Partner login failed", error);
  }
  return NextResponse.json({ ok: true });
}
```

```ts
// src/app/parceiro/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";

// token_hash flow (not PKCE) so the link works even when opened on a
// different device than the one that asked for it.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));

  if (tokenHash && type === "email") {
    const supabase = await createPartnerServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/parceiro/entrar?erro=link", url.origin));
}
```

```ts
// src/app/api/parceiro/logout/route.ts
import { NextResponse } from "next/server";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";

export async function POST() {
  const supabase = await createPartnerServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run to verify the routes pass**

Run: `npx vitest run src/app/api/parceiro/login src/app/parceiro/auth`
Expected: PASS.

- [ ] **Step 5: Write the failing login form test**

```tsx
// src/components/parceiro/PartnerLoginForm.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PartnerLoginForm } from "./PartnerLoginForm";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("PartnerLoginForm", () => {
  it("sends the email with next and shows the neutral confirmation", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<PartnerLoginForm next="/parceiro/validar" linkError={false} whatsapp="5548999999999" />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "carlos@box32.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    expect(await screen.findByText("Enviamos um link de acesso para seu e-mail.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "carlos@box32.com", next: "/parceiro/validar" });
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/5548999999999");
  });

  it("hides the WhatsApp link when no number is configured", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<PartnerLoginForm next="/parceiro" linkError={false} />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "carlos@box32.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    await screen.findByText("Enviamos um link de acesso para seu e-mail.");
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it("explains an invalid email", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    render(<PartnerLoginForm next="/parceiro" linkError={false} />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "x@y" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    expect(await screen.findByText("Confira o e-mail digitado.")).toBeInTheDocument();
  });

  it("tells the partner when the link they used expired", () => {
    render(<PartnerLoginForm next="/parceiro" linkError />);
    expect(screen.getByText("Esse link expirou ou já foi usado. Peça um novo abaixo.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/parceiro/PartnerLoginForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the form and the page**

```tsx
// src/components/parceiro/PartnerLoginForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

type Phase = "idle" | "sending" | "sent" | "invalid";

export function PartnerLoginForm({
  next,
  linkError,
  whatsapp,
}: {
  next: string;
  linkError: boolean;
  whatsapp?: string;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPhase("sending");
    const response = await fetch("/api/parceiro/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    }).catch(() => null);
    setPhase(response?.status === 400 ? "invalid" : "sent");
  }

  if (phase === "sent") {
    return (
      <div className="my-auto flex w-full max-w-sm flex-col gap-3 text-center">
        <p className="text-4xl" aria-hidden>
          📬
        </p>
        <h1 className="font-display text-xl font-extrabold text-teal-ink">Enviamos um link de acesso para seu e-mail.</h1>
        <p className="text-sm text-teal-ink/60">Abra o e-mail neste aparelho para entrar.</p>
        <p className="text-sm text-teal-ink/60">
          Não recebeu? Confira a caixa de spam
          {whatsapp && (
            <>
              {" "}ou{" "}
              <a href={`https://wa.me/${whatsapp}`} className="font-bold text-turquoise-deep underline">
                fale com a gente no WhatsApp
              </a>
            </>
          )}
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="my-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-center font-display text-2xl font-extrabold text-teal-ink">Portal do Parceiro</h1>
      <p className="text-center text-sm text-teal-ink/60">Digite o e-mail cadastrado do seu estabelecimento.</p>
      {linkError && (
        <p className="rounded-card bg-coral/10 p-3 text-center text-sm text-coral-deep">
          Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
      />
      {phase === "invalid" && <p className="text-sm text-coral">Confira o e-mail digitado.</p>}
      <Button type="submit" size="sm" disabled={phase === "sending"} className="self-center">
        {phase === "sending" ? "Enviando..." : "Receber link de acesso"}
      </Button>
    </form>
  );
}
```

```tsx
// src/app/parceiro/entrar/page.tsx
import { BrandWordmark } from "@/components/clube/BrandWordmark";
import { PartnerLoginForm } from "@/components/parceiro/PartnerLoginForm";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center bg-sand p-6">
      <header className="flex w-full justify-center py-2">
        <BrandWordmark />
      </header>
      <PartnerLoginForm
        next={safeNextPath(next)}
        linkError={erro === "link"}
        whatsapp={process.env.WHATSAPP_CONTATO || undefined}
      />
    </main>
  );
}
```

- [ ] **Step 8: Run to verify everything passes**

Run: `npx vitest run src/app/api/parceiro src/app/parceiro src/components/parceiro`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/parceiro/login src/app/api/parceiro/logout src/app/parceiro src/components/parceiro
git commit -m "feat(parceiro): magic-link login, callback, logout and login page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Validate and confirm codes (API + /parceiro/validar)

**Files:**
- Create: `src/app/api/parceiro/validar/route.ts`, `src/app/api/parceiro/confirmar/route.ts`, `src/components/parceiro/PartnerShell.tsx`, `src/components/parceiro/ValidateCodeForm.tsx`, `src/app/parceiro/validar/page.tsx`
- Test: `src/app/api/parceiro/validar/route.test.ts`, `src/app/api/parceiro/confirmar/route.test.ts`, `src/components/parceiro/ValidateCodeForm.test.tsx`

**Interfaces:**
- Consumes: `getPartnerContext` (Task 9); `normalizeCode`, `checkCode`, `checkMessage`, `CheckResult` (Task 3); `findCodeByCode`, `redeemCode` (Task 5).
- Produces:
  - `POST /api/parceiro/validar` body `{ code }` → 200 `{ result: CheckResult; message: string }` | 401
  - `POST /api/parceiro/confirmar` body `{ code }` → 200 `{ ok: true; offerText: string }` | 409 `{ result: CheckResult; message: string }` | 401
  - `<PartnerShell placeName plan active="painel" | "validar">children</PartnerShell>`
  - `<ValidateCodeForm />`

- [ ] **Step 1: Write the failing route tests**

```ts
// src/app/api/parceiro/validar/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));
vi.mock("@/lib/cortesia/queries", () => ({ findCodeByCode: vi.fn() }));

import { POST } from "./route";
import { getPartnerContext } from "@/lib/parceiro/context";
import { findCodeByCode } from "@/lib/cortesia/queries";

const ctx = { userId: "user-1", email: "carlos@box32.com", place: { id: "place-a" } };

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/validar", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPartnerContext).mockReset().mockResolvedValue(ctx as never);
  vi.mocked(findCodeByCode).mockReset();
});

describe("POST /api/parceiro/validar", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ code: "FMY-4K7P" }))).status).toBe(401);
  });

  it("checks a typed code (any case, with or without prefix) without redeeming it", async () => {
    vi.mocked(findCodeByCode).mockResolvedValue({
      code: "FMY-4K7P", place_id: "place-a", redeemed_at: null, expires_at: "2999-01-01T00:00:00Z", offer_text: "Sobremesa",
    } as never);
    const response = await POST(post({ code: "4k7p" }));
    expect(findCodeByCode).toHaveBeenCalledWith(expect.anything(), "FMY-4K7P");
    expect(await response.json()).toEqual({
      result: { status: "valid", offerText: "Sobremesa" },
      message: "Código válido: Sobremesa",
    });
  });

  it("reports not_found for garbage without querying", async () => {
    const response = await POST(post({ code: "???" }));
    expect((await response.json()).result).toEqual({ status: "not_found" });
    expect(findCodeByCode).not.toHaveBeenCalled();
  });
});
```

```ts
// src/app/api/parceiro/confirmar/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));
vi.mock("@/lib/cortesia/queries", () => ({ findCodeByCode: vi.fn(), redeemCode: vi.fn() }));

import { POST } from "./route";
import { getPartnerContext } from "@/lib/parceiro/context";
import { findCodeByCode, redeemCode } from "@/lib/cortesia/queries";

const ctx = { userId: "user-1", email: "carlos@box32.com", place: { id: "place-a" } };

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/confirmar", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPartnerContext).mockReset().mockResolvedValue(ctx as never);
  vi.mocked(findCodeByCode).mockReset();
  vi.mocked(redeemCode).mockReset();
});

describe("POST /api/parceiro/confirmar", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ code: "FMY-4K7P" }))).status).toBe(401);
    expect(redeemCode).not.toHaveBeenCalled();
  });

  it("redeems the code for the logged-in place and user", async () => {
    vi.mocked(redeemCode).mockResolvedValue({ offer_text: "Sobremesa" } as never);
    const response = await POST(post({ code: "fmy-4k7p" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, offerText: "Sobremesa" });
    expect(redeemCode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "FMY-4K7P", placeId: "place-a", userId: "user-1" }));
  });

  it("returns 409 with the 'already used' message when a concurrent confirm won", async () => {
    vi.mocked(redeemCode).mockResolvedValue(null);
    vi.mocked(findCodeByCode).mockResolvedValue({
      place_id: "place-a", redeemed_at: "2026-09-27T16:10:00Z", expires_at: "2999-01-01T00:00:00Z", offer_text: "Sobremesa",
    } as never);
    const response = await POST(post({ code: "FMY-4K7P" }));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe("Este código já foi usado em 27/09 às 13h10.");
  });

  it("returns 409 not_found for a malformed code", async () => {
    const response = await POST(post({ code: "nope" }));
    expect(response.status).toBe(409);
    expect((await response.json()).result).toEqual({ status: "not_found" });
    expect(redeemCode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/app/api/parceiro/validar src/app/api/parceiro/confirmar`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the routes**

```ts
// src/app/api/parceiro/validar/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { normalizeCode } from "@/lib/cortesia/code";
import { checkCode, checkMessage } from "@/lib/cortesia/checkCode";
import { findCodeByCode } from "@/lib/cortesia/queries";

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = normalizeCode(typeof body?.code === "string" ? body.code : "");
  const row = code ? await findCodeByCode(getSupabaseAdminClient(), code) : null;
  const result = checkCode(row, ctx.place.id, new Date());
  return NextResponse.json({ result, message: checkMessage(result) });
}
```

```ts
// src/app/api/parceiro/confirmar/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { normalizeCode } from "@/lib/cortesia/code";
import { checkCode, checkMessage, type CheckResult } from "@/lib/cortesia/checkCode";
import { findCodeByCode, redeemCode } from "@/lib/cortesia/queries";

function conflict(result: CheckResult) {
  // A "valid" re-check after a failed redeem means a transient failure, not a usable code.
  const message = result.status === "valid" ? "Não foi possível confirmar. Tente de novo." : checkMessage(result);
  return NextResponse.json({ result, message }, { status: 409 });
}

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = normalizeCode(typeof body?.code === "string" ? body.code : "");
  if (!code) return conflict({ status: "not_found" });

  const client = getSupabaseAdminClient();
  const now = new Date();
  const redeemed = await redeemCode(client, { code, placeId: ctx.place.id, userId: ctx.userId, now });
  if (redeemed) return NextResponse.json({ ok: true, offerText: redeemed.offer_text });

  const row = await findCodeByCode(client, code);
  return conflict(checkCode(row, ctx.place.id, now));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/app/api/parceiro/validar src/app/api/parceiro/confirmar`
Expected: PASS.

- [ ] **Step 5: Write the failing form test**

```tsx
// src/components/parceiro/ValidateCodeForm.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ValidateCodeForm } from "./ValidateCodeForm";

const fetchMock = vi.fn();
function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function typeAndCheck(code: string) {
  fireEvent.change(screen.getByLabelText("Código do cliente"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));
}

describe("ValidateCodeForm", () => {
  it("checks, then confirms in a second step", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa cortesia" }, message: "Código válido: Sobremesa cortesia" }));
    render(<ValidateCodeForm />);
    typeAndCheck("4k7p");
    expect(await screen.findByText("Sobremesa cortesia")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReturnValueOnce(respond(200, { ok: true, offerText: "Sobremesa cortesia" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText(/cortesia entregue/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/parceiro/confirmar");
  });

  it("shows the problem message for an invalid code, with no confirm button", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "expired" }, message: "Código expirado. Peça ao cliente para gerar um novo no app." }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    expect(await screen.findByText("Código expirado. Peça ao cliente para gerar um novo no app.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar entrega" })).not.toBeInTheDocument();
  });

  it("shows the conflict message when confirming loses a race", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa" }, message: "Código válido: Sobremesa" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await screen.findByRole("button", { name: "Confirmar entrega" });
    fetchMock.mockReturnValueOnce(respond(409, { result: { status: "used", redeemedAt: "2026-09-27T16:10:00Z" }, message: "Este código já foi usado em 27/09 às 13h10." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText("Este código já foi usado em 27/09 às 13h10.")).toBeInTheDocument();
  });

  it("sends a logged-out partner to the login", async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: "Não autenticado" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/parceiro/entrar?next=%2Fparceiro%2Fvalidar"));
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/parceiro/ValidateCodeForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `PartnerShell`, `ValidateCodeForm` and the page**

```tsx
// src/components/parceiro/PartnerShell.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandWordmark } from "@/components/clube/BrandWordmark";

export function PartnerShell({
  placeName,
  plan,
  active,
  children,
}: {
  placeName: string;
  plan: string | null;
  active: "painel" | "validar";
  children: ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/parceiro/logout", { method: "POST" });
    router.push("/parceiro/entrar");
  }

  const tabClass = (tab: "painel" | "validar") =>
    `rounded-pill px-4 py-2 text-sm font-bold ${active === tab ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"}`;

  return (
    <main className="min-h-dvh bg-sand p-4 text-teal-ink sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <BrandWordmark />
            <span className="text-xs font-semibold text-teal-ink/60">Portal do Parceiro</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-pill bg-teal-ink/10 px-3 py-1 text-xs font-bold text-teal-ink"
          >
            Sair
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold">{placeName}</h1>
          {plan && (
            <span className="rounded-pill bg-coral/15 px-2.5 py-1 text-[11px] font-bold text-coral-deep">⭐ Plano {plan}</span>
          )}
        </div>
        <nav className="flex gap-2">
          <Link href="/parceiro" className={tabClass("painel")}>
            📊 Painel
          </Link>
          <Link href="/parceiro/validar" className={tabClass("validar")}>
            ✅ Validar código
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
```

```tsx
// src/components/parceiro/ValidateCodeForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CheckResult } from "@/lib/cortesia/checkCode";

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "checked"; code: string; result: CheckResult; message: string }
  | { kind: "confirmed"; offerText: string };

const LOGIN_PATH = `/parceiro/entrar?next=${encodeURIComponent("/parceiro/validar")}`;

export function ValidateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function post(path: string, value: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    if (response.status === 401) {
      router.push(LOGIN_PATH);
      return null;
    }
    return { status: response.status, body: await response.json() };
  }

  async function handleCheck(event: FormEvent) {
    event.preventDefault();
    setPhase({ kind: "busy" });
    const answer = await post("/api/parceiro/validar", code);
    if (!answer) return;
    setPhase({ kind: "checked", code, result: answer.body.result, message: answer.body.message });
  }

  async function handleConfirm(checkedCode: string) {
    setPhase({ kind: "busy" });
    const answer = await post("/api/parceiro/confirmar", checkedCode);
    if (!answer) return;
    if (answer.status === 200) {
      setPhase({ kind: "confirmed", offerText: answer.body.offerText });
      return;
    }
    setPhase({ kind: "checked", code: checkedCode, result: answer.body.result, message: answer.body.message });
  }

  function reset() {
    setCode("");
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "confirmed") {
    return (
      <section className="flex flex-col items-center gap-3 rounded-card border border-turquoise/30 bg-white p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <p className="font-display text-lg font-extrabold">Cortesia entregue!</p>
        <p className="text-sm text-teal-ink/70">
          {phase.offerText} — a visita foi registrada no seu painel.
        </p>
        <button type="button" onClick={reset} className="rounded-pill bg-teal-ink px-5 py-2 text-sm font-bold text-sand">
          Validar outro código
        </button>
      </section>
    );
  }

  const checked = phase.kind === "checked" ? phase : null;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-teal-ink/10 bg-white p-5">
      <form onSubmit={handleCheck} className="flex flex-col gap-3">
        <label htmlFor="codigo" className="text-sm font-bold">
          Código do cliente
        </label>
        <input
          id="codigo"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="FMY-4K7P"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-card border border-teal-ink/15 px-4 py-4 text-center font-display text-3xl font-extrabold tracking-[0.2em] placeholder:text-teal-ink/20"
        />
        <button
          type="submit"
          disabled={!code.trim() || phase.kind === "busy"}
          className="rounded-pill bg-teal-ink px-5 py-3 text-sm font-bold text-sand disabled:opacity-40"
        >
          Verificar código
        </button>
      </form>

      {checked && checked.result.status === "valid" && (
        <div className="flex flex-col gap-3 rounded-card bg-turquoise/10 p-4">
          <p className="text-sm">
            ✅ Código válido: <strong>{checked.result.offerText}</strong>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex-1 rounded-pill bg-white py-2 text-sm font-bold text-teal-ink/60">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleConfirm(checked.code)}
              className="flex-1 rounded-pill bg-turquoise-deep py-2 text-sm font-bold text-white"
            >
              Confirmar entrega
            </button>
          </div>
        </div>
      )}

      {checked && checked.result.status !== "valid" && (
        <p className="rounded-card bg-coral/10 p-4 text-sm text-coral-deep">{checked.message}</p>
      )}
    </section>
  );
}
```

```tsx
// src/app/parceiro/validar/page.tsx
import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/parceiro/context";
import { PartnerShell } from "@/components/parceiro/PartnerShell";
import { ValidateCodeForm } from "@/components/parceiro/ValidateCodeForm";

export const dynamic = "force-dynamic";

export default async function ValidarPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect(`/parceiro/entrar?next=${encodeURIComponent("/parceiro/validar")}`);
  return (
    <PartnerShell placeName={ctx.place.name} plan={ctx.place.partner_plan} active="validar">
      <ValidateCodeForm />
    </PartnerShell>
  );
}
```

- [ ] **Step 8: Run to verify everything passes**

Run: `npx vitest run src/app/api/parceiro src/components/parceiro && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/parceiro/validar src/app/api/parceiro/confirmar src/components/parceiro/PartnerShell.tsx src/components/parceiro/ValidateCodeForm.tsx src/components/parceiro/ValidateCodeForm.test.tsx src/app/parceiro/validar
git commit -m "feat(parceiro): two-step code validation for the counter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: Dashboard data (summary, aggregation, loading)

**Files:**
- Create: `src/lib/parceiro/roteiroSummary.ts`, `src/lib/parceiro/dashboard.ts`, `src/lib/parceiro/queries.ts`, `src/lib/parceiro/loadDashboard.ts`
- Test: `src/lib/parceiro/roteiroSummary.test.ts`, `src/lib/parceiro/dashboard.test.ts`, `src/lib/parceiro/loadDashboard.test.ts`

**Interfaces:**
- Consumes: `CourtesyCodeRow` (Task 1); `saoPauloParts`, `dayKey`, `monthStart` (Task 2); `relativeTime` (Task 3); `listRedeemedCodes`, `hasEverRedeemed` (Task 5); `liveOfferText` (Task 4).
- Produces:
  - `GROUP_OPTIONS: readonly { value: string; label: string; emoji: string }[]`, `roteiroSummary(answers: Record<string, unknown>): string`
  - `interface AppearanceRow { id: string; created_at: string; quiz_answers: Record<string, unknown> }`
  - `type VisitsMode = "full" | "banner" | "upsell"`
  - `interface Dashboard { visitsThisMonth: number; visitsLastMonth: number; visitsPerDay: DayCount[]; latestVisits: { redeemedAt: string; offerText: string }[]; appearancesThisMonth: number; appearancesPerDay: DayCount[]; conversionRate: number | null; visitorProfile: ProfileSlice[]; recentRoteiros: RecentRoteiro[]; visitsMode: VisitsMode }`
  - `interface DayCount { dayKey: string; label: string; count: number }`, `interface ProfileSlice { group: string; label: string; emoji: string; count: number }`, `interface RecentRoteiro { id: string; summary: string; when: string; redeemed: boolean }`
  - `buildDashboard(input: DashboardInput): Dashboard`
  - `listItinerariesWithPlace(client, placeId, since: Date): Promise<AppearanceRow[]>`, `getQuizAnswersByIds(client, ids: string[]): Promise<Record<string, Record<string, unknown>>>`
  - `loadDashboard(client, place: Place, now?: Date): Promise<Dashboard>`

- [ ] **Step 1: Write the failing summary test**

```ts
// src/lib/parceiro/roteiroSummary.test.ts
import { describe, it, expect } from "vitest";
import { roteiroSummary } from "./roteiroSummary";

describe("roteiroSummary", () => {
  it("summarizes group, length and up to two styles", () => {
    expect(roteiroSummary({ group: "casal", days: "3-4", style: ["gastronomia", "praia", "noite"] })).toBe(
      "Casal · 3 a 4 dias · Gastronomia & Praia",
    );
  });

  it("skips missing or unknown pieces", () => {
    expect(roteiroSummary({ group: "familia" })).toBe("Família");
    expect(roteiroSummary({ group: "???", days: "1" })).toBe("1 dia");
  });

  it("falls back to a generic label", () => {
    expect(roteiroSummary({})).toBe("Roteiro");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/parceiro/roteiroSummary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `roteiroSummary.ts`**

```ts
// src/lib/parceiro/roteiroSummary.ts
// Anonymous, partner-facing description of a tourist's quiz answers.
export const GROUP_OPTIONS = [
  { value: "casal", label: "Casal", emoji: "💑" },
  { value: "familia", label: "Família", emoji: "👨‍👩‍👧" },
  { value: "amigos", label: "Amigos", emoji: "🎉" },
  { value: "solo", label: "Solo", emoji: "🙋" },
] as const;

const DAYS_LABEL: Record<string, string> = { "1": "1 dia", "2": "2 dias", "3-4": "3 a 4 dias", "5+": "5+ dias" };

const STYLE_LABEL: Record<string, string> = {
  praia: "Praia",
  gastronomia: "Gastronomia",
  compras: "Compras",
  cultura: "Cultura",
  noite: "Balada",
};

const MAX_STYLES = 2;

export function roteiroSummary(answers: Record<string, unknown>): string {
  const group = GROUP_OPTIONS.find((g) => g.value === answers.group)?.label;
  const days = typeof answers.days === "string" ? DAYS_LABEL[answers.days] : undefined;
  const styles = Array.isArray(answers.style)
    ? answers.style
        .map((s) => (typeof s === "string" ? STYLE_LABEL[s] : undefined))
        .filter((s): s is string => Boolean(s))
        .slice(0, MAX_STYLES)
        .join(" & ")
    : "";
  const parts = [group, days, styles].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : "Roteiro";
}
```

- [ ] **Step 4: Write the failing dashboard test**

```ts
// src/lib/parceiro/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { buildDashboard, type AppearanceRow } from "./dashboard";
import type { CourtesyCodeRow } from "@/lib/cortesia/types";

// 27 Sep 2026, 12:00 in São Paulo.
const now = new Date("2026-09-27T15:00:00Z");

function redeemed(redeemedAt: string, itineraryId: string | null = null, offer = "Sobremesa"): CourtesyCodeRow {
  return {
    id: redeemedAt, code: "FMY-AAAA", place_id: "place-a", itinerary_id: itineraryId, device_id: "d",
    offer_text: offer, created_at: redeemedAt, expires_at: redeemedAt, redeemed_at: redeemedAt, redeemed_by: "u",
  };
}

function appearance(id: string, createdAt: string, answers: Record<string, unknown> = {}): AppearanceRow {
  return { id, created_at: createdAt, quiz_answers: answers };
}

const base = { now, redeemed: [], appearances: [], visitorAnswers: {}, hasLiveOffer: true, everRedeemed: false };

describe("buildDashboard", () => {
  it("splits visits into this month and last month using São Paulo time", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [
        redeemed("2026-09-10T15:00:00Z"),
        // 02:30 UTC on Sep 1st is still Aug 31st in São Paulo → last month.
        redeemed("2026-09-01T02:30:00Z"),
        redeemed("2026-08-15T15:00:00Z"),
      ],
    });
    expect(dashboard.visitsThisMonth).toBe(1);
    expect(dashboard.visitsLastMonth).toBe(2);
  });

  it("counts visits per day from day 1 to today", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z"), redeemed("2026-09-10T18:00:00Z")],
    });
    expect(dashboard.visitsPerDay).toHaveLength(27);
    expect(dashboard.visitsPerDay[9]).toEqual({ dayKey: "2026-09-10", label: "10", count: 2 });
    expect(dashboard.visitsPerDay[0].count).toBe(0);
  });

  it("computes conversion as this month's visits over this month's appearances", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z")],
      appearances: [
        appearance("r1", "2026-09-05T12:00:00Z"),
        appearance("r2", "2026-09-06T12:00:00Z"),
        appearance("r3", "2026-09-07T12:00:00Z"),
        appearance("r4", "2026-09-08T12:00:00Z"),
        appearance("old", "2026-08-20T12:00:00Z"),
      ],
    });
    expect(dashboard.appearancesThisMonth).toBe(4);
    expect(dashboard.conversionRate).toBe(0.25);
  });

  it("has no conversion rate without appearances", () => {
    expect(buildDashboard(base).conversionRate).toBeNull();
  });

  it("profiles who actually came, from the roteiro behind each redeemed code", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [
        redeemed("2026-09-10T15:00:00Z", "r1"),
        redeemed("2026-09-11T15:00:00Z", "r2"),
        redeemed("2026-09-12T15:00:00Z", "r3"),
        redeemed("2026-09-13T15:00:00Z", null),
      ],
      visitorAnswers: { r1: { group: "casal" }, r2: { group: "casal" }, r3: { group: "familia" } },
    });
    expect(dashboard.visitorProfile).toEqual([
      { group: "casal", label: "Casal", emoji: "💑", count: 2 },
      { group: "familia", label: "Família", emoji: "👨‍👩‍👧", count: 1 },
    ]);
  });

  it("lists recent roteiros newest first, marking the ones whose code was redeemed", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-26T15:00:00Z", "r2")],
      appearances: [
        appearance("r1", "2026-09-20T12:00:00Z", { group: "solo" }),
        appearance("r2", "2026-09-27T14:46:00Z", { group: "casal", days: "3-4", style: ["gastronomia", "praia"] }),
      ],
    });
    expect(dashboard.recentRoteiros[0]).toEqual({
      id: "r2", summary: "Casal · 3 a 4 dias · Gastronomia & Praia", when: "há 14 min", redeemed: true,
    });
    expect(dashboard.recentRoteiros[1]).toMatchObject({ id: "r1", redeemed: false });
  });

  it("lists the latest visits newest first", () => {
    const dashboard = buildDashboard({
      ...base,
      redeemed: [redeemed("2026-09-10T15:00:00Z", null, "A"), redeemed("2026-09-20T15:00:00Z", null, "B")],
    });
    expect(dashboard.latestVisits.map((v) => v.offerText)).toEqual(["B", "A"]);
  });

  it.each([
    [true, false, "full"],
    [true, true, "full"],
    [false, true, "banner"],
    [false, false, "upsell"],
  ] as const)("hasLiveOffer=%s everRedeemed=%s → %s", (hasLiveOffer, everRedeemed, mode) => {
    expect(buildDashboard({ ...base, hasLiveOffer, everRedeemed }).visitsMode).toBe(mode);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run src/lib/parceiro/dashboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `dashboard.ts`**

```ts
// src/lib/parceiro/dashboard.ts
import type { CourtesyCodeRow } from "@/lib/cortesia/types";
import { relativeTime } from "@/lib/cortesia/labels";
import { dayKey, monthStart, saoPauloParts } from "@/lib/time/saoPaulo";
import { GROUP_OPTIONS, roteiroSummary } from "./roteiroSummary";

const MAX_LATEST_VISITS = 10;
const MAX_RECENT_ROTEIROS = 8;

export interface AppearanceRow {
  id: string;
  created_at: string;
  quiz_answers: Record<string, unknown>;
}

export interface DayCount {
  dayKey: string;
  label: string;
  count: number;
}

export interface ProfileSlice {
  group: string;
  label: string;
  emoji: string;
  count: number;
}

export interface RecentRoteiro {
  id: string;
  summary: string;
  when: string;
  redeemed: boolean;
}

export type VisitsMode = "full" | "banner" | "upsell";

export interface Dashboard {
  visitsThisMonth: number;
  visitsLastMonth: number;
  visitsPerDay: DayCount[];
  latestVisits: { redeemedAt: string; offerText: string }[];
  appearancesThisMonth: number;
  appearancesPerDay: DayCount[];
  conversionRate: number | null;
  visitorProfile: ProfileSlice[];
  recentRoteiros: RecentRoteiro[];
  visitsMode: VisitsMode;
}

export interface DashboardInput {
  now: Date;
  /** Redeemed codes since the start of last month. */
  redeemed: CourtesyCodeRow[];
  /** Roteiros containing the place, created since the start of last month. */
  appearances: AppearanceRow[];
  /** quiz_answers keyed by itinerary id, for the roteiros behind redeemed codes. */
  visitorAnswers: Record<string, Record<string, unknown>>;
  hasLiveOffer: boolean;
  everRedeemed: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isBetween(iso: string, from: Date, to: Date | null): boolean {
  const time = new Date(iso).getTime();
  return time >= from.getTime() && (to === null || time < to.getTime());
}

function perDayThisMonth(isoDates: string[], now: Date): DayCount[] {
  const { year, month, day } = saoPauloParts(now);
  const counts = new Map<string, number>();
  for (const iso of isoDates) {
    const key = dayKey(new Date(iso));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: day }, (_, index) => {
    const key = `${year}-${pad(month)}-${pad(index + 1)}`;
    return { dayKey: key, label: String(index + 1), count: counts.get(key) ?? 0 };
  });
}

function byNewest<T>(items: T[], date: (item: T) => string): T[] {
  return [...items].sort((a, b) => new Date(date(b)).getTime() - new Date(date(a)).getTime());
}

export function buildDashboard(input: DashboardInput): Dashboard {
  const { now, redeemed, appearances, visitorAnswers, hasLiveOffer, everRedeemed } = input;
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);

  const redeemedWithDate = redeemed.filter((r): r is CourtesyCodeRow & { redeemed_at: string } => Boolean(r.redeemed_at));
  const visitsThisMonth = redeemedWithDate.filter((r) => isBetween(r.redeemed_at, thisMonth, null));
  const visitsLastMonth = redeemedWithDate.filter((r) => isBetween(r.redeemed_at, lastMonth, thisMonth));
  const appearancesThisMonth = appearances.filter((a) => isBetween(a.created_at, thisMonth, null));

  const groupCounts = new Map<string, number>();
  for (const visit of visitsThisMonth) {
    const group = visit.itinerary_id ? visitorAnswers[visit.itinerary_id]?.group : undefined;
    if (typeof group === "string") groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }
  const visitorProfile = GROUP_OPTIONS.filter((g) => groupCounts.has(g.value)).map((g) => ({
    group: g.value,
    label: g.label,
    emoji: g.emoji,
    count: groupCounts.get(g.value) ?? 0,
  }));

  const redeemedItineraries = new Set(redeemedWithDate.map((r) => r.itinerary_id).filter(Boolean));

  return {
    visitsThisMonth: visitsThisMonth.length,
    visitsLastMonth: visitsLastMonth.length,
    visitsPerDay: perDayThisMonth(visitsThisMonth.map((r) => r.redeemed_at), now),
    latestVisits: byNewest(redeemedWithDate, (r) => r.redeemed_at)
      .slice(0, MAX_LATEST_VISITS)
      .map((r) => ({ redeemedAt: r.redeemed_at, offerText: r.offer_text })),
    appearancesThisMonth: appearancesThisMonth.length,
    appearancesPerDay: perDayThisMonth(appearancesThisMonth.map((a) => a.created_at), now),
    conversionRate: appearancesThisMonth.length === 0 ? null : visitsThisMonth.length / appearancesThisMonth.length,
    visitorProfile,
    recentRoteiros: byNewest(appearances, (a) => a.created_at)
      .slice(0, MAX_RECENT_ROTEIROS)
      .map((a) => ({
        id: a.id,
        summary: roteiroSummary(a.quiz_answers),
        when: relativeTime(a.created_at, now),
        redeemed: redeemedItineraries.has(a.id),
      })),
    visitsMode: hasLiveOffer ? "full" : everRedeemed ? "banner" : "upsell",
  };
}
```

- [ ] **Step 7: Run to verify summary and dashboard pass**

Run: `npx vitest run src/lib/parceiro/roteiroSummary.test.ts src/lib/parceiro/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing loader test**

```ts
// src/lib/parceiro/loadDashboard.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/cortesia/queries", () => ({ listRedeemedCodes: vi.fn(), hasEverRedeemed: vi.fn() }));
vi.mock("./queries", () => ({ listItinerariesWithPlace: vi.fn(), getQuizAnswersByIds: vi.fn() }));

import { loadDashboard } from "./loadDashboard";
import { listRedeemedCodes, hasEverRedeemed } from "@/lib/cortesia/queries";
import { listItinerariesWithPlace, getQuizAnswersByIds } from "./queries";

describe("loadDashboard", () => {
  it("fetches since the start of last month and feeds buildDashboard", async () => {
    const now = new Date("2026-09-27T15:00:00Z");
    vi.mocked(listRedeemedCodes).mockResolvedValue([
      { id: "c1", itinerary_id: "r1", redeemed_at: "2026-09-10T15:00:00Z", offer_text: "Sobremesa" },
      { id: "c2", itinerary_id: "r1", redeemed_at: "2026-09-11T15:00:00Z", offer_text: "Sobremesa" },
    ] as never);
    vi.mocked(listItinerariesWithPlace).mockResolvedValue([]);
    vi.mocked(hasEverRedeemed).mockResolvedValue(true);
    vi.mocked(getQuizAnswersByIds).mockResolvedValue({ r1: { group: "casal" } });

    const dashboard = await loadDashboard({} as SupabaseClient, {
      id: "place-a", is_partner: true, is_verified: true, partner_offer: null,
    } as never, now);

    const since = new Date("2026-08-01T03:00:00Z");
    expect(listRedeemedCodes).toHaveBeenCalledWith(expect.anything(), "place-a", since);
    expect(listItinerariesWithPlace).toHaveBeenCalledWith(expect.anything(), "place-a", since);
    expect(getQuizAnswersByIds).toHaveBeenCalledWith(expect.anything(), ["r1"]);
    expect(dashboard.visitsThisMonth).toBe(2);
    expect(dashboard.visitorProfile[0]).toMatchObject({ group: "casal", count: 2 });
    expect(dashboard.visitsMode).toBe("banner");
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Run: `npx vitest run src/lib/parceiro/loadDashboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 10: Implement `queries.ts` and `loadDashboard.ts`**

```ts
// src/lib/parceiro/queries.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppearanceRow } from "./dashboard";

export async function listItinerariesWithPlace(
  client: SupabaseClient,
  placeId: string,
  since: Date,
): Promise<AppearanceRow[]> {
  const { data, error } = await client.rpc("itineraries_with_place", {
    p_place_id: placeId,
    p_since: since.toISOString(),
  });
  if (error) throw error;
  return (data ?? []) as AppearanceRow[];
}

export async function getQuizAnswersByIds(
  client: SupabaseClient,
  ids: string[],
): Promise<Record<string, Record<string, unknown>>> {
  if (ids.length === 0) return {};
  const { data, error } = await client.from("itineraries").select("id, quiz_answers").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; quiz_answers: Record<string, unknown> }[];
  return Object.fromEntries(rows.map((row) => [row.id, row.quiz_answers]));
}
```

```ts
// src/lib/parceiro/loadDashboard.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place } from "@/lib/supabase/types";
import { hasEverRedeemed, listRedeemedCodes } from "@/lib/cortesia/queries";
import { liveOfferText } from "@/lib/cortesia/liveOffers";
import { monthStart } from "@/lib/time/saoPaulo";
import { buildDashboard, type Dashboard } from "./dashboard";
import { getQuizAnswersByIds, listItinerariesWithPlace } from "./queries";

export async function loadDashboard(client: SupabaseClient, place: Place, now: Date = new Date()): Promise<Dashboard> {
  const since = monthStart(now, -1);
  const [redeemed, appearances, everRedeemed] = await Promise.all([
    listRedeemedCodes(client, place.id, since),
    listItinerariesWithPlace(client, place.id, since),
    hasEverRedeemed(client, place.id),
  ]);
  const itineraryIds = [...new Set(redeemed.map((r) => r.itinerary_id).filter((id): id is string => Boolean(id)))];
  const visitorAnswers = await getQuizAnswersByIds(client, itineraryIds);
  return buildDashboard({
    now,
    redeemed,
    appearances,
    visitorAnswers,
    hasLiveOffer: liveOfferText(place) !== null,
    everRedeemed,
  });
}
```

- [ ] **Step 11: Run all dashboard tests**

Run: `npx vitest run src/lib/parceiro`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/parceiro/roteiroSummary.ts src/lib/parceiro/roteiroSummary.test.ts src/lib/parceiro/dashboard.ts src/lib/parceiro/dashboard.test.ts src/lib/parceiro/queries.ts src/lib/parceiro/loadDashboard.ts src/lib/parceiro/loadDashboard.test.ts
git commit -m "feat(parceiro): dashboard aggregation for visits, interest and visitor profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Pending offer rules + partner offer submission

**Files:**
- Create: `src/lib/ofertas/pendingOffer.ts`, `src/app/api/parceiro/oferta/route.ts`, `src/components/parceiro/OfferCard.tsx`
- Test: `src/lib/ofertas/pendingOffer.test.ts`, `src/app/api/parceiro/oferta/route.test.ts`, `src/components/parceiro/OfferCard.test.tsx`

**Interfaces:**
- Consumes: `Place`; `updatePlace` (`@/lib/supabase/queries`); `getPartnerContext` (Task 9).
- Produces:
  - `MAX_OFFER_LENGTH = 120`, `type OfferDecision = "aprovar" | "recusar"`
  - `hasPendingOffer(place: Pick<Place, "pending_offer_submitted_at">): boolean`
  - `isPendingRemoval(place: Pick<Place, "pending_offer" | "pending_offer_submitted_at">): boolean`
  - `offerSubmissionPatch(text: string, now: Date): Pick<Place, "pending_offer" | "pending_offer_submitted_at">`
  - `offerDecisionPatch(place, decision: OfferDecision): Partial<Place>` (throws `NoPendingOfferError`)
  - `POST /api/parceiro/oferta` body `{ text }` → 200 `{ pending_offer, pending_offer_submitted_at }` | 400 | 401 | 502
  - `<OfferCard liveOffer pendingOffer hasPending />`

- [ ] **Step 1: Write the failing rules test**

```ts
// src/lib/ofertas/pendingOffer.test.ts
import { describe, it, expect } from "vitest";
import {
  hasPendingOffer,
  isPendingRemoval,
  offerSubmissionPatch,
  offerDecisionPatch,
  NoPendingOfferError,
} from "./pendingOffer";

const now = new Date("2026-09-27T15:00:00Z");

describe("pending offer rules", () => {
  it("a submission timestamp marks a pending offer", () => {
    expect(hasPendingOffer({ pending_offer_submitted_at: null })).toBe(false);
    expect(hasPendingOffer({ pending_offer_submitted_at: now.toISOString() })).toBe(true);
  });

  it("an empty pending text is a removal request", () => {
    expect(isPendingRemoval({ pending_offer: "", pending_offer_submitted_at: now.toISOString() })).toBe(true);
    expect(isPendingRemoval({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() })).toBe(false);
  });

  it("builds a trimmed submission patch", () => {
    expect(offerSubmissionPatch("  Café cortesia ", now)).toEqual({
      pending_offer: "Café cortesia",
      pending_offer_submitted_at: now.toISOString(),
    });
  });

  it("approving copies the pending text live and clears pending", () => {
    expect(offerDecisionPatch({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() }, "aprovar")).toEqual({
      partner_offer: "Café",
      pending_offer: null,
      pending_offer_submitted_at: null,
    });
  });

  it("approving a removal request clears the live offer", () => {
    expect(offerDecisionPatch({ pending_offer: "", pending_offer_submitted_at: now.toISOString() }, "aprovar")).toMatchObject({
      partner_offer: null,
    });
  });

  it("rejecting only clears pending", () => {
    expect(offerDecisionPatch({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() }, "recusar")).toEqual({
      pending_offer: null,
      pending_offer_submitted_at: null,
    });
  });

  it("refuses to decide when nothing is pending", () => {
    expect(() => offerDecisionPatch({ pending_offer: null, pending_offer_submitted_at: null }, "aprovar")).toThrow(NoPendingOfferError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ofertas/pendingOffer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pendingOffer.ts`**

```ts
// src/lib/ofertas/pendingOffer.ts
import type { Place } from "@/lib/supabase/types";

export const MAX_OFFER_LENGTH = 120;

export type OfferDecision = "aprovar" | "recusar";

type PendingFields = Pick<Place, "pending_offer" | "pending_offer_submitted_at">;

export class NoPendingOfferError extends Error {}

export function hasPendingOffer(place: Pick<Place, "pending_offer_submitted_at">): boolean {
  return Boolean(place.pending_offer_submitted_at);
}

export function isPendingRemoval(place: PendingFields): boolean {
  return hasPendingOffer(place) && !(place.pending_offer ?? "").trim();
}

export function offerSubmissionPatch(text: string, now: Date): PendingFields {
  return { pending_offer: text.trim(), pending_offer_submitted_at: now.toISOString() };
}

export function offerDecisionPatch(place: PendingFields, decision: OfferDecision): Partial<Place> {
  if (!hasPendingOffer(place)) throw new NoPendingOfferError("No pending offer to decide on");
  const cleared = { pending_offer: null, pending_offer_submitted_at: null };
  if (decision === "recusar") return cleared;
  const text = (place.pending_offer ?? "").trim();
  return { partner_offer: text || null, ...cleared };
}
```

- [ ] **Step 4: Write the failing route test**

```ts
// src/app/api/parceiro/oferta/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ updatePlace: vi.fn() }));
vi.mock("@/lib/parceiro/context", () => ({ getPartnerContext: vi.fn() }));

import { POST } from "./route";
import { updatePlace } from "@/lib/supabase/queries";
import { getPartnerContext } from "@/lib/parceiro/context";

function post(body: unknown) {
  return new Request("http://localhost/api/parceiro/oferta", { method: "POST", body: JSON.stringify(body) });
}

function withPlace(partner_offer: string | null) {
  vi.mocked(getPartnerContext).mockResolvedValue({ userId: "u", email: "e", place: { id: "place-a", partner_offer } } as never);
}

beforeEach(() => {
  vi.mocked(updatePlace).mockReset().mockImplementation(async (_c, _id, patch) => patch as never);
  withPlace("Café cortesia");
});

describe("POST /api/parceiro/oferta", () => {
  it("returns 401 without a partner session", async () => {
    vi.mocked(getPartnerContext).mockResolvedValue(null);
    expect((await POST(post({ text: "x" }))).status).toBe(401);
  });

  it("stores a trimmed pending offer without touching the live one", async () => {
    const response = await POST(post({ text: "  Sobremesa cortesia " }));
    expect(response.status).toBe(200);
    const patch = vi.mocked(updatePlace).mock.calls[0][2];
    expect(patch).toMatchObject({ pending_offer: "Sobremesa cortesia" });
    expect(patch).not.toHaveProperty("partner_offer");
  });

  it("accepts an empty text as a removal request when there is a live offer", async () => {
    expect((await POST(post({ text: "" }))).status).toBe(200);
    expect(vi.mocked(updatePlace).mock.calls[0][2]).toMatchObject({ pending_offer: "" });
  });

  it("rejects a removal request when there is nothing live to remove", async () => {
    withPlace(null);
    expect((await POST(post({ text: "  " }))).status).toBe(400);
  });

  it("rejects texts over 120 characters", async () => {
    expect((await POST(post({ text: "x".repeat(121) }))).status).toBe(400);
    expect(updatePlace).not.toHaveBeenCalled();
  });

  it("rejects a missing text", async () => {
    expect((await POST(post({}))).status).toBe(400);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run src/app/api/parceiro/oferta`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement the route**

```ts
// src/app/api/parceiro/oferta/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { updatePlace } from "@/lib/supabase/queries";
import { getPartnerContext } from "@/lib/parceiro/context";
import { MAX_OFFER_LENGTH, offerSubmissionPatch } from "@/lib/ofertas/pendingOffer";

export async function POST(request: Request) {
  const ctx = await getPartnerContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.text !== "string") {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const text = body.text.trim();
  if (text.length > MAX_OFFER_LENGTH) {
    return NextResponse.json({ error: `A cortesia deve ter até ${MAX_OFFER_LENGTH} caracteres.` }, { status: 400 });
  }
  if (!text && !ctx.place.partner_offer?.trim()) {
    return NextResponse.json({ error: "Não há cortesia para remover." }, { status: 400 });
  }

  try {
    const updated = await updatePlace(getSupabaseAdminClient(), ctx.place.id, offerSubmissionPatch(text, new Date()));
    return NextResponse.json({
      pending_offer: updated.pending_offer ?? null,
      pending_offer_submitted_at: updated.pending_offer_submitted_at ?? null,
    });
  } catch (error) {
    console.error("Partner offer submission failed", error);
    return NextResponse.json({ error: "Não foi possível enviar. Tente de novo." }, { status: 502 });
  }
}
```

- [ ] **Step 7: Write the failing `OfferCard` test**

```tsx
// src/components/parceiro/OfferCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfferCard } from "./OfferCard";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("OfferCard", () => {
  it("shows the live offer and a pending one", () => {
    render(<OfferCard liveOffer="Café cortesia" pendingOffer="Sobremesa cortesia" hasPending />);
    expect(screen.getByText("Café cortesia")).toBeInTheDocument();
    expect(screen.getByText(/aguardando aprovação/i)).toHaveTextContent("Sobremesa cortesia");
  });

  it("shows a pending removal", () => {
    render(<OfferCard liveOffer="Café cortesia" pendingOffer="" hasPending />);
    expect(screen.getByText(/aguardando aprovação/i)).toHaveTextContent("remover a cortesia");
  });

  it("submits a new offer for approval", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ pending_offer: "Sobremesa", pending_offer_submitted_at: "x" }) });
    render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    fireEvent.change(screen.getByLabelText("Nova cortesia"), { target: { value: "Sobremesa" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar para aprovação" }));
    expect(await screen.findByText(/aguardando aprovação/i)).toHaveTextContent("Sobremesa");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "Sobremesa" });
  });

  it("offers removal only when there is a live offer", () => {
    const { rerender } = render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    expect(screen.queryByRole("button", { name: "Pedir remoção" })).not.toBeInTheDocument();
    rerender(<OfferCard liveOffer="Café" pendingOffer={null} hasPending={false} />);
    expect(screen.getByRole("button", { name: "Pedir remoção" })).toBeInTheDocument();
  });

  it("limits the text to 120 characters", () => {
    render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    expect(screen.getByLabelText("Nova cortesia")).toHaveAttribute("maxLength", "120");
  });
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `npx vitest run src/components/parceiro/OfferCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement `OfferCard.tsx`**

```tsx
// src/components/parceiro/OfferCard.tsx
"use client";

import { useState, type FormEvent } from "react";
import { MAX_OFFER_LENGTH } from "@/lib/ofertas/pendingOffer";

export function OfferCard({
  liveOffer,
  pendingOffer,
  hasPending,
}: {
  liveOffer: string | null;
  pendingOffer: string | null;
  hasPending: boolean;
}) {
  const [pending, setPending] = useState<{ has: boolean; text: string }>({ has: hasPending, text: pendingOffer ?? "" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(text: string) {
    setSending(true);
    setError(null);
    const response = await fetch("/api/parceiro/oferta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) : null;
      setError(body?.error ?? "Não foi possível enviar. Tente de novo.");
      return;
    }
    const body = await response.json();
    setPending({ has: true, text: body.pending_offer ?? "" });
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) void submit(draft);
  }

  return (
    <section id="cortesia" className="flex flex-col gap-3 rounded-card border border-teal-ink/10 bg-white p-5">
      <h2 className="font-display text-base font-extrabold">🎁 Minha cortesia</h2>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">No ar agora</p>
        <p className="text-sm">{liveOffer ?? "Nenhuma cortesia ativa"}</p>
      </div>
      {pending.has && (
        <p className="rounded-card bg-coral/10 p-3 text-sm text-coral-deep">
          Aguardando aprovação: {pending.text.trim() ? <strong>{pending.text}</strong> : "remover a cortesia"}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="nova-cortesia" className="text-sm font-bold">
          Nova cortesia
        </label>
        <textarea
          id="nova-cortesia"
          value={draft}
          maxLength={MAX_OFFER_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Ex.: Sobremesa cortesia no almoço"
          className="w-full rounded-card border border-teal-ink/15 px-3 py-2 text-sm"
        />
        <p className="self-end text-[11px] text-teal-ink/50">
          {draft.length}/{MAX_OFFER_LENGTH}
        </p>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-pill bg-teal-ink px-4 py-2 text-sm font-bold text-sand disabled:opacity-40"
          >
            Enviar para aprovação
          </button>
          {liveOffer && (
            <button
              type="button"
              disabled={sending}
              onClick={() => submit("")}
              className="rounded-pill bg-coral/10 px-4 py-2 text-sm font-bold text-coral-deep disabled:opacity-40"
            >
              Pedir remoção
            </button>
          )}
        </div>
        <p className="text-[11px] text-teal-ink/50">A equipe Floripa.My revisa antes de a cortesia aparecer nos roteiros.</p>
      </form>
    </section>
  );
}
```

- [ ] **Step 10: Run all three**

Run: `npx vitest run src/lib/ofertas src/app/api/parceiro/oferta src/components/parceiro/OfferCard.test.tsx`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/ofertas src/app/api/parceiro/oferta src/components/parceiro/OfferCard.tsx src/components/parceiro/OfferCard.test.tsx
git commit -m "feat(parceiro): partners submit their courtesy offer for approval

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 15: The /parceiro dashboard page

**Files:**
- Create: `src/components/parceiro/DailyBars.tsx`, `src/components/parceiro/DashboardView.tsx`, `src/app/parceiro/page.tsx`
- Test: `src/components/parceiro/DashboardView.test.tsx`

**Interfaces:**
- Consumes: `Dashboard`, `DayCount` (Task 13); `OfferCard` (Task 14); `PartnerShell` (Task 12); `getPartnerContext` (Task 9); `loadDashboard` (Task 13); `liveOfferText` (Task 4); `hasPendingOffer` (Task 14); `formatDayMonth`, `formatTime` (Task 2).
- Produces: `<DashboardView dashboard plan liveOffer pendingOffer hasPending />`, `<DailyBars data label />`, the `/parceiro` page.

Before styling the bars, load the `dataviz` skill and follow it for the bar colors, empty state and labels.

- [ ] **Step 1: Write the failing view test**

```tsx
// src/components/parceiro/DashboardView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DashboardView } from "./DashboardView";
import type { Dashboard } from "@/lib/parceiro/dashboard";

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    visitsThisMonth: 23, visitsLastMonth: 18,
    visitsPerDay: [{ dayKey: "2026-09-01", label: "1", count: 2 }],
    latestVisits: [{ redeemedAt: "2026-09-27T16:10:00Z", offerText: "Sobremesa cortesia" }],
    appearancesThisMonth: 142,
    appearancesPerDay: [{ dayKey: "2026-09-01", label: "1", count: 5 }],
    conversionRate: 23 / 142,
    visitorProfile: [{ group: "casal", label: "Casal", emoji: "💑", count: 12 }],
    recentRoteiros: [{ id: "r1", summary: "Casal · 3 a 4 dias · Gastronomia & Praia", when: "há 14 min", redeemed: true }],
    visitsMode: "full",
    ...overrides,
  };
}

const props = { plan: "Destaque", liveOffer: "Sobremesa cortesia", pendingOffer: null, hasPending: false };

describe("DashboardView", () => {
  it("shows confirmed visits with the month-over-month delta", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Visitas confirmadas")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("↑ 5 vs mês anterior")).toBeInTheDocument();
  });

  it("shows the conversion rate in Brazilian format", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("16,2%")).toBeInTheDocument();
  });

  it("keeps interest separate from visits", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Seu estabelecimento apareceu em 142 roteiros este mês")).toBeInTheDocument();
  });

  it("lists recent roteiros with the redeemed mark", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Casal · 3 a 4 dias · Gastronomia & Praia")).toBeInTheDocument();
    expect(screen.getByText("✓ Cortesia resgatada")).toBeInTheDocument();
  });

  it("replaces the visits block with the upsell when there was never an offer", () => {
    render(<DashboardView dashboard={dashboard({ visitsMode: "upsell" })} {...props} liveOffer={null} />);
    expect(screen.queryByText("Visitas confirmadas")).not.toBeInTheDocument();
    expect(screen.getByText("Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My")).toBeInTheDocument();
  });

  it("keeps past visits and shows the upsell as a banner when the offer was removed", () => {
    render(<DashboardView dashboard={dashboard({ visitsMode: "banner" })} {...props} liveOffer={null} />);
    expect(screen.getByText("Visitas confirmadas")).toBeInTheDocument();
    expect(screen.getByText("Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My")).toBeInTheDocument();
  });

  it("shows a dash when there is no conversion rate yet", () => {
    render(<DashboardView dashboard={dashboard({ conversionRate: null })} {...props} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("hides the upgrade card for Premium partners", () => {
    render(<DashboardView dashboard={dashboard()} {...props} plan="Premium" />);
    expect(screen.queryByText(/plano premium/i)).not.toBeInTheDocument();
  });
});
```

The upsell copy uses the current brand name "Floripa.My" (the spec was written before the rebrand wording was settled; "Floripa.my" in the spec means the same brand).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/parceiro/DashboardView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DailyBars.tsx`**

```tsx
// src/components/parceiro/DailyBars.tsx
import type { DayCount } from "@/lib/parceiro/dashboard";

const LABEL_EVERY = 5;

export function DailyBars({ data, label }: { data: DayCount[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure aria-label={label} className="flex flex-col gap-1">
      <div className="flex h-24 items-end gap-[2px]">
        {data.map((d) => (
          <div
            key={d.dayKey}
            title={`Dia ${d.label}: ${d.count}`}
            aria-label={`Dia ${d.label}: ${d.count}`}
            className="flex-1 rounded-t-sm bg-turquoise-deep/80"
            style={{ height: d.count === 0 ? "2px" : `${(d.count / max) * 100}%`, opacity: d.count === 0 ? 0.2 : 1 }}
          />
        ))}
      </div>
      <div className="flex gap-[2px] text-[9px] text-teal-ink/50">
        {data.map((d, index) => (
          <span key={d.dayKey} className="flex-1 text-center">
            {index === 0 || (index + 1) % LABEL_EVERY === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
```

- [ ] **Step 4: Implement `DashboardView.tsx`**

```tsx
// src/components/parceiro/DashboardView.tsx
import type { ReactNode } from "react";
import type { Dashboard } from "@/lib/parceiro/dashboard";
import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import { DailyBars } from "./DailyBars";
import { OfferCard } from "./OfferCard";

const UPSELL_TEXT = "Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-3 rounded-card border border-teal-ink/10 bg-white p-5 ${className}`}>{children}</section>;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1).replace(".", ",")}%`;
}

function deltaText(current: number, previous: number): string {
  const diff = current - previous;
  if (diff > 0) return `↑ ${diff} vs mês anterior`;
  if (diff < 0) return `↓ ${-diff} vs mês anterior`;
  return "= mês anterior";
}

function Upsell() {
  return (
    <Card className="border-coral/30 bg-coral/5">
      <p className="font-display text-base font-extrabold">{UPSELL_TEXT}</p>
      <p className="text-sm text-teal-ink/60">
        Uma cortesia simples (um café, uma sobremesa) faz cada cliente que veio pelo roteiro aparecer aqui.
      </p>
      <a href="#cortesia" className="self-start rounded-pill bg-coral px-4 py-2 text-sm font-bold text-graphite">
        Ativar cortesia
      </a>
    </Card>
  );
}

export function DashboardView({
  dashboard,
  plan,
  liveOffer,
  pendingOffer,
  hasPending,
}: {
  dashboard: Dashboard;
  plan: string | null;
  liveOffer: string | null;
  pendingOffer: string | null;
  hasPending: boolean;
}) {
  const showVisits = dashboard.visitsMode !== "upsell";

  return (
    <div className="flex flex-col gap-4">
      {dashboard.visitsMode !== "full" && <Upsell />}

      {showVisits && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Visitas confirmadas</p>
            <p className="font-display text-4xl font-extrabold">{dashboard.visitsThisMonth}</p>
            <p className="text-xs font-bold text-turquoise-deep">{deltaText(dashboard.visitsThisMonth, dashboard.visitsLastMonth)}</p>
            <DailyBars data={dashboard.visitsPerDay} label="Visitas confirmadas por dia" />
          </Card>
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Taxa de conversão</p>
            <p className="font-display text-4xl font-extrabold">{formatPercent(dashboard.conversionRate)}</p>
            <p className="text-xs text-teal-ink/60">Visitas confirmadas ÷ roteiros em que você apareceu este mês</p>
          </Card>
        </div>
      )}

      {showVisits && (
        <Card>
          <h2 className="font-display text-base font-extrabold">Últimas visitas</h2>
          {dashboard.latestVisits.length === 0 ? (
            <p className="text-sm text-teal-ink/60">Nenhuma visita confirmada ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-teal-ink/5">
              {dashboard.latestVisits.map((visit) => (
                <li key={visit.redeemedAt} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{visit.offerText}</span>
                  <span className="shrink-0 text-teal-ink/60">
                    {formatDayMonth(new Date(visit.redeemedAt))} · {formatTime(new Date(visit.redeemedAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {dashboard.visitorProfile.length > 0 && (
        <Card>
          <h2 className="font-display text-base font-extrabold">Perfil dos visitantes</h2>
          <p className="text-xs text-teal-ink/60">Quem realmente veio este mês</p>
          <ul className="flex flex-wrap gap-2">
            {dashboard.visitorProfile.map((slice) => (
              <li key={slice.group} className="rounded-pill bg-sand px-3 py-1.5 text-sm font-bold">
                {slice.emoji} {slice.label} · {slice.count}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Interesse</p>
        <p className="font-display text-lg font-extrabold">
          Seu estabelecimento apareceu em {dashboard.appearancesThisMonth} roteiros este mês
        </p>
        <DailyBars data={dashboard.appearancesPerDay} label="Aparições em roteiros por dia" />
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold">Roteiros recentes</h2>
        {dashboard.recentRoteiros.length === 0 ? (
          <p className="text-sm text-teal-ink/60">Seu estabelecimento ainda não apareceu em roteiros.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-teal-ink/5">
            {dashboard.recentRoteiros.map((roteiro) => (
              <li key={roteiro.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold">{roteiro.summary}</p>
                  <p className="text-xs text-teal-ink/50">{roteiro.when}</p>
                </div>
                {roteiro.redeemed && (
                  <span className="shrink-0 rounded-pill bg-turquoise/15 px-2 py-1 text-[11px] font-bold text-turquoise-deep">
                    ✓ Cortesia resgatada
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <OfferCard liveOffer={liveOffer} pendingOffer={pendingOffer} hasPending={hasPending} />

      {!plan?.toLowerCase().includes("premium") && (
        <Card className="bg-teal-ink text-sand">
          <p className="font-display text-base font-extrabold">Quer ainda mais destaque?</p>
          <p className="text-sm text-sand/70">No plano Premium seu estabelecimento tem prioridade nas sugestões dos roteiros.</p>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement the page**

```tsx
// src/app/parceiro/page.tsx
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { loadDashboard } from "@/lib/parceiro/loadDashboard";
import { liveOfferText } from "@/lib/cortesia/liveOffers";
import { hasPendingOffer } from "@/lib/ofertas/pendingOffer";
import { PartnerShell } from "@/components/parceiro/PartnerShell";
import { DashboardView } from "@/components/parceiro/DashboardView";

// Reads live data behind the partner session on every visit.
export const dynamic = "force-dynamic";

export default async function PainelParceiroPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect(`/parceiro/entrar?next=${encodeURIComponent("/parceiro")}`);
  const { place } = ctx;
  const dashboard = await loadDashboard(getSupabaseAdminClient(), place);
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
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run src/components/parceiro && npx tsc --noEmit`
Expected: PASS, no type errors. If the `"23"` assertion matches more than one element (e.g. a bar label), switch that assertion to `getAllByText("23")[0]` only after confirming which element it hits.

- [ ] **Step 7: Commit**

```bash
git add src/components/parceiro/DailyBars.tsx src/components/parceiro/DashboardView.tsx src/components/parceiro/DashboardView.test.tsx src/app/parceiro/page.tsx
git commit -m "feat(parceiro): partner dashboard with visits, conversion, interest and offer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Admin approval of partner offers

**Files:**
- Create: `src/app/api/admin/places/[id]/oferta/route.ts`, `src/components/admin/PendingOfferReview.tsx`
- Modify: `src/app/admin/estabelecimentos/[id]/page.tsx`, `src/components/admin/PlacesTabs.tsx`
- Test: `src/app/api/admin/places/[id]/oferta/route.test.ts`, `src/components/admin/PendingOfferReview.test.tsx`, `src/components/admin/PlacesTabs.test.tsx`

**Interfaces:**
- Consumes: `getPlaceById`, `updatePlace`; `hasPendingOffer`, `isPendingRemoval`, `offerDecisionPatch`, `NoPendingOfferError` (Task 14); `formatDayMonth` (Task 2).
- Produces: `POST /api/admin/places/[id]/oferta` body `{ action: "aprovar" | "recusar" }` → 200 updated place | 400 | 404 | 409 | 502 (already behind the admin middleware); `<PendingOfferReview place />`.

- [ ] **Step 1: Write the failing route test**

```ts
// src/app/api/admin/places/[id]/oferta/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), updatePlace: vi.fn() }));

import { POST } from "./route";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";

const params = { params: Promise.resolve({ id: "p1" }) };
function post(body: unknown) {
  return new Request("http://localhost/api/admin/places/p1/oferta", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset().mockResolvedValue({
    id: "p1", partner_offer: "Café", pending_offer: "Sobremesa", pending_offer_submitted_at: "2026-09-27T15:00:00Z",
  } as never);
  vi.mocked(updatePlace).mockReset().mockImplementation(async (_c, id, patch) => ({ id, ...patch }) as never);
});

describe("POST /api/admin/places/[id]/oferta", () => {
  it("approves: the pending text goes live", async () => {
    const response = await POST(post({ action: "aprovar" }), params);
    expect(response.status).toBe(200);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", {
      partner_offer: "Sobremesa", pending_offer: null, pending_offer_submitted_at: null,
    });
  });

  it("rejects: only pending is cleared", async () => {
    await POST(post({ action: "recusar" }), params);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", { pending_offer: null, pending_offer_submitted_at: null });
  });

  it("returns 400 for an unknown action", async () => {
    expect((await POST(post({ action: "talvez" }), params)).status).toBe(400);
  });

  it("returns 404 for a missing place", async () => {
    vi.mocked(getPlaceById).mockResolvedValue(null);
    expect((await POST(post({ action: "aprovar" }), params)).status).toBe(404);
  });

  it("returns 409 when nothing is pending (e.g. already decided in another tab)", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", pending_offer: null, pending_offer_submitted_at: null } as never);
    expect((await POST(post({ action: "aprovar" }), params)).status).toBe(409);
    expect(updatePlace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "src/app/api/admin/places/[id]/oferta"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/admin/places/[id]/oferta/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { NoPendingOfferError, offerDecisionPatch, type OfferDecision } from "@/lib/ofertas/pendingOffer";

const DECISIONS: OfferDecision[] = ["aprovar", "recusar"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!DECISIONS.includes(action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const client = getSupabaseAdminClient();
  const place = await getPlaceById(client, id);
  if (!place) return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 });

  let patch;
  try {
    patch = offerDecisionPatch(
      { pending_offer: place.pending_offer ?? null, pending_offer_submitted_at: place.pending_offer_submitted_at ?? null },
      action,
    );
  } catch (error) {
    if (error instanceof NoPendingOfferError) {
      return NextResponse.json({ error: "Não há oferta pendente." }, { status: 409 });
    }
    throw error;
  }

  try {
    return NextResponse.json(await updatePlace(client, id, patch));
  } catch (error) {
    console.error("Offer decision failed", error);
    return NextResponse.json({ error: "Não foi possível salvar a decisão." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Write the failing component tests**

```tsx
// src/components/admin/PendingOfferReview.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { PendingOfferReview } from "./PendingOfferReview";

const fetchMock = vi.fn();
beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

const pending = { id: "p1", partner_offer: "Café", pending_offer: "Sobremesa", pending_offer_submitted_at: "2026-09-27T15:00:00Z" };

describe("PendingOfferReview", () => {
  it("renders nothing without a pending offer", () => {
    const { container } = render(<PendingOfferReview place={{ ...pending, pending_offer_submitted_at: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current and proposed offer", () => {
    render(<PendingOfferReview place={pending} />);
    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText("Sobremesa")).toBeInTheDocument();
    expect(screen.getByText(/enviada pelo parceiro em 27\/09/i)).toBeInTheDocument();
  });

  it("labels a removal request", () => {
    render(<PendingOfferReview place={{ ...pending, pending_offer: "" }} />);
    expect(screen.getByText("Pedido de remoção da cortesia")).toBeInTheDocument();
  });

  it("approves and refreshes the page", async () => {
    render(<PendingOfferReview place={pending} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/places/p1/oferta", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "aprovar" });
  });

  it("rejects", async () => {
    render(<PendingOfferReview place={pending} />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "recusar" });
  });
});
```

Add to `src/components/admin/PlacesTabs.test.tsx`, inside the `describe("PlacesTabs", ...)` block:

```tsx
  it("flags partners with an offer waiting for approval", () => {
    const places = [
      place({ id: "a", name: "Com pendência", is_partner: true, pending_offer: "Café", pending_offer_submitted_at: "2026-09-27T15:00:00Z" }),
      place({ id: "b", name: "Sem pendência", is_partner: true }),
    ];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /parceiros/i }));
    expect(screen.getAllByText("🎁 Oferta pendente")).toHaveLength(1);
  });
```

- [ ] **Step 5: Run to verify they fail**

Run: `npx vitest run src/components/admin/PendingOfferReview.test.tsx src/components/admin/PlacesTabs.test.tsx`
Expected: FAIL — module not found / badge missing.

- [ ] **Step 6: Implement `PendingOfferReview.tsx`**

```tsx
// src/components/admin/PendingOfferReview.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/supabase/types";
import { hasPendingOffer, isPendingRemoval, type OfferDecision } from "@/lib/ofertas/pendingOffer";
import { formatDayMonth } from "@/lib/time/saoPaulo";

type ReviewPlace = Pick<Place, "id" | "partner_offer" | "pending_offer" | "pending_offer_submitted_at">;

export function PendingOfferReview({ place }: { place: ReviewPlace }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = { pending_offer: place.pending_offer ?? null, pending_offer_submitted_at: place.pending_offer_submitted_at ?? null };
  if (!hasPendingOffer(fields)) return null;

  async function decide(action: OfferDecision) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/places/${place.id}/oferta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (response.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (!response.ok) {
      setError("Não foi possível salvar a decisão. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-card border border-coral/30 bg-coral/5 p-4">
      <p className="text-sm font-bold text-coral-deep">
        🎁 Oferta enviada pelo parceiro em {formatDayMonth(new Date(fields.pending_offer_submitted_at!))}
      </p>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-teal-ink/50">No ar agora</p>
          <p>{place.partner_offer?.trim() || "Nenhuma"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-teal-ink/50">Proposta</p>
          <p className="font-bold">{isPendingRemoval(fields) ? "Pedido de remoção da cortesia" : fields.pending_offer}</p>
        </div>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("aprovar")}
          className="rounded-pill bg-turquoise/20 px-4 py-1.5 text-xs font-bold text-turquoise-deep disabled:opacity-40"
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("recusar")}
          className="rounded-pill bg-coral/10 px-4 py-1.5 text-xs font-bold text-coral-deep disabled:opacity-40"
        >
          Recusar
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Wire it into the edit page and the list**

In `src/app/admin/estabelecimentos/[id]/page.tsx`, import and render it between the `<h1>` and the form:

```tsx
import { PendingOfferReview } from "@/components/admin/PendingOfferReview";
```

```tsx
        <h1 className="mt-6 font-display text-2xl font-extrabold text-teal-ink">Editar estabelecimento</h1>
        <PendingOfferReview place={place} />
        <AdminPlaceForm mode="edit" place={place} />
```

In `src/components/admin/PlacesTabs.tsx`, import the helper:

```tsx
import { hasPendingOffer } from "@/lib/ofertas/pendingOffer";
```

and replace the `<p className="font-bold text-teal-ink">{place.name}</p>` line with:

```tsx
              <p className="font-bold text-teal-ink">
                {place.name}
                {hasPendingOffer({ pending_offer_submitted_at: place.pending_offer_submitted_at ?? null }) && (
                  <span className="ml-2 rounded-pill bg-coral/15 px-2 py-0.5 text-[10px] font-bold text-coral-deep">
                    🎁 Oferta pendente
                  </span>
                )}
              </p>
```

- [ ] **Step 8: Run the admin tests**

Run: `npx vitest run src/components/admin src/app/api/admin`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/admin/places/[id]/oferta" src/components/admin/PendingOfferReview.tsx src/components/admin/PendingOfferReview.test.tsx "src/app/admin/estabelecimentos/[id]/page.tsx" src/components/admin/PlacesTabs.tsx src/components/admin/PlacesTabs.test.tsx
git commit -m "feat(admin): approve or reject partner-submitted courtesy offers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 17: Founder setup guide, full verification and end-to-end check

**Files:**
- Create: `docs/parceiro-portal-setup.md`

The founder is not technical: the guide is in Portuguese, click by click, and names every screen and button.

- [ ] **Step 1: Write the setup guide**

```markdown
# Portal do Parceiro — configuração (passo a passo)

Faça isso uma vez. Leva uns 15 minutos.

## 1. Criar as tabelas novas no banco

1. Entre em https://supabase.com/dashboard e abra o projeto do Floripa.My.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique em **+ New query**.
4. Abra o arquivo `supabase/migrations/0005_checkin_cortesia.sql` do projeto, copie **todo** o conteúdo e cole no editor.
5. Clique em **Run** (canto inferior direito). Deve aparecer "Success. No rows returned".

## 2. Copiar a chave pública (anon)

1. No menu da esquerda, clique em **Project Settings** (engrenagem) → **API Keys**.
2. Copie a chave **anon public**.
3. No computador, abra o arquivo `.env.local` do projeto e adicione a linha: `SUPABASE_ANON_KEY=` seguida da chave copiada.
4. Se quiser o link de WhatsApp na tela de login, adicione também `WHATSAPP_CONTATO=5548XXXXXXXXX` (só números, com 55 e o DDD).
5. No Vercel (https://vercel.com → projeto **floripa-me-demo** → **Settings** → **Environment Variables**), crie as mesmas variáveis (`SUPABASE_ANON_KEY` e, se usar, `WHATSAPP_CONTATO`) e clique em **Save**.

## 3. Ligar o login por e-mail

1. No Supabase, menu da esquerda: **Authentication** → **Sign In / Providers**.
2. Confirme que **Email** está ligado (Enabled).

## 4. Dizer ao Supabase para onde o link pode levar

1. **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o endereço do site no Vercel (ex.: `https://floripa-me-demo.vercel.app`).
3. Em **Redirect URLs**, clique em **Add URL** e adicione, uma de cada vez:
   - `http://localhost:3000/parceiro/auth/callback**`
   - `https://floripa-me-demo.vercel.app/parceiro/auth/callback**` (troque pelo seu endereço real, se for outro)
4. Clique em **Save**.

## 5. Ajustar o e-mail do link mágico

1. **Authentication** → **Emails** → aba **Templates** → **Magic Link**.
2. Troque o assunto para: `Seu acesso ao Portal do Parceiro Floripa.My`
3. Apague o corpo e cole:

   ```html
   <h2>Portal do Parceiro Floripa.My</h2>
   <p>Toque no botão abaixo para entrar. O link vale por 1 hora e só pode ser usado uma vez.</p>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Entrar no Portal do Parceiro</a></p>
   ```

4. Clique em **Save changes**.

## 6. Cadastrar o parceiro

No painel `/admin`, abra o estabelecimento e confira:
- **É parceiro** marcado e **verificado**;
- **E-mail de contato** preenchido com o e-mail que o dono vai usar para entrar;
- **Oferta** preenchida, se ele tiver cortesia.

## 7. Antes de ter muitos parceiros: e-mail próprio (Resend)

O envio de e-mail padrão do Supabase só manda poucos e-mails por hora. Quando for lançar para valer, configure um provedor (ex.: Resend, gratuito até um bom volume) em **Authentication** → **Emails** → **SMTP Settings**. Peça ajuda nesse passo.

## 8. O QR do display de balcão

O QR do verso do display deve apontar para: `https://<seu-endereço>/parceiro/validar`
```

- [ ] **Step 2: Run the whole suite, lint and build**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. (If the build fails only because env vars like `SUPABASE_ANON_KEY` are missing at build time, confirm the pages are `force-dynamic` and nothing reads them at module scope.)

- [ ] **Step 3: Visual verification**

Check first whether a dev server is already running; reuse it. With the migration applied (Step 1 of the guide, done by the founder) and one test partner configured (verified, `is_partner`, `contact_email` = an inbox you can read, an offer), screenshot at 390px and desktop width:
- the roteiro card with "Resgate sua cortesia" and the sheet with a real code;
- `/parceiro/entrar` (form and "enviamos" state);
- `/parceiro/validar`: valid → Confirmar entrega → entregue; then the same code again (used message); a typo (not found);
- `/parceiro` with the offer (full), and after removing the offer in admin (banner);
- `/admin` list with the "🎁 Oferta pendente" badge and the approval card on the edit page.

- [ ] **Step 4: Manual end-to-end with the founder**

Walk the founder through: generate a code in a real roteiro on the phone → request the portal link with the partner email → open the email on the phone → validate the code → see the visit in the painel → submit a new offer in the painel → approve it in `/admin` → see it on the roteiro card.

- [ ] **Step 5: Commit**

```bash
git add docs/parceiro-portal-setup.md
git commit -m "docs: step-by-step setup guide for the partner portal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
