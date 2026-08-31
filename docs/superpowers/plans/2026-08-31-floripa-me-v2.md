# Floripa.me v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Floripa.me as a working Next.js + Supabase app: 8-question quiz → AI-generated (Claude), catalog-grounded, partner-weighted itinerary → Roteiro/Mapa/Dicas/SOS/Mais navigation, installable as a PWA, no login required.

**Architecture:** Next.js (App Router, TypeScript) full-stack app on Vercel. API routes filter/rank places from a Supabase Postgres catalog by quiz profile, call Claude to narrate a structured JSON itinerary grounded in that candidate list, and persist the result under a public slug (no auth — the link is the "account"). Google Places API is used only offline (discovery/enrichment scripts), never at request time.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Supabase (`@supabase/supabase-js`), `@anthropic-ai/sdk` + `zod` (structured itinerary generation), `@googlemaps/js-api-loader` (Mapa screen), Vitest + `@testing-library/react` (tests), `sharp` (one-time PWA icon generation).

**Spec:** [docs/superpowers/specs/2026-08-31-floripa-me-v2-design.md](../specs/2026-08-31-floripa-me-v2-design.md) — the plan argues from this spec; executors should read both.

## Global Constraints

- No user accounts/login anywhere — itineraries are addressed by a public slug (spec §5).
- The Google Places API key is never sent to the browser — all Places calls happen in server-side scripts (spec §4).
- Claude only ever selects from the candidate list handed to it — it must never invent a place not present in the filtered/ranked candidates (spec §3, "Passo 3").
- Model ID for all Claude calls: `claude-opus-5` (per current Anthropic API guidance — do not substitute another model).
- Partner establishments (`is_partner = true`) get higher selection weight but never 100% dominance; non-partners rotate between generations (spec §3, "Passo 2").
- Visual identity: "Ilha Neon Noturna" — dark graphite/petrol background (`#0B1416`), turquoise (`#00E6C8`) + blue (`#00A8E0`) primary accent, coral (`#FF7A59`) secondary accent (shifts to alert/red family on the SOS screen), Syne (headings) + DM Sans (body) (spec § Design visual).
- Bottom nav is 5 tabs in this order: Roteiro, Mapa, SOS, Dicas, Mais.

---

## Task 1: Scaffold Next.js project + design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: Tailwind theme tokens (`bg-graphite`, `text-turquoise`, `text-coral`, `font-display`, `font-body`) that every later UI task consumes.

- [ ] **Step 1: Create the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack --use-npm
```

Answer "Yes" to overwriting the current directory (it currently only contains `docs/`, `.gitignore`, `.git/`).

- [ ] **Step 2: Add design tokens to `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#0B1416",
        "graphite-deep": "#123542",
        turquoise: "#00E6C8",
        blue: "#00A8E0",
        coral: "#FF7A59",
        alert: "#FF5A5A",
        ink: "#FFFFFF",
        "ink-dim": "rgba(255,255,255,0.6)",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        pill: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Load fonts and set global background in `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Floripa.me — Seu roteiro por IA",
  description: "Responda 8 perguntas e receba um roteiro personalizado para Florianópolis, gerado por IA.",
  manifest: "/manifest.json",
  themeColor: "#0B1416",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-graphite text-ink font-body min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx` with a minimal welcome screen**

This checks `localStorage` for a previously generated itinerary (saved by Task 11) so a returning visitor can jump straight back in instead of retaking the quiz — that persistence-without-login behavior is required by the spec (§ PWA, link e edição sem login).

```tsx
// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WelcomePage() {
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  useEffect(() => {
    setLastSlug(window.localStorage.getItem("floripa_last_itinerary_slug"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl font-extrabold leading-tight">
        Sua ilha,<br />seu jeito.
      </h1>
      <p className="max-w-xs text-sm text-ink-dim">
        Responda 8 perguntas rápidas e receba um roteiro completo em Florianópolis, feito por IA.
      </p>
      <Link
        href="/quiz"
        className="rounded-pill bg-gradient-to-r from-turquoise to-blue px-8 py-3 font-display font-extrabold text-graphite"
      >
        Começar →
      </Link>
      {lastSlug && (
        <Link href={`/roteiro/${lastSlug}`} className="text-sm text-ink-dim underline">
          Continuar meu último roteiro
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Install and configure Vitest**

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 6: Write the smoke test**

```tsx
// src/app/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import WelcomePage from "./page";

describe("WelcomePage", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the welcome headline and a link to the quiz", () => {
    render(<WelcomePage />);
    expect(screen.getByText(/sua ilha/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /começar/i })).toHaveAttribute("href", "/quiz");
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

- [ ] **Step 7: Run the test and the build**

Run: `npm run test -- src/app/page.test.tsx`
Expected: PASS (3 tests).

Run: `npm run build`
Expected: build succeeds (the `/quiz` route will 404 at runtime until Task 11 — that's fine, it's not statically checked).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Ilha Neon Noturna design tokens"
```

---

## Task 2: PWA manifest, icons, service worker

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `public/manifest.json`, `public/sw.js`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (generated, not hand-written)
- Modify: `src/app/layout.tsx` (register service worker)
- Test: `scripts/generate-icons.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `public/icons/icon-192.png`, `public/icons/icon-512.png` referenced by `public/manifest.json`.

- [ ] **Step 1: Install sharp**

```bash
npm install --save-dev sharp
```

- [ ] **Step 2: Write the icon generator**

```js
// scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "fs/promises";

const SVG = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00E6C8"/>
      <stop offset="100%" stop-color="#00A8E0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#0B1416"/>
  <circle cx="176" cy="176" r="150" fill="url(#g)" opacity="0.35"/>
  <text x="256" y="336" font-family="Georgia, serif" font-size="260" font-weight="800" fill="#00E6C8" text-anchor="middle">F</text>
</svg>`;

export async function generateIcons(outDir = "public/icons", sizes = [192, 512]) {
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const size of sizes) {
    const filePath = `${outDir}/icon-${size}.png`;
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(filePath);
    written.push(filePath);
  }
  return written;
}

const isMain = process.argv[1] && process.argv[1].endsWith("generate-icons.mjs");
if (isMain) {
  generateIcons().then((files) => console.log("Generated:", files.join(", ")));
}
```

- [ ] **Step 3: Write a test for the generator**

```js
// scripts/generate-icons.test.mjs
import { describe, it, expect, afterAll } from "vitest";
import { rm, stat } from "fs/promises";
import { generateIcons } from "./generate-icons.mjs";

const OUT_DIR = "test-output/icons";

describe("generateIcons", () => {
  afterAll(async () => {
    await rm("test-output", { recursive: true, force: true });
  });

  it("writes a PNG file for each requested size", async () => {
    const files = await generateIcons(OUT_DIR, [64, 128]);
    expect(files).toEqual([`${OUT_DIR}/icon-64.png`, `${OUT_DIR}/icon-128.png`]);
    for (const file of files) {
      const stats = await stat(file);
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm run test -- scripts/generate-icons.test.mjs`
Expected: PASS.

- [ ] **Step 5: Generate the real icons**

Run: `node scripts/generate-icons.mjs`
Expected: `public/icons/icon-192.png` and `public/icons/icon-512.png` exist.

- [ ] **Step 6: Write the manifest**

```json
{
  "name": "Floripa.me",
  "short_name": "Floripa.me",
  "description": "Seu roteiro personalizado em Florianópolis, gerado por IA.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0B1416",
  "theme_color": "#0B1416",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 7: Write a minimal service worker**

```js
// public/sw.js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // presence is enough for installability
```

- [ ] **Step 8: Register the service worker in the layout**

Add to `src/app/layout.tsx`, inside `<body>` before `{children}`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
  }}
/>
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add PWA manifest, generated icons, and service worker"
```

---

## Task 3: Supabase schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.local.example`

**Interfaces:**
- Produces: tables `places`, `events`, `sos_places`, `itineraries` that every later Supabase-touching task reads/writes.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/0001_init.sql
create extension if not exists "pgcrypto";

create table places (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  neighborhood text not null,
  name text not null,
  category text not null,
  target_profiles text[] not null default '{}',
  price_range text not null check (price_range in ('Gratuito','R$','R$$','R$$$')),
  point_type text not null,
  short_description text not null default '',
  address text not null default '',
  opening_hours text,
  phone text,
  instagram text,
  notes text,
  google_place_id text,
  lat double precision,
  lng double precision,
  rating double precision,
  photos text[] not null default '{}',
  is_partner boolean not null default false,
  partner_plan text,
  partner_offer text,
  partner_status text,
  special_needs_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_month int not null check (start_month between 1 and 12),
  end_month int not null check (end_month between 1 and 12),
  location text not null default '',
  target_profiles text[] not null default '{}',
  is_free text not null default 'Não',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table sos_places (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('saude','veiculo','seguranca','financeiro')),
  tag text not null check (tag in ('publico','parceiro')),
  name text not null,
  meta text not null default '',
  lat double precision,
  lng double precision,
  phone text,
  created_at timestamptz not null default now()
);

create table itineraries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  quiz_answers jsonb not null,
  welcome_message text not null,
  days jsonb not null,
  created_at timestamptz not null default now()
);

create index places_category_idx on places (category);
create index places_is_partner_idx on places (is_partner);
create index events_active_idx on events (active);
create index itineraries_slug_idx on itineraries (slug);
```

- [ ] **Step 2: Document required env vars**

```bash
# .env.local.example
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 3: Apply the migration**

Run: `npx supabase login` (once, interactively, if not already authenticated), then link the project and push:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Expected: CLI reports the 4 tables created with no errors. (If the executor doesn't have a Supabase project yet, create one at supabase.com first — this step cannot be automated further; note that dependency in the task's PR/commit message.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add Supabase schema migration for places, events, sos_places, itineraries"
```

---

## Task 4: Supabase client + typed query helpers

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/queries.ts`
- Test: `src/lib/supabase/queries.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` env vars (Task 3).
- Produces: `Place`, `EventRow`, `SosPlace`, `ItineraryRow` types and `listPlaces`, `listEvents`, `listSosPlaces`, `insertItinerary`, `getItineraryBySlug`, `updateItineraryDays` functions consumed by Tasks 5, 6, 12, 17, 19–22, 24.

- [ ] **Step 1: Install the Supabase client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Write the row types**

```ts
// src/lib/supabase/types.ts
export interface Place {
  id: string;
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: "Gratuito" | "R$" | "R$$" | "R$$$";
  point_type: string;
  short_description: string;
  address: string;
  opening_hours: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
  is_partner: boolean;
  partner_plan: string | null;
  partner_offer: string | null;
  partner_status: string | null;
  special_needs_tags: string[];
  created_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  start_month: number;
  end_month: number;
  location: string;
  target_profiles: string[];
  is_free: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SosPlace {
  id: string;
  category: "saude" | "veiculo" | "seguranca" | "financeiro";
  tag: "publico" | "parceiro";
  name: string;
  meta: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  created_at: string;
}

export interface ItineraryRow {
  id: string;
  slug: string;
  quiz_answers: Record<string, unknown>;
  welcome_message: string;
  days: unknown;
  created_at: string;
}
```

- [ ] **Step 3: Write the admin client factory**

```ts
// src/lib/supabase/client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}
```

- [ ] **Step 4: Write the failing test for the query helpers**

```ts
// src/lib/supabase/queries.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listPlaces,
  listEvents,
  listSosPlaces,
  insertItinerary,
  getItineraryBySlug,
  updateItineraryDays,
} from "./queries";

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.insert = self;
  chain.update = self;
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve: (r: typeof result) => void) => resolve(result);
  return chain;
}

function fakeClientFor(table: string, chain: unknown): SupabaseClient {
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
}

describe("queries", () => {
  it("listPlaces returns all rows from the places table", async () => {
    const rows = [{ id: "1", name: "Praia do Campeche" }];
    const client = fakeClientFor("places", makeChain({ data: rows, error: null }));
    await expect(listPlaces(client)).resolves.toEqual(rows);
    expect(client.from).toHaveBeenCalledWith("places");
  });

  it("listEvents filters to active events", async () => {
    const rows = [{ id: "1", name: "Carnaval" }];
    const client = fakeClientFor("events", makeChain({ data: rows, error: null }));
    await expect(listEvents(client)).resolves.toEqual(rows);
    expect(client.from).toHaveBeenCalledWith("events");
  });

  it("listSosPlaces returns rows for a given category", async () => {
    const rows = [{ id: "1", category: "saude" }];
    const client = fakeClientFor("sos_places", makeChain({ data: rows, error: null }));
    await expect(listSosPlaces(client, "saude")).resolves.toEqual(rows);
  });

  it("insertItinerary inserts and returns the created row", async () => {
    const row = { slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [] };
    const created = { id: "1", ...row, created_at: "2026-01-01T00:00:00Z" };
    const client = fakeClientFor("itineraries", makeChain({ data: created, error: null }));
    await expect(insertItinerary(client, row)).resolves.toEqual(created);
  });

  it("getItineraryBySlug returns null when not found", async () => {
    const client = fakeClientFor("itineraries", makeChain({ data: null, error: null }));
    await expect(getItineraryBySlug(client, "missing")).resolves.toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const client = fakeClientFor("places", makeChain({ data: null, error: new Error("boom") }));
    await expect(listPlaces(client)).rejects.toThrow("boom");
  });

  it("updateItineraryDays updates the days column and returns the row", async () => {
    const updated = { id: "1", slug: "abc123", days: [{ day_number: 1 }] };
    const client = fakeClientFor("itineraries", makeChain({ data: updated, error: null }));
    await expect(updateItineraryDays(client, "abc123", [{ day_number: 1 }])).resolves.toEqual(updated);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test -- src/lib/supabase/queries.test.ts`
Expected: FAIL — `./queries` has no exported member `listPlaces` (module doesn't exist yet).

- [ ] **Step 6: Implement the query helpers**

```ts
// src/lib/supabase/queries.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place, EventRow, SosPlace, ItineraryRow } from "./types";

export async function listPlaces(client: SupabaseClient): Promise<Place[]> {
  const { data, error } = await client.from("places").select("*");
  if (error) throw error;
  return data as Place[];
}

export async function listEvents(client: SupabaseClient): Promise<EventRow[]> {
  const { data, error } = await client.from("events").select("*").eq("active", true);
  if (error) throw error;
  return data as EventRow[];
}

export async function listSosPlaces(client: SupabaseClient, category?: string): Promise<SosPlace[]> {
  const base = client.from("sos_places").select("*");
  const query = category ? base.eq("category", category) : base;
  const { data, error } = await query;
  if (error) throw error;
  return data as SosPlace[];
}

export async function insertItinerary(
  client: SupabaseClient,
  row: Omit<ItineraryRow, "id" | "created_at">,
): Promise<ItineraryRow> {
  const { data, error } = await client.from("itineraries").insert(row).select().single();
  if (error) throw error;
  return data as ItineraryRow;
}

export async function getItineraryBySlug(client: SupabaseClient, slug: string): Promise<ItineraryRow | null> {
  const { data, error } = await client.from("itineraries").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as ItineraryRow | null;
}

export async function updateItineraryDays(
  client: SupabaseClient,
  slug: string,
  days: unknown,
): Promise<ItineraryRow> {
  const { data, error } = await client.from("itineraries").update({ days }).eq("slug", slug).select().single();
  if (error) throw error;
  return data as ItineraryRow;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test -- src/lib/supabase/queries.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add typed Supabase query helpers for places, events, sos_places, itineraries"
```

---

## Task 5: Excel migration script (seed `places` and `events`)

**Files:**
- Create: `scripts/lib/parseBancoDeLocais.ts`
- Create: `scripts/migrate-excel.ts`
- Test: `scripts/lib/parseBancoDeLocais.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdminClient` (Task 4).
- Produces: `parsePlacesSheet(matrix)`, `parseEventsSheet(matrix)` — pure functions other scripts don't depend on, but which must stay stable since re-running the migration re-parses the same source file.

The source workbook has header rows and "fill down" values (a bairro like `Campeche` is written once, then blank on the rows that follow) plus region-banner rows (`▌  SUL DA ILHA`) and a trailing "Preencha um novo local..." placeholder row per region — all of which must be skipped or forward-filled rather than inserted as data.

- [ ] **Step 1: Install the xlsx reader**

```bash
npm install xlsx
```

- [ ] **Step 2: Write the failing test for the parsers**

```ts
// scripts/lib/parseBancoDeLocais.test.ts
import { describe, it, expect } from "vitest";
import { parsePlacesSheet, parseEventsSheet } from "./parseBancoDeLocais";

const PLACES_HEADER = [
  "#", "REGIÃO", "BAIRRO / LOCAL", "NOME DO ESTABELECIMENTO", "CATEGORIA",
  "PERFIL IDEAL", "FAIXA DE PREÇO", "TIPO DE PONTO", "PARCEIRO FLORIPA.ME",
  "DESCRIÇÃO CURTA (para o roteiro)", "ENDEREÇO / REFERÊNCIA",
  "HORÁRIO DE FUNCIONAMENTO", "TELEFONE / WHATSAPP", "INSTAGRAM",
  "LINK GOOGLE MAPS", "OBSERVAÇÕES / DICAS LOCAIS",
];

describe("parsePlacesSheet", () => {
  it("skips region banner rows and forward-fills região/bairro", () => {
    const matrix = [
      PLACES_HEADER,
      ["▌  SUL DA ILHA"],
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Casal, Amigos, Solo", "Gratuito", "Ponto Turístico", "Sim", "Praia extensa.", "Praia do Campeche, Florianópolis", "", "", "", "", ""],
      ["02", "", "", "Tia Jú", "Gastronomia", "Todos", "R$ (econômico)", "Restaurante", "Não", "Comida caseira farta.", "Av. Campeche, Campeche", "", "", "", "", ""],
    ];

    const result = parsePlacesSheet(matrix);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche", is_partner: true });
    expect(result[1]).toMatchObject({ region: "Sul", neighborhood: "Campeche", name: "Tia Jú", is_partner: false });
  });

  it("splits the perfil ideal column on commas into target_profiles", () => {
    const matrix = [
      PLACES_HEADER,
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Casal, Amigos, Solo", "Gratuito", "Ponto Turístico", "Sim", "d", "e", "", "", "", "", ""],
    ];
    const result = parsePlacesSheet(matrix);
    expect(result[0].target_profiles).toEqual(["Casal", "Amigos", "Solo"]);
  });

  it("skips the trailing 'preencha um novo local' placeholder row", () => {
    const matrix = [
      PLACES_HEADER,
      ["01", "Sul", "Campeche", "Praia do Campeche", "Praia", "Todos", "Gratuito", "Ponto Turístico", "Sim", "d", "e", "", "", "", "", ""],
      ["→", "", "", "Preencha um novo local desta região aqui", "", "", "", "", "", "", "", "", "", "", "", ""],
    ];
    expect(parsePlacesSheet(matrix)).toHaveLength(1);
  });

  it("skips fully blank rows", () => {
    const matrix = [PLACES_HEADER, [], ["01", "Sul", "Campeche", "X", "Praia", "Todos", "Gratuito", "Ponto Turístico", "Não", "d", "e", "", "", "", "", ""]];
    expect(parsePlacesSheet(matrix)).toHaveLength(1);
  });
});

describe("parseEventsSheet", () => {
  const EVENTS_HEADER = ["EVENTO", "MÊS INÍCIO", "MÊS FIM", "LOCAL", "GRATUITO", "ATIVO", "OBSERVAÇÕES / INJETAR NO ROTEIRO"];

  it("parses month names into 1-12 and defaults target_profiles to Todos when no perfil column exists", () => {
    const matrix = [
      EVENTS_HEADER,
      ["Fenaostra", "Julho", "Julho", "CentroSul", "Parcial", true, "Festa Nacional da Ostra."],
    ];
    const result = parseEventsSheet(matrix);
    expect(result[0]).toMatchObject({
      name: "Fenaostra",
      start_month: 7,
      end_month: 7,
      location: "CentroSul",
      is_free: "Parcial",
      active: true,
      target_profiles: ["Todos"],
    });
  });

  it("skips rows with no event name", () => {
    const matrix = [EVENTS_HEADER, ["", "", "", "", "", "", ""]];
    expect(parseEventsSheet(matrix)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- scripts/lib/parseBancoDeLocais.test.ts`
Expected: FAIL — module `./parseBancoDeLocais` not found.

- [ ] **Step 4: Implement the parsers**

```ts
// scripts/lib/parseBancoDeLocais.ts
type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

export interface ParsedPlace {
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: string;
  point_type: string;
  is_partner: boolean;
  short_description: string;
  address: string;
  opening_hours: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
}

export interface ParsedEvent {
  name: string;
  start_month: number;
  end_month: number;
  location: string;
  target_profiles: string[];
  is_free: string;
  active: boolean;
  notes: string | null;
}

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function str(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

function columnIndex(header: Row, name: string): number {
  const idx = header.findIndex((h) => str(h).toUpperCase() === name.toUpperCase());
  if (idx === -1) throw new Error(`Column not found: ${name}`);
  return idx;
}

function isBlankRow(row: Row): boolean {
  return row.every((cell) => str(cell) === "");
}

export function parsePlacesSheet(matrix: Row[]): ParsedPlace[] {
  const [header, ...rows] = matrix;
  const col = {
    region: columnIndex(header, "REGIÃO"),
    neighborhood: columnIndex(header, "BAIRRO / LOCAL"),
    name: columnIndex(header, "NOME DO ESTABELECIMENTO"),
    category: columnIndex(header, "CATEGORIA"),
    profiles: columnIndex(header, "PERFIL IDEAL"),
    price: columnIndex(header, "FAIXA DE PREÇO"),
    pointType: columnIndex(header, "TIPO DE PONTO"),
    partner: columnIndex(header, "PARCEIRO FLORIPA.ME"),
    description: columnIndex(header, "DESCRIÇÃO CURTA (para o roteiro)"),
    address: columnIndex(header, "ENDEREÇO / REFERÊNCIA"),
    hours: columnIndex(header, "HORÁRIO DE FUNCIONAMENTO"),
    phone: columnIndex(header, "TELEFONE / WHATSAPP"),
    instagram: columnIndex(header, "INSTAGRAM"),
    notes: columnIndex(header, "OBSERVAÇÕES / DICAS LOCAIS"),
  };

  let lastRegion = "";
  let lastNeighborhood = "";
  const results: ParsedPlace[] = [];

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    if (str(row[0]).startsWith("▌")) continue; // region banner row
    if (str(row[col.name]).toLowerCase().startsWith("preencha um novo local")) continue;
    if (str(row[col.name]) === "") continue;

    const region = str(row[col.region]) || lastRegion;
    const neighborhood = str(row[col.neighborhood]) || lastNeighborhood;
    lastRegion = region;
    lastNeighborhood = neighborhood;

    results.push({
      region,
      neighborhood,
      name: str(row[col.name]),
      category: str(row[col.category]),
      target_profiles: str(row[col.profiles]).split(",").map((s) => s.trim()).filter(Boolean),
      price_range: str(row[col.price]),
      point_type: str(row[col.pointType]),
      is_partner: str(row[col.partner]).toLowerCase() === "sim",
      short_description: str(row[col.description]),
      address: str(row[col.address]),
      opening_hours: str(row[col.hours]) || null,
      phone: str(row[col.phone]) || null,
      instagram: str(row[col.instagram]) || null,
      notes: str(row[col.notes]) || null,
    });
  }

  return results;
}

export function parseEventsSheet(matrix: Row[]): ParsedEvent[] {
  const [header, ...rows] = matrix;
  const col = {
    name: columnIndex(header, "EVENTO"),
    startMonth: columnIndex(header, "MÊS INÍCIO"),
    endMonth: columnIndex(header, "MÊS FIM"),
    location: columnIndex(header, "LOCAL"),
    free: columnIndex(header, "GRATUITO"),
    active: columnIndex(header, "ATIVO"),
    notes: columnIndex(header, "OBSERVAÇÕES / INJETAR NO ROTEIRO"),
  };
  const profilesIdx = header.findIndex((h) => str(h).toUpperCase().includes("PERFIL"));

  const results: ParsedEvent[] = [];
  for (const row of rows) {
    const name = str(row[col.name]);
    if (!name) continue;

    results.push({
      name,
      start_month: MONTHS[str(row[col.startMonth]).toLowerCase()] ?? 0,
      end_month: MONTHS[str(row[col.endMonth]).toLowerCase()] ?? MONTHS[str(row[col.startMonth]).toLowerCase()] ?? 0,
      location: str(row[col.location]),
      target_profiles: profilesIdx >= 0 && str(row[profilesIdx])
        ? str(row[profilesIdx]).split(",").map((s) => s.trim()).filter(Boolean)
        : ["Todos"],
      is_free: str(row[col.free]) || "Não",
      active: row[col.active] === true || str(row[col.active]).toLowerCase() === "sim",
      notes: str(row[col.notes]) || null,
    });
  }
  return results;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- scripts/lib/parseBancoDeLocais.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the runner script**

```ts
// scripts/migrate-excel.ts
import * as XLSX from "xlsx";
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { parsePlacesSheet, parseEventsSheet } from "./lib/parseBancoDeLocais";

const SOURCE_PATH = process.argv[2] ?? "../floripa-me-banco-locais.xlsx";

async function main() {
  const workbook = XLSX.readFile(SOURCE_PATH);

  const placesSheet = workbook.Sheets["Banco de Locais"];
  const placesMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(placesSheet, { header: 1 });
  const places = parsePlacesSheet(placesMatrix);

  const eventsSheet = workbook.Sheets["Eventos Anuais"];
  const eventsMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(eventsSheet, { header: 1 });
  const events = parseEventsSheet(eventsMatrix);

  const client = getSupabaseAdminClient();

  const { error: placesError } = await client.from("places").insert(places);
  if (placesError) throw placesError;
  console.log(`Inserted ${places.length} places.`);

  const { error: eventsError } = await client.from("events").insert(events);
  if (eventsError) throw eventsError;
  console.log(`Inserted ${events.length} events.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` `scripts`: `"migrate:excel": "tsx scripts/migrate-excel.ts"`. Install the runner: `npm install --save-dev tsx`.

- [ ] **Step 7: Run the migration against the real spreadsheet and spot-check**

Run: `npm run migrate:excel -- "../floripa-me-banco-locais.xlsx"`
Expected: console reports rows inserted with no errors. Then, in Supabase Studio, open the `places` table and spot-check 5 rows (including a row that relied on forward-fill, like "Tia Jú") against the original spreadsheet to confirm region/bairro/category/partner flag came through correctly. Fix the parser if a mismatch turns up — the sheet's exact column layout was inferred from a text dump, not a byte-for-byte read, so a first-run discrepancy is expected to be checked here, not assumed away.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Excel migration script seeding places and events from the curated spreadsheet"
```

---

## Task 6: Google Places discovery script

**Files:**
- Create: `scripts/lib/placesApi.ts`
- Create: `scripts/places-discover.ts`
- Test: `scripts/lib/placesApi.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdminClient`, `listPlaces` (Task 4).
- Produces: `buildTextSearchRequest`, `mapDiscoveryResult` — reused by Task 7's enrichment script.

- [ ] **Step 1: Write the failing test for the pure request/mapping functions**

```ts
// scripts/lib/placesApi.test.ts
import { describe, it, expect } from "vitest";
import { buildTextSearchRequest, mapDiscoveryResult } from "./placesApi";

describe("buildTextSearchRequest", () => {
  it("builds the Places API (New) Text Search request", () => {
    const req = buildTextSearchRequest({ query: "restaurante Lagoa da Conceição", region: "Leste", category: "Gastronomia" }, "fake-key");
    expect(req.url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(req.headers["X-Goog-Api-Key"]).toBe("fake-key");
    expect(req.headers["X-Goog-FieldMask"]).toContain("places.displayName");
    expect(JSON.parse(req.body)).toEqual({ textQuery: "restaurante Lagoa da Conceição", languageCode: "pt-BR" });
  });
});

describe("mapDiscoveryResult", () => {
  it("maps a Places API result into a new place candidate, not a partner by default", () => {
    const apiPlace = {
      id: "ChIJ-fake-id",
      displayName: { text: "Restaurante do Ceará" },
      formattedAddress: "Lagoa da Conceição, Florianópolis",
      location: { latitude: -27.6, longitude: -48.45 },
      rating: 4.5,
      photos: [{ name: "places/ChIJ-fake-id/photos/abc" }],
    };
    const seed = { query: "restaurante Lagoa da Conceição", region: "Leste", category: "Gastronomia" };

    const result = mapDiscoveryResult(apiPlace, seed, "fake-key");

    expect(result).toMatchObject({
      region: "Leste",
      name: "Restaurante do Ceará",
      category: "Gastronomia",
      address: "Lagoa da Conceição, Florianópolis",
      google_place_id: "ChIJ-fake-id",
      lat: -27.6,
      lng: -48.45,
      rating: 4.5,
      is_partner: false,
    });
    expect(result.photos[0]).toContain("places/ChIJ-fake-id/photos/abc/media");
  });

  it("falls back to safe defaults when optional fields are missing", () => {
    const apiPlace = { id: "ChIJ-2" };
    const seed = { query: "trilha Sul", region: "Sul", category: "Trilha" };
    const result = mapDiscoveryResult(apiPlace, seed, "fake-key");
    expect(result.name).toBe("Sem nome");
    expect(result.lat).toBeNull();
    expect(result.photos).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- scripts/lib/placesApi.test.ts`
Expected: FAIL — module `./placesApi` not found.

- [ ] **Step 3: Implement the pure functions**

```ts
// scripts/lib/placesApi.ts
export interface DiscoverySeed {
  query: string;
  region: string;
  category: string;
}

export interface PlacesApiPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  photos?: { name: string }[];
}

export interface NewPlaceCandidate {
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: string;
  point_type: string;
  short_description: string;
  address: string;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
  is_partner: boolean;
  special_needs_tags: string[];
}

const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos";

export function buildTextSearchRequest(seed: DiscoverySeed, apiKey: string) {
  return {
    url: "https://places.googleapis.com/v1/places:searchText",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: seed.query, languageCode: "pt-BR" }),
  };
}

export function mapDiscoveryResult(apiPlace: PlacesApiPlace, seed: DiscoverySeed, apiKey: string): NewPlaceCandidate {
  return {
    region: seed.region,
    neighborhood: seed.region,
    name: apiPlace.displayName?.text ?? "Sem nome",
    category: seed.category,
    target_profiles: ["Todos"],
    price_range: "R$$",
    point_type: seed.category,
    short_description: "",
    address: apiPlace.formattedAddress ?? "",
    google_place_id: apiPlace.id,
    lat: apiPlace.location?.latitude ?? null,
    lng: apiPlace.location?.longitude ?? null,
    rating: apiPlace.rating ?? null,
    photos: (apiPlace.photos ?? [])
      .slice(0, 3)
      .map((p) => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`),
    is_partner: false,
    special_needs_tags: [],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- scripts/lib/placesApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the discovery runner**

```ts
// scripts/places-discover.ts
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces } from "../src/lib/supabase/queries";
import { buildTextSearchRequest, mapDiscoveryResult, type DiscoverySeed } from "./lib/placesApi";

const SEEDS: DiscoverySeed[] = [
  { query: "praia Sul da Ilha Florianópolis", region: "Sul", category: "Praia" },
  { query: "restaurante Campeche Florianópolis", region: "Sul", category: "Gastronomia" },
  { query: "restaurante Lagoa da Conceição Florianópolis", region: "Leste", category: "Gastronomia" },
  { query: "bar Lagoa da Conceição Florianópolis", region: "Leste", category: "Bar / Noturno" },
  { query: "restaurante Jurerê Florianópolis", region: "Norte", category: "Gastronomia" },
  { query: "trilha Florianópolis", region: "Sul", category: "Trilha" },
];

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY must be set");

  const client = getSupabaseAdminClient();
  const existing = await listPlaces(client);
  const knownIds = new Set(existing.map((p) => p.google_place_id).filter(Boolean));

  let inserted = 0;
  for (const seed of SEEDS) {
    const req = buildTextSearchRequest(seed, apiKey);
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (!response.ok) {
      console.error(`Search failed for "${seed.query}": ${response.status}`);
      continue;
    }
    const json = (await response.json()) as { places?: Array<Parameters<typeof mapDiscoveryResult>[0]> };
    for (const apiPlace of json.places ?? []) {
      if (knownIds.has(apiPlace.id)) continue;
      const candidate = mapDiscoveryResult(apiPlace, seed, apiKey);
      const { error } = await client.from("places").insert(candidate);
      if (error) {
        console.error(`Insert failed for ${candidate.name}:`, error.message);
        continue;
      }
      knownIds.add(apiPlace.id);
      inserted += 1;
    }
  }
  console.log(`Discovered and inserted ${inserted} new candidate places.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` `scripts`: `"places:discover": "tsx scripts/places-discover.ts"`.

- [ ] **Step 6: Run it once against the real API and review in Supabase Studio**

Run: `npm run places:discover`
Expected: console reports N new candidates inserted, all with `is_partner = false`. Open the `places` table in Supabase Studio and review the new rows — this is exactly the manual curation step described in the spec (§ Integração com Google Places): adjust `category`/`target_profiles`/`short_description`/`price_range` and flip `is_partner` for any you've closed a deal with.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Google Places discovery script for candidate establishments"
```

---

## Task 7: Google Places enrichment script

**Files:**
- Modify: `src/lib/supabase/queries.ts` (add `updatePlaceEnrichment`)
- Modify: `src/lib/supabase/queries.test.ts` (add its test)
- Modify: `scripts/lib/placesApi.ts` (add `mapEnrichmentUpdate`)
- Modify: `scripts/lib/placesApi.test.ts` (add its test)
- Create: `scripts/places-enrich.ts`

**Interfaces:**
- Consumes: `buildTextSearchRequest` (Task 6), `listPlaces` (Task 4).
- Produces: `updatePlaceEnrichment(client, id, patch)`, `mapEnrichmentUpdate(apiPlace, apiKey)`.

- [ ] **Step 1: Add the failing test for `updatePlaceEnrichment`**

Append to `src/lib/supabase/queries.test.ts`, inside the `describe("queries", ...)` block:

```ts
  it("updatePlaceEnrichment patches lat/lng/rating/photos/google_place_id for a place", async () => {
    const patch = { google_place_id: "ChIJ-x", lat: -27.6, lng: -48.5, rating: 4.7, photos: ["url1"] };
    const updated = { id: "1", ...patch };
    const client = fakeClientFor("places", makeChain({ data: updated, error: null }));
    await expect(updatePlaceEnrichment(client, "1", patch)).resolves.toEqual(updated);
  });
```

Add `updatePlaceEnrichment` to the existing import list at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/supabase/queries.test.ts`
Expected: FAIL — `updatePlaceEnrichment` is not exported.

- [ ] **Step 3: Implement `updatePlaceEnrichment`**

Append to `src/lib/supabase/queries.ts`:

```ts
export async function updatePlaceEnrichment(
  client: SupabaseClient,
  id: string,
  patch: Pick<Place, "google_place_id" | "lat" | "lng" | "rating" | "photos">,
): Promise<Place> {
  const { data, error } = await client.from("places").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Place;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/supabase/queries.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Add the failing test for `mapEnrichmentUpdate`**

Append to `scripts/lib/placesApi.test.ts`:

```ts
describe("mapEnrichmentUpdate", () => {
  it("maps a Places API result into an enrichment patch", () => {
    const apiPlace = {
      id: "ChIJ-fake-id",
      location: { latitude: -27.61, longitude: -48.46 },
      rating: 4.8,
      photos: [{ name: "places/ChIJ-fake-id/photos/xyz" }],
    };
    const result = mapEnrichmentUpdate(apiPlace, "fake-key");
    expect(result.google_place_id).toBe("ChIJ-fake-id");
    expect(result.lat).toBe(-27.61);
    expect(result.lng).toBe(-48.46);
    expect(result.rating).toBe(4.8);
    expect(result.photos[0]).toContain("places/ChIJ-fake-id/photos/xyz/media");
  });
});
```

Add `mapEnrichmentUpdate` to the import line at the top of the file.

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- scripts/lib/placesApi.test.ts`
Expected: FAIL — `mapEnrichmentUpdate` is not exported.

- [ ] **Step 7: Implement `mapEnrichmentUpdate`**

Append to `scripts/lib/placesApi.ts`:

```ts
export interface PlaceEnrichmentPatch {
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
}

export function mapEnrichmentUpdate(apiPlace: PlacesApiPlace, apiKey: string): PlaceEnrichmentPatch {
  return {
    google_place_id: apiPlace.id,
    lat: apiPlace.location?.latitude ?? null,
    lng: apiPlace.location?.longitude ?? null,
    rating: apiPlace.rating ?? null,
    photos: (apiPlace.photos ?? [])
      .slice(0, 3)
      .map((p) => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`),
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- scripts/lib/placesApi.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Write the enrichment runner**

```ts
// scripts/places-enrich.ts
import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { listPlaces, updatePlaceEnrichment } from "../src/lib/supabase/queries";
import { buildTextSearchRequest, mapEnrichmentUpdate } from "./lib/placesApi";

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY must be set");

  const client = getSupabaseAdminClient();
  const places = await listPlaces(client);
  const missingCoords = places.filter((p) => !p.google_place_id || p.lat === null);

  let enriched = 0;
  for (const place of missingCoords) {
    const req = buildTextSearchRequest(
      { query: `${place.name} ${place.address || place.neighborhood}`, region: place.region, category: place.category },
      apiKey,
    );
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });
    if (!response.ok) {
      console.error(`Search failed for "${place.name}": ${response.status}`);
      continue;
    }
    const json = (await response.json()) as { places?: Array<Parameters<typeof mapEnrichmentUpdate>[0]> };
    const bestMatch = json.places?.[0];
    if (!bestMatch) {
      console.warn(`No match found for "${place.name}" — skipping.`);
      continue;
    }
    const patch = mapEnrichmentUpdate(bestMatch, apiKey);
    await updatePlaceEnrichment(client, place.id, patch);
    enriched += 1;
  }
  console.log(`Enriched ${enriched}/${missingCoords.length} places.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add to `package.json` `scripts`: `"places:enrich": "tsx scripts/places-enrich.ts"`.

- [ ] **Step 10: Run it once against the real API**

Run: `npm run places:enrich`
Expected: console reports N/M places enriched. Spot-check a couple of the migrated (non-Places-sourced) rows in Supabase Studio to confirm `lat`/`lng`/`photos` were filled in correctly — a wrong text match (e.g. a same-named place in the wrong neighborhood) is possible with a single-result heuristic, so review before trusting it blindly.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Add Google Places enrichment script for migrated places"
```

---

## Task 8: Quiz questions data + types

**Files:**
- Create: `src/lib/quiz/types.ts`
- Create: `src/lib/quiz/questions.ts`
- Test: `src/lib/quiz/questions.test.ts`

**Interfaces:**
- Produces: `QuizQuestion`, `QuizAnswers` types and the `QUESTIONS` array consumed by Tasks 9–12.

- [ ] **Step 1: Write the types**

```ts
// src/lib/quiz/types.ts
export interface QuizOption {
  emoji: string;
  label: string;
  desc: string;
  value: string;
}

interface QuizQuestionBase {
  id: string;
  text: string;
  sub: string;
  optional?: boolean;
}

export interface QuizChoiceQuestion extends QuizQuestionBase {
  type: "rows" | "grid2";
  multi?: boolean;
  options: QuizOption[];
}

export interface QuizSliderQuestion extends QuizQuestionBase {
  type: "slider";
  min: number;
  max: number;
  default: number;
  unit: string;
}

export type QuizQuestion = QuizChoiceQuestion | QuizSliderQuestion;

export interface QuizAnswers {
  timing?: string;
  region?: string;
  days?: string;
  group?: string;
  style?: string[];
  transport?: string;
  budget?: number;
  special?: string;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/quiz/questions.test.ts
import { describe, it, expect } from "vitest";
import { QUESTIONS } from "./questions";

describe("QUESTIONS", () => {
  it("has exactly 8 questions in the documented order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "timing", "region", "days", "group", "style", "transport", "budget", "special",
    ]);
  });

  it("marks region and special as optional, and the rest as required", () => {
    const optional = QUESTIONS.filter((q) => q.optional).map((q) => q.id);
    expect(optional).toEqual(["region", "special"]);
  });

  it("marks style as the only multi-select question", () => {
    const multi = QUESTIONS.filter((q) => q.type !== "slider" && q.multi).map((q) => q.id);
    expect(multi).toEqual(["style"]);
  });

  it("gives the budget slider a default within its min/max range", () => {
    const budget = QUESTIONS.find((q) => q.id === "budget");
    if (budget?.type !== "slider") throw new Error("budget must be a slider question");
    expect(budget.default).toBeGreaterThanOrEqual(budget.min);
    expect(budget.default).toBeLessThanOrEqual(budget.max);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/quiz/questions.test.ts`
Expected: FAIL — module `./questions` not found.

- [ ] **Step 4: Implement the questions data**

Content reused verbatim from the previous project's `floripa-me-quiz_ULTIMO.html` (spec § Migração de dados existentes).

```ts
// src/lib/quiz/questions.ts
import type { QuizQuestion } from "./types";

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "timing",
    text: "Como você chega em Floripa?",
    sub: "Isso nos ajuda a montar o roteiro desde a sua chegada.",
    type: "rows",
    options: [
      { emoji: "✈️", label: "Vou chegar de avião", desc: "Aeroporto Hercílio Luz", value: "aviao" },
      { emoji: "🚌", label: "Vou chegar de ônibus", desc: "Terminal TICEN ou Rodoviária", value: "onibus_chegada" },
      { emoji: "🚗", label: "Vou chegar de carro", desc: "Já tenho meu próprio veículo", value: "carro_chegada" },
      { emoji: "📍", label: "Já estou em Floripa", desc: "Quero o roteiro agora!", value: "agora" },
    ],
  },
  {
    id: "region",
    text: "Onde você vai se hospedar?",
    sub: "Isso nos ajuda a montar um roteiro logisticamente inteligente para você.",
    type: "rows",
    optional: true,
    options: [
      { emoji: "🏛️", label: "Centro / Continente", desc: "Próximo ao centro histórico", value: "centro" },
      { emoji: "🌴", label: "Norte da Ilha", desc: "Jurerê, Ingleses, Canasvieiras", value: "norte" },
      { emoji: "🌊", label: "Leste da Ilha", desc: "Lagoa da Conceição, Barra da Lagoa", value: "leste" },
      { emoji: "🌿", label: "Sul da Ilha", desc: "Campeche, Armação, Pântano do Sul", value: "sul" },
      { emoji: "🔍", label: "Ainda não tenho hospedagem", desc: "Me indica uma pousada parceira!", value: "semhospedagem" },
      { emoji: "🤷", label: "Prefiro não informar", desc: "Seguir com roteiro geral", value: "nao" },
    ],
  },
  {
    id: "days",
    text: "Quantos dias você vai ficar em Floripa?",
    sub: "Vamos montar o roteiro certinho para o seu tempo.",
    type: "grid2",
    options: [
      { emoji: "⚡", label: "1 dia", desc: "Só um dia, mas intenso", value: "1" },
      { emoji: "🌅", label: "2 dias", desc: "Um fim de semana perfeito", value: "2" },
      { emoji: "🏝️", label: "3 a 4 dias", desc: "Tempo bom para explorar", value: "3-4" },
      { emoji: "✈️", label: "5 dias ou mais", desc: "Mergulho completo na ilha", value: "5+" },
    ],
  },
  {
    id: "group",
    text: "Como você está viajando?",
    sub: "O roteiro muda bastante dependendo da companhia.",
    type: "grid2",
    options: [
      { emoji: "🙋", label: "Solo", desc: "Na minha", value: "solo" },
      { emoji: "💑", label: "Casal", desc: "A dois", value: "casal" },
      { emoji: "👨‍👩‍👧", label: "Família", desc: "Com crianças", value: "familia" },
      { emoji: "🎉", label: "Amigos", desc: "Em grupo", value: "amigos" },
    ],
  },
  {
    id: "style",
    text: "Qual é o seu estilo de viagem?",
    sub: "Pode escolher mais de um! Escolha tudo que combina com você.",
    type: "grid2",
    multi: true,
    options: [
      { emoji: "🏄", label: "Praia, Surf & Aventura", desc: "Mar, trilhas e natureza", value: "praia" },
      { emoji: "🍽️", label: "Gastronomia", desc: "Comer bem é obrigação", value: "gastronomia" },
      { emoji: "🛍️", label: "Compras", desc: "Shoppings, feiras e lojas", value: "compras" },
      { emoji: "🏛️", label: "Lazer & Cultura", desc: "História, arte e passeios", value: "cultura" },
      { emoji: "🌙", label: "Balada & Bares", desc: "A noite é jovem", value: "noite" },
      { emoji: "💼", label: "Negócios", desc: "Trabalho + aproveitar a cidade", value: "negocios" },
    ],
  },
  {
    id: "transport",
    text: "Como você vai se locomover?",
    sub: "Isso afeta muito o seu roteiro.",
    type: "rows",
    options: [
      { emoji: "🚗", label: "Tenho carro / moto", desc: "Liberdade total para explorar", value: "carro" },
      { emoji: "📱", label: "Uber / 99", desc: "Prático e sem preocupação", value: "app" },
      { emoji: "🚌", label: "Ônibus / transporte público", desc: "Econômico e sustentável", value: "onibus" },
      { emoji: "🚶", label: "A pé e aluguel eventual", desc: "Curto, exploro devagar", value: "pe" },
    ],
  },
  {
    id: "budget",
    text: "Qual o seu orçamento diário?",
    sub: "Valor estimado por pessoa, tudo incluído.",
    type: "slider",
    min: 50,
    max: 600,
    default: 150,
    unit: "R$",
  },
  {
    id: "special",
    text: "Alguma necessidade especial?",
    sub: "Opcional — mas ajuda a personalizar melhor.",
    type: "rows",
    optional: true,
    options: [
      { emoji: "🦽", label: "Acessibilidade", desc: "Mobilidade reduzida no grupo", value: "acessibilidade" },
      { emoji: "🌱", label: "Vegetariano / vegano", desc: "Preciso de opções plant-based", value: "vegano" },
      { emoji: "👶", label: "Crianças pequenas", desc: "Bebê ou criança até 5 anos", value: "bebe" },
      { emoji: "🐾", label: "Pet friendly", desc: "Viajando com o bichinho", value: "pet" },
      { emoji: "✌️", label: "Nenhuma", desc: "Pode mandar o roteiro normal", value: "nenhuma" },
    ],
  },
];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/quiz/questions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the 8 quiz questions, reused from the previous project's copy"
```

---

## Task 9: Quiz navigation hook

**Files:**
- Create: `src/lib/quiz/useQuizFlow.ts`
- Test: `src/lib/quiz/useQuizFlow.test.ts`

**Interfaces:**
- Consumes: `QUESTIONS`, `QuizQuestion`, `QuizAnswers` (Task 8).
- Produces: `useQuizFlow(questions)` returning `{ currentIndex, currentQuestion, answers, isComplete, canGoNext, canGoBack, answer, goNext, goBack }`, consumed by Task 11's quiz page.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/quiz/useQuizFlow.test.ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuizFlow } from "./useQuizFlow";
import type { QuizQuestion } from "./types";

const QUESTIONS: QuizQuestion[] = [
  { id: "timing", text: "t1", sub: "s1", type: "rows", options: [{ emoji: "a", label: "A", desc: "d", value: "a" }] },
  { id: "region", text: "t2", sub: "s2", type: "rows", optional: true, options: [{ emoji: "a", label: "A", desc: "d", value: "a" }] },
  { id: "style", text: "t3", sub: "s3", type: "grid2", multi: true, options: [{ emoji: "a", label: "A", desc: "d", value: "a" }, { emoji: "b", label: "B", desc: "d", value: "b" }] },
  { id: "budget", text: "t4", sub: "s4", type: "slider", min: 50, max: 600, default: 150, unit: "R$" },
];

describe("useQuizFlow", () => {
  it("starts at the first question with canGoNext false for a required unanswered question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentQuestion.id).toBe("timing");
    expect(result.current.canGoNext).toBe(false);
  });

  it("allows advancing an optional question without answering it", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    expect(result.current.currentQuestion.id).toBe("region");
    expect(result.current.canGoNext).toBe(true);
  });

  it("requires at least one selection for a multi-select question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext()); // skip optional region
    expect(result.current.currentQuestion.id).toBe("style");
    expect(result.current.canGoNext).toBe(false);
    act(() => result.current.answer("style", ["a"]));
    expect(result.current.canGoNext).toBe(true);
  });

  it("treats a slider question as always answerable via its default", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.answer("style", ["a"]));
    act(() => result.current.goNext());
    expect(result.current.currentQuestion.id).toBe("budget");
    expect(result.current.canGoNext).toBe(true);
  });

  it("sets isComplete true after advancing past the last question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.answer("style", ["a"]));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.isComplete).toBe(true);
    expect(result.current.answers).toMatchObject({ timing: "a", style: ["a"], budget: 150 });
  });

  it("goBack moves to the previous question and canGoBack reflects position", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    expect(result.current.canGoBack).toBe(false);
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    expect(result.current.canGoBack).toBe(true);
    act(() => result.current.goBack());
    expect(result.current.currentQuestion.id).toBe("timing");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/quiz/useQuizFlow.test.ts`
Expected: FAIL — module `./useQuizFlow` not found.

- [ ] **Step 3: Implement the hook**

```ts
// src/lib/quiz/useQuizFlow.ts
import { useMemo, useState } from "react";
import type { QuizAnswers, QuizQuestion } from "./types";

interface UseQuizFlowResult {
  currentIndex: number;
  currentQuestion: QuizQuestion;
  answers: QuizAnswers;
  isComplete: boolean;
  canGoNext: boolean;
  canGoBack: boolean;
  answer: (questionId: string, value: string | string[] | number) => void;
  goNext: () => void;
  goBack: () => void;
}

function sliderDefaults(questions: QuizQuestion[]): QuizAnswers {
  const answers: QuizAnswers = {};
  for (const q of questions) {
    if (q.type === "slider" && q.id === "budget") answers.budget = q.default;
  }
  return answers;
}

export function useQuizFlow(questions: QuizQuestion[]): UseQuizFlowResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(() => sliderDefaults(questions));

  const isComplete = currentIndex >= questions.length;
  const currentQuestion = questions[Math.min(currentIndex, questions.length - 1)];

  const canGoNext = useMemo(() => {
    if (isComplete) return false;
    const q = currentQuestion;
    if (q.optional) return true;
    if (q.type === "slider") return true;
    const value = (answers as Record<string, unknown>)[q.id];
    if (q.multi) return Array.isArray(value) && value.length > 0;
    return typeof value === "string" && value.length > 0;
  }, [answers, currentQuestion, isComplete]);

  function answer(questionId: string, value: string | string[] | number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function goNext() {
    setCurrentIndex((i) => Math.min(i + 1, questions.length));
  }

  function goBack() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  return {
    currentIndex,
    currentQuestion,
    answers,
    isComplete,
    canGoNext,
    canGoBack: currentIndex > 0,
    answer,
    goNext,
    goBack,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/quiz/useQuizFlow.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add quiz navigation hook with required/optional/multi validation"
```

---

## Task 10: Quiz UI components (ProgressBar, QuestionCard)

**Files:**
- Create: `src/components/quiz/ProgressBar.tsx`
- Create: `src/components/quiz/QuestionCard.tsx`
- Test: `src/components/quiz/QuestionCard.test.tsx`

**Interfaces:**
- Consumes: `QuizQuestion` (Task 8).
- Produces: `<ProgressBar current total />`, `<QuestionCard question value onAnswer />` consumed by Task 11's quiz page.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/quiz/QuestionCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QuestionCard } from "./QuestionCard";
import type { QuizQuestion } from "@/lib/quiz/types";

const rowsQuestion: QuizQuestion = {
  id: "timing", text: "Como você chega?", sub: "sub", type: "rows",
  options: [{ emoji: "✈️", label: "Avião", desc: "d", value: "aviao" }, { emoji: "🚌", label: "Ônibus", desc: "d", value: "onibus" }],
};

const multiQuestion: QuizQuestion = {
  id: "style", text: "Estilo", sub: "sub", type: "grid2", multi: true,
  options: [{ emoji: "🏄", label: "Praia", desc: "d", value: "praia" }, { emoji: "🍽️", label: "Gastro", desc: "d", value: "gastronomia" }],
};

const sliderQuestion: QuizQuestion = {
  id: "budget", text: "Orçamento", sub: "sub", type: "slider", min: 50, max: 600, default: 150, unit: "R$",
};

describe("QuestionCard", () => {
  it("renders rows options and calls onAnswer with the selected value", () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={rowsQuestion} value={undefined} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /avião/i }));
    expect(onAnswer).toHaveBeenCalledWith("aviao");
  });

  it("marks the selected single-choice option as pressed", () => {
    render(<QuestionCard question={rowsQuestion} value="onibus" onAnswer={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ônibus/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /avião/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a value on and off for a multi-select question", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<QuestionCard question={multiQuestion} value={[]} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /praia/i }));
    expect(onAnswer).toHaveBeenCalledWith(["praia"]);

    rerender(<QuestionCard question={multiQuestion} value={["praia"]} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /praia/i }));
    expect(onAnswer).toHaveBeenCalledWith([]);
  });

  it("calls onAnswer with a number when the slider changes", () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={sliderQuestion} value={150} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "300" } });
    expect(onAnswer).toHaveBeenCalledWith(300);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/quiz/QuestionCard.test.tsx`
Expected: FAIL — module `./QuestionCard` not found.

- [ ] **Step 3: Implement ProgressBar**

```tsx
// src/components/quiz/ProgressBar.tsx
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-turquoise to-blue transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement QuestionCard**

```tsx
// src/components/quiz/QuestionCard.tsx
"use client";

import type { QuizQuestion } from "@/lib/quiz/types";

interface QuestionCardProps {
  question: QuizQuestion;
  value: string | string[] | number | undefined;
  onAnswer: (value: string | string[] | number) => void;
}

export function QuestionCard({ question, value, onAnswer }: QuestionCardProps) {
  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">{question.text}</h2>
      <p className="mt-1 text-sm text-ink-dim">{question.sub}</p>

      {question.type === "slider" ? (
        <div className="mt-8">
          <div className="mb-3 font-display text-3xl font-extrabold text-turquoise">
            {question.unit} {value ?? question.default}
          </div>
          <input
            role="slider"
            type="range"
            min={question.min}
            max={question.max}
            value={typeof value === "number" ? value : question.default}
            onChange={(e) => onAnswer(Number(e.target.value))}
            className="w-full accent-turquoise"
          />
        </div>
      ) : (
        <div className={question.type === "grid2" ? "mt-6 grid grid-cols-2 gap-2" : "mt-6 flex flex-col gap-2"}>
          {question.options.map((opt) => {
            const isMulti = question.multi === true;
            const selected = isMulti
              ? Array.isArray(value) && value.includes(opt.value)
              : value === opt.value;

            function handleClick() {
              if (isMulti) {
                const current = Array.isArray(value) ? value : [];
                const next = current.includes(opt.value)
                  ? current.filter((v) => v !== opt.value)
                  : [...current, opt.value];
                onAnswer(next);
              } else {
                onAnswer(opt.value);
              }
            }

            return (
              <button
                key={opt.value}
                type="button"
                role="button"
                aria-pressed={selected}
                onClick={handleClick}
                className={`rounded-card border p-3 text-left transition-colors ${
                  selected ? "border-turquoise bg-turquoise/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="text-xl">{opt.emoji}</div>
                <div className="font-display text-sm font-bold">{opt.label}</div>
                <div className="text-xs text-ink-dim">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/components/quiz/QuestionCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add ProgressBar and QuestionCard quiz UI components"
```

---

## Task 11: Quiz page wiring

**Files:**
- Create: `src/lib/quiz/submit.ts`
- Create: `src/app/quiz/page.tsx`
- Test: `src/lib/quiz/submit.test.ts`
- Test: `src/app/quiz/page.test.tsx`

**Interfaces:**
- Consumes: `QUESTIONS` (Task 8), `useQuizFlow` (Task 9), `ProgressBar`/`QuestionCard` (Task 10).
- Produces: `submitQuizAnswers(answers)` — POSTs to `POST /api/itineraries`, built in Task 17. Until Task 17 exists, the page's happy path 404s when run manually; the tests below mock the network call, so they pass independently. Full manual end-to-end testing happens after Task 17.

- [ ] **Step 1: Write the failing test for `submitQuizAnswers`**

```ts
// src/lib/quiz/submit.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { submitQuizAnswers } from "./submit";

describe("submitQuizAnswers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the answers and returns the created slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ slug: "abc123" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitQuizAnswers({ timing: "aviao", budget: 150 });

    expect(result).toEqual({ slug: "abc123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/itineraries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ answers: { timing: "aviao", budget: 150 } }),
      }),
    );
  });

  it("throws a friendly error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(submitQuizAnswers({})).rejects.toThrow(/não foi possível/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/quiz/submit.test.ts`
Expected: FAIL — module `./submit` not found.

- [ ] **Step 3: Implement `submitQuizAnswers`**

```ts
// src/lib/quiz/submit.ts
import type { QuizAnswers } from "./types";

export async function submitQuizAnswers(answers: QuizAnswers): Promise<{ slug: string }> {
  const response = await fetch("/api/itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    throw new Error("Não foi possível gerar o roteiro. Tente novamente em instantes.");
  }
  return response.json();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/quiz/submit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for the quiz page**

```tsx
// src/app/quiz/page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/quiz/submit", () => ({ submitQuizAnswers: vi.fn().mockResolvedValue({ slug: "abc123" }) }));

import QuizPage from "./page";
import { submitQuizAnswers } from "@/lib/quiz/submit";

describe("QuizPage", () => {
  it("shows the first question, and Continuar is disabled until answered", () => {
    render(<QuizPage />);
    expect(screen.getByText(/como você chega em floripa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled();
  });

  it("advances to the next question after answering and clicking Continuar", () => {
    render(<QuizPage />);
    fireEvent.click(screen.getByRole("button", { name: /já estou em floripa/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText(/onde você vai se hospedar/i)).toBeInTheDocument();
  });

  it("submits the answers and navigates to the roteiro page after the last question", async () => {
    render(<QuizPage />);
    // timing
    fireEvent.click(screen.getByRole("button", { name: /já estou em floripa/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // region (optional) — skip
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // days
    fireEvent.click(screen.getByRole("button", { name: /1 dia/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // group
    fireEvent.click(screen.getByRole("button", { name: /solo/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // style (multi)
    fireEvent.click(screen.getByRole("button", { name: /praia, surf/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // transport
    fireEvent.click(screen.getByRole("button", { name: /a pé/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // budget (slider, has default) — just continue
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // special (optional) — final button label changes to "Ver meu roteiro"
    fireEvent.click(screen.getByRole("button", { name: /ver meu roteiro/i }));

    await waitFor(() => expect(submitQuizAnswers).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/roteiro/abc123"));
    expect(window.localStorage.getItem("floripa_last_itinerary_slug")).toBe("abc123");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/app/quiz/page.test.tsx`
Expected: FAIL — module `./page` not found.

- [ ] **Step 7: Implement the quiz page**

```tsx
// src/app/quiz/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/lib/quiz/questions";
import { useQuizFlow } from "@/lib/quiz/useQuizFlow";
import { submitQuizAnswers } from "@/lib/quiz/submit";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { QuizAnswers } from "@/lib/quiz/types";

export default function QuizPage() {
  const router = useRouter();
  const flow = useQuizFlow(QUESTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLastQuestion = flow.currentIndex === QUESTIONS.length - 1;

  async function handleContinue() {
    if (!flow.canGoNext || submitting) return;
    if (!isLastQuestion) {
      flow.goNext();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { slug } = await submitQuizAnswers(flow.answers);
      window.localStorage.setItem("floripa_last_itinerary_slug", slug);
      router.push(`/roteiro/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  const currentValue = (flow.answers as QuizAnswers & Record<string, unknown>)[flow.currentQuestion.id] as
    | string
    | string[]
    | number
    | undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <ProgressBar current={flow.currentIndex + 1} total={QUESTIONS.length} />
      <div className="mt-8 flex-1">
        <QuestionCard
          question={flow.currentQuestion}
          value={currentValue}
          onAnswer={(v) => flow.answer(flow.currentQuestion.id, v)}
        />
      </div>
      {error && <p className="mb-3 text-sm text-alert">{error}</p>}
      <div className="flex gap-3">
        {flow.canGoBack && (
          <button type="button" onClick={flow.goBack} className="rounded-pill px-4 py-3 text-sm text-ink-dim">
            Voltar
          </button>
        )}
        <button
          type="button"
          disabled={!flow.canGoNext || submitting}
          onClick={handleContinue}
          className="flex-1 rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 font-display font-extrabold text-graphite disabled:opacity-40"
        >
          {submitting ? "Montando seu roteiro..." : isLastQuestion ? "Ver meu roteiro →" : "Continuar →"}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/app/quiz/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Wire the quiz page with navigation, validation, and submission"
```

---

## Task 12: Candidate filtering logic

**Files:**
- Create: `src/lib/itinerary/filterCandidates.ts`
- Test: `src/lib/itinerary/filterCandidates.test.ts`

**Interfaces:**
- Consumes: `Place` (Task 4), `QuizAnswers` (Task 8).
- Produces: `filterCandidates(places, answers): Place[]`, consumed by Task 17.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/itinerary/filterCandidates.test.ts
import { describe, it, expect } from "vitest";
import { filterCandidates } from "./filterCandidates";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterCandidates", () => {
  it("keeps places whose target_profiles includes the traveler's group", () => {
    const places = [place({ id: "a", target_profiles: ["Casal"] }), place({ id: "b", target_profiles: ["Família"] })];
    const result = filterCandidates(places, { group: "casal" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("always keeps places marked for 'Todos' regardless of group", () => {
    const places = [place({ id: "a", target_profiles: ["Todos"] })];
    const result = filterCandidates(places, { group: "familia" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("excludes places above the allowed price range for a low budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: 60 });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("allows all price ranges for a high budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: 500 });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category compatible with the selected style(s)", () => {
    const places = [
      place({ id: "a", category: "Gastronomia" }),
      place({ id: "b", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("does not filter by category when no style was selected", () => {
    const places = [place({ id: "a", category: "Gastronomia" }), place({ id: "b", category: "Bar / Noturno" })];
    const result = filterCandidates(places, {});
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("combines profile, price, and style filters", () => {
    const places = [
      place({ id: "match", target_profiles: ["Casal"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-profile", target_profiles: ["Família"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-category", target_profiles: ["Casal"], price_range: "R$", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { group: "casal", budget: 150, style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/filterCandidates.test.ts`
Expected: FAIL — module `./filterCandidates` not found.

- [ ] **Step 3: Implement `filterCandidates`**

```ts
// src/lib/itinerary/filterCandidates.ts
import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

const GROUP_PROFILE_LABEL: Record<string, string> = {
  solo: "Solo",
  casal: "Casal",
  familia: "Família",
  amigos: "Amigos",
};

const STYLE_CATEGORIES: Record<string, string[]> = {
  praia: ["Praia", "Trilha", "Natureza", "Mirante", "Atividade"],
  gastronomia: ["Gastronomia", "Café / Padaria"],
  compras: ["Lazer / Compras"],
  cultura: ["Cultura", "Lazer"],
  noite: ["Bar / Noturno", "Beach Club"],
  negocios: ["Cultura", "Gastronomia"],
};

const PRICE_ORDER = ["Gratuito", "R$", "R$$", "R$$$"];

function allowedPriceRanges(budget: number | undefined): string[] {
  const value = budget ?? 150;
  if (value < 100) return ["Gratuito", "R$"];
  if (value < 250) return ["Gratuito", "R$", "R$$"];
  return PRICE_ORDER;
}

export function filterCandidates(places: Place[], answers: QuizAnswers): Place[] {
  const profileLabel = answers.group ? GROUP_PROFILE_LABEL[answers.group] : undefined;
  const allowedPrices = allowedPriceRanges(answers.budget);
  const styleCategories = new Set((answers.style ?? []).flatMap((s) => STYLE_CATEGORIES[s] ?? []));

  return places.filter((place) => {
    const profileOk =
      !profileLabel || place.target_profiles.includes("Todos") || place.target_profiles.includes(profileLabel);
    const priceOk = allowedPrices.includes(place.price_range);
    const styleOk = styleCategories.size === 0 || styleCategories.has(place.category);
    return profileOk && priceOk && styleOk;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/filterCandidates.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add profile/price/style candidate filtering for itinerary generation"
```

---

## Task 13: Partner-weighted ranking logic

**Files:**
- Create: `src/lib/itinerary/rankCandidates.ts`
- Test: `src/lib/itinerary/rankCandidates.test.ts`

**Interfaces:**
- Consumes: `Place` (Task 4).
- Produces: `weightedSample(candidates, options): Place[]`, consumed by Task 17.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/itinerary/rankCandidates.test.ts
import { describe, it, expect } from "vitest";
import { weightedSample } from "./rankCandidates";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mulberry32(seed: number) {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("weightedSample", () => {
  it("returns exactly `count` distinct candidates when enough are available", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => place({ id: `p${i}` }));
    const result = weightedSample(candidates, { count: 4, randomFn: mulberry32(1) });
    expect(result).toHaveLength(4);
    expect(new Set(result.map((p) => p.id)).size).toBe(4);
  });

  it("returns every candidate (no more) when count exceeds the pool size", () => {
    const candidates = [place({ id: "a" }), place({ id: "b" })];
    const result = weightedSample(candidates, { count: 5, randomFn: mulberry32(1) });
    expect(result).toHaveLength(2);
  });

  it("with randomFn always returning 0, always picks the current first item in the pool", () => {
    const candidates = [place({ id: "a" }), place({ id: "b" }), place({ id: "c" })];
    const result = weightedSample(candidates, { count: 3, randomFn: () => 0 });
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("selects partners noticeably more often than non-partners across many draws", () => {
    const random = mulberry32(42);
    let partnerPicks = 0;
    const TRIALS = 2000;
    for (let i = 0; i < TRIALS; i++) {
      const candidates = [
        place({ id: "partner", is_partner: true }),
        ...Array.from({ length: 9 }, (_, i2) => place({ id: `regular${i2}` })),
      ];
      const [picked] = weightedSample(candidates, { count: 1, partnerWeight: 7, randomFn: random });
      if (picked.id === "partner") partnerPicks += 1;
    }
    // Weight 7 vs 9x weight 1 => expected share ≈ 7/16 ≈ 43.75%, far above the 10% an unweighted draw would give.
    expect(partnerPicks).toBeGreaterThan(600);
    expect(partnerPicks).toBeLessThan(1100);
  });

  it("does not select every partner every time — non-partners still get picked across draws", () => {
    const random = mulberry32(7);
    const seenIds = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const candidates = [
        place({ id: "partner", is_partner: true }),
        place({ id: "regularA" }),
        place({ id: "regularB" }),
      ];
      const [picked] = weightedSample(candidates, { count: 1, partnerWeight: 3, randomFn: random });
      seenIds.add(picked.id);
    }
    expect(seenIds.has("regularA") || seenIds.has("regularB")).toBe(true);
  });

  it("boosts places matching the special-needs tag", () => {
    const candidates = [
      place({ id: "no-tag", special_needs_tags: [] }),
      place({ id: "has-tag", special_needs_tags: ["vegano"] }),
    ];
    const result = weightedSample(candidates, {
      count: 1,
      specialNeedsTag: "vegano",
      specialNeedsBoost: 100,
      randomFn: () => 0.99,
    });
    expect(result[0].id).toBe("has-tag");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/rankCandidates.test.ts`
Expected: FAIL — module `./rankCandidates` not found.

- [ ] **Step 3: Implement `weightedSample`**

```ts
// src/lib/itinerary/rankCandidates.ts
import type { Place } from "@/lib/supabase/types";

export interface RankOptions {
  count: number;
  partnerWeight?: number;
  specialNeedsTag?: string | null;
  specialNeedsBoost?: number;
  randomFn?: () => number;
}

export function weightedSample(candidates: Place[], options: RankOptions): Place[] {
  const {
    count,
    partnerWeight = 7,
    specialNeedsTag = null,
    specialNeedsBoost = 3,
    randomFn = Math.random,
  } = options;

  const pool = [...candidates];
  const selected: Place[] = [];

  while (pool.length > 0 && selected.length < count) {
    const weights = pool.map((p) => {
      let w = p.is_partner ? partnerWeight : 1;
      if (specialNeedsTag && p.special_needs_tags.includes(specialNeedsTag)) w *= specialNeedsBoost;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = randomFn() * total;
    let idx = 0;
    for (; idx < weights.length - 1; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return selected;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/rankCandidates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add partner-weighted random sampling for itinerary candidates"
```

---

## Task 14: Itinerary output schema + prompt builder

**Files:**
- Create: `src/lib/itinerary/schema.ts`
- Create: `src/lib/itinerary/prompt.ts`
- Test: `src/lib/itinerary/schema.test.ts`
- Test: `src/lib/itinerary/prompt.test.ts`

**Interfaces:**
- Consumes: `Place` (Task 4), `QuizAnswers` (Task 8).
- Produces: `ItineraryGenerationSchema`, `ItineraryGeneration` type, `SYSTEM_PROMPT`, `buildItineraryPrompt(candidates, answers)` — consumed by Task 15.

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Write the failing test for the schema**

```ts
// src/lib/itinerary/schema.test.ts
import { describe, it, expect } from "vitest";
import { ItineraryGenerationSchema } from "./schema";

describe("ItineraryGenerationSchema", () => {
  it("accepts a well-formed generation result", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi! Preparamos 2 dias incríveis pra você.",
      days: [{ day_number: 1, theme: "Sul & pôr do sol", activities: [{ place_id: "p1", time: "09:00" }] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a day with zero activities", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Vazio", activities: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive day_number", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi!",
      days: [{ day_number: 0, theme: "x", activities: [{ place_id: "p1", time: "09:00" }] }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/schema.test.ts`
Expected: FAIL — module `./schema` not found.

- [ ] **Step 4: Implement the schema**

```ts
// src/lib/itinerary/schema.ts
import { z } from "zod";

export const ItineraryActivitySchema = z.object({
  place_id: z.string(),
  time: z.string(),
});

export const ItineraryDaySchema = z.object({
  day_number: z.number().int().positive(),
  theme: z.string(),
  activities: z.array(ItineraryActivitySchema).min(1),
});

export const ItineraryGenerationSchema = z.object({
  welcome_message: z.string(),
  days: z.array(ItineraryDaySchema).min(1),
});

export type ItineraryGeneration = z.infer<typeof ItineraryGenerationSchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing test for the prompt builder**

```ts
// src/lib/itinerary/prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildItineraryPrompt, SYSTEM_PROMPT } from "./prompt";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "Praia extensa.", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SYSTEM_PROMPT", () => {
  it("forbids inventing places outside the candidate list", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("place_id");
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/nunca invente|não pode inventar|não invente/);
  });
});

describe("buildItineraryPrompt", () => {
  it("includes every candidate's place_id so Claude can only reference known places", () => {
    const candidates = [place({ id: "p1" }), place({ id: "p2", name: "Ostradamus" })];
    const prompt = buildItineraryPrompt(candidates, {});
    expect(prompt).toContain("place_id: p1");
    expect(prompt).toContain("place_id: p2");
    expect(prompt).toContain("Ostradamus");
  });

  it("translates the days answer into an explicit day count instruction", () => {
    const prompt = buildItineraryPrompt([place({})], { days: "3-4" });
    expect(prompt).toMatch(/exatamente 3 dia/);
  });

  it("defaults to 2 days when no days answer was given", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt).toMatch(/exatamente 2 dia/);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/prompt.test.ts`
Expected: FAIL — module `./prompt` not found.

- [ ] **Step 8: Implement the prompt builder**

```ts
// src/lib/itinerary/prompt.ts
import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

export const SYSTEM_PROMPT = [
  "Você é o roteirista do Floripa.me, especialista em Florianópolis.",
  "Monte um roteiro de viagem narrado e acolhedor a partir da lista de estabelecimentos fornecida.",
  'Regra inegociável: você só pode referenciar lugares pelo "place_id" exato presente na lista —',
  "nunca invente, renomeie ou sugira um estabelecimento fora dela.",
  "Se a lista não tiver opções suficientes para preencher um período do dia, reutilize a opção mais",
  "adequada disponível em vez de inventar uma nova.",
  "Escreva em português do Brasil, em tom caloroso e local, como um amigo dando dicas.",
].join(" ");

function dayCountFor(days: string | undefined): number {
  switch (days) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3-4":
      return 3;
    case "5+":
      return 5;
    default:
      return 2;
  }
}

export function buildItineraryPrompt(candidates: Place[], answers: QuizAnswers): string {
  const dayCount = dayCountFor(answers.days);
  const candidateLines = candidates
    .map(
      (c) =>
        `- place_id: ${c.id} | ${c.name} | categoria: ${c.category} | preço: ${c.price_range} | ${c.short_description}`,
    )
    .join("\n");

  return [
    "Perfil do viajante:",
    `- Companhia: ${answers.group ?? "não informado"}`,
    `- Dias na cidade: ${answers.days ?? "não informado"} (monte exatamente ${dayCount} dia(s))`,
    `- Estilo de viagem: ${(answers.style ?? []).join(", ") || "não informado"}`,
    `- Orçamento diário: R$${answers.budget ?? 150}`,
    `- Transporte: ${answers.transport ?? "não informado"}`,
    `- Necessidade especial: ${answers.special ?? "nenhuma"}`,
    "",
    "Lugares disponíveis (use SOMENTE estes, referenciando pelo place_id):",
    candidateLines,
    "",
    `Monte ${dayCount} dia(s) de roteiro, cada um com 3 a 5 atividades em horários realistas`,
    "(manhã/tarde/noite), e escreva uma mensagem de boas-vindas curta e personalizada ao perfil.",
  ].join("\n");
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/prompt.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add itinerary output schema and prompt builder"
```

---

## Task 15: Claude itinerary generation call

**Files:**
- Create: `src/lib/itinerary/generate.ts`
- Test: `src/lib/itinerary/generate.test.ts`

**Interfaces:**
- Consumes: `ItineraryGenerationSchema`, `SYSTEM_PROMPT`, `buildItineraryPrompt` (Task 14).
- Produces: `generateItinerary(candidates, answers, client?, maxAttempts?): Promise<ItineraryGeneration>`, consumed by Task 17.

- [ ] **Step 1: Install the Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/itinerary/generate.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateItinerary, type MessagesParseClient } from "./generate";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const VALID_RESULT = {
  welcome_message: "Oi! Preparamos um roteiro pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "1", time: "09:00" }] }],
};

function fakeClient(parse: MessagesParseClient["messages"]["parse"]): MessagesParseClient {
  return { messages: { parse } };
}

describe("generateItinerary", () => {
  it("returns parsed_output on a successful first call", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: VALID_RESULT });
    const result = await generateItinerary([place({})], {}, fakeClient(parse));
    expect(result).toEqual(VALID_RESULT);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("retries on a retryable (429/5xx) error and succeeds on a later attempt", async () => {
    const rateLimitError = Object.assign(new Error("rate limited"), { status: 429 });
    const parse = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ parsed_output: VALID_RESULT });

    const result = await generateItinerary([place({})], {}, fakeClient(parse), 3);

    expect(result).toEqual(VALID_RESULT);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable error (e.g. 400) and rejects immediately", async () => {
    const badRequest = Object.assign(new Error("bad request"), { status: 400 });
    const parse = vi.fn().mockRejectedValue(badRequest);

    await expect(generateItinerary([place({})], {}, fakeClient(parse), 3)).rejects.toThrow("bad request");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts retryable failures", async () => {
    const serverError = Object.assign(new Error("server error"), { status: 500 });
    const parse = vi.fn().mockRejectedValue(serverError);

    await expect(generateItinerary([place({})], {}, fakeClient(parse), 2)).rejects.toThrow("server error");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("throws when the response has no parsed_output", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null });
    await expect(generateItinerary([place({})], {}, fakeClient(parse), 1)).rejects.toThrow(/parsed_output/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/generate.test.ts`
Expected: FAIL — module `./generate` not found.

- [ ] **Step 4: Implement `generateItinerary`**

```ts
// src/lib/itinerary/generate.ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ItineraryGenerationSchema, type ItineraryGeneration } from "./schema";
import { SYSTEM_PROMPT, buildItineraryPrompt } from "./prompt";
import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

export interface MessagesParseClient {
  messages: {
    parse: (params: unknown) => Promise<{ parsed_output: ItineraryGeneration | null }>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && (status === 429 || status >= 500);
}

export async function generateItinerary(
  candidates: Place[],
  answers: QuizAnswers,
  client: MessagesParseClient = new Anthropic() as unknown as MessagesParseClient,
  maxAttempts = 3,
): Promise<ItineraryGeneration> {
  const prompt = buildItineraryPrompt(candidates, answers);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(ItineraryGenerationSchema) },
      });
      if (!response.parsed_output) throw new Error("Claude did not return parsed_output");
      return response.parsed_output;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxAttempts - 1) throw error;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastError;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/generate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Claude-backed itinerary generation with retry on 429/5xx"
```

---

## Task 16: Assemble itinerary days + slug generation

**Files:**
- Create: `src/lib/itinerary/assemble.ts`
- Create: `src/lib/itinerary/slug.ts`
- Test: `src/lib/itinerary/assemble.test.ts`
- Test: `src/lib/itinerary/slug.test.ts`

**Interfaces:**
- Consumes: `ItineraryGeneration` (Task 14), `Place` (Task 4).
- Produces: `ItineraryActivity`, `ItineraryDay` types + `assembleDays(generation, candidates)`, and `generateSlug()` — both consumed by Task 17.

- [ ] **Step 1: Write the failing test for `assembleDays`**

```ts
// src/lib/itinerary/assemble.test.ts
import { describe, it, expect } from "vitest";
import { assembleDays } from "./assemble";
import type { Place } from "@/lib/supabase/types";
import type { ItineraryGeneration } from "./schema";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "Endereço X",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("assembleDays", () => {
  it("fills in full place data for each referenced place_id", () => {
    const candidates = [place({ id: "p1", name: "Praia do Campeche", is_partner: true })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const result = assembleDays(generation, candidates);
    expect(result).toEqual([
      {
        day_number: 1,
        theme: "Dia 1",
        activities: [
          {
            place_id: "p1", name: "Praia do Campeche", time: "09:00", category: "Praia",
            price_range: "Gratuito", is_partner: true, address: "Endereço X", lat: -27.6, lng: -48.5,
          },
        ],
      },
    ]);
  });

  it("drops an activity whose place_id is not among the candidates (defensive, not expected in normal use)", () => {
    const candidates = [place({ id: "p1" })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }, { place_id: "unknown", time: "12:00" }] }],
    };
    const result = assembleDays(generation, candidates);
    expect(result[0].activities).toHaveLength(1);
    expect(result[0].activities[0].place_id).toBe("p1");
  });

  it("drops a day entirely if every one of its activities referenced an unknown place_id", () => {
    const candidates = [place({ id: "p1" })];
    const generation: ItineraryGeneration = {
      welcome_message: "Oi!",
      days: [
        { day_number: 1, theme: "Só inválido", activities: [{ place_id: "unknown", time: "09:00" }] },
        { day_number: 2, theme: "Válido", activities: [{ place_id: "p1", time: "09:00" }] },
      ],
    };
    const result = assembleDays(generation, candidates);
    expect(result).toHaveLength(1);
    expect(result[0].day_number).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/assemble.test.ts`
Expected: FAIL — module `./assemble` not found.

- [ ] **Step 3: Implement `assembleDays`**

```ts
// src/lib/itinerary/assemble.ts
import type { Place } from "@/lib/supabase/types";
import type { ItineraryGeneration } from "./schema";

export interface ItineraryActivity {
  place_id: string;
  name: string;
  time: string;
  category: string;
  price_range: string;
  is_partner: boolean;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface ItineraryDay {
  day_number: number;
  theme: string;
  activities: ItineraryActivity[];
}

export function assembleDays(generation: ItineraryGeneration, candidates: Place[]): ItineraryDay[] {
  const byId = new Map(candidates.map((p) => [p.id, p]));

  return generation.days
    .map((day) => ({
      day_number: day.day_number,
      theme: day.theme,
      activities: day.activities
        .map((act): ItineraryActivity | null => {
          const place = byId.get(act.place_id);
          if (!place) return null;
          return {
            place_id: place.id,
            name: place.name,
            time: act.time,
            category: place.category,
            price_range: place.price_range,
            is_partner: place.is_partner,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
          };
        })
        .filter((a): a is ItineraryActivity => a !== null),
    }))
    .filter((day) => day.activities.length > 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/assemble.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for `generateSlug`**

```ts
// src/lib/itinerary/slug.test.ts
import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("generates an 8-character lowercase alphanumeric slug", () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z0-9]{8}$/);
  });

  it("is deterministic given a fixed randomFn", () => {
    expect(generateSlug(() => 0)).toBe("aaaaaaaa");
  });

  it("produces different slugs across calls with the default random source", () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateSlug()));
    expect(slugs.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/slug.test.ts`
Expected: FAIL — module `./slug` not found.

- [ ] **Step 7: Implement `generateSlug`**

```ts
// src/lib/itinerary/slug.ts
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(randomFn: () => number = Math.random): string {
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += ALPHABET[Math.floor(randomFn() * ALPHABET.length)];
  }
  return slug;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/slug.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add itinerary assembly (place_id -> full data) and slug generation"
```

---

## Task 17: `POST /api/itineraries` — orchestration + route

**Files:**
- Create: `src/lib/itinerary/createItinerary.ts`
- Create: `src/app/api/itineraries/route.ts`
- Test: `src/lib/itinerary/createItinerary.test.ts`
- Test: `src/app/api/itineraries/route.test.ts`

**Interfaces:**
- Consumes: `listPlaces`/`insertItinerary` (Task 4), `filterCandidates` (Task 12), `weightedSample` (Task 13), `generateItinerary` (Task 15), `assembleDays`/`generateSlug` (Task 16).
- Produces: `createItinerary(answers, deps): Promise<ItineraryRow>`, `NoCandidatesError`, and the `POST` route handler — the route is what Task 11's `submitQuizAnswers` calls, and what Task 19 reads back from.

The orchestration logic lives in a plain function (`createItinerary`) that takes its Supabase/Anthropic clients as explicit dependencies, so it's fully unit-testable; `route.ts` is a thin wrapper that supplies the real clients and translates errors to HTTP statuses.

- [ ] **Step 1: Write the failing test for `createItinerary`**

```ts
// src/lib/itinerary/createItinerary.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createItinerary, NoCandidatesError } from "./createItinerary";
import type { MessagesParseClient } from "./generate";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "d", address: "end",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(placesResult: { data: unknown; error: unknown }, insertedRow: unknown): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.then = (resolve: (r: typeof placesResult) => void) => resolve(placesResult);
      return chain;
    }
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.insert = () => chain;
      chain.select = () => chain;
      chain.single = () => Promise.resolve({ data: insertedRow, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

const VALID_GENERATION = {
  welcome_message: "Oi!",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", time: "09:00" }] }],
};

function fakeAnthropic(): MessagesParseClient {
  return { messages: { parse: vi.fn().mockResolvedValue({ parsed_output: VALID_GENERATION }) } };
}

describe("createItinerary", () => {
  it("filters, ranks, generates, assembles, and persists an itinerary", async () => {
    const places = [place()];
    const insertedRow = { id: "1", slug: "abc12345", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z" };
    const supabase = fakeSupabase({ data: places, error: null }, insertedRow);

    const result = await createItinerary({ group: "solo" }, { supabase, anthropicClient: fakeAnthropic() });

    expect(result).toEqual(insertedRow);
  });

  it("throws NoCandidatesError when no places match the quiz answers", async () => {
    const supabase = fakeSupabase({ data: [], error: null }, {});
    await expect(
      createItinerary({ group: "solo" }, { supabase, anthropicClient: fakeAnthropic() }),
    ).rejects.toBeInstanceOf(NoCandidatesError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/createItinerary.test.ts`
Expected: FAIL — module `./createItinerary` not found.

- [ ] **Step 3: Implement `createItinerary`**

```ts
// src/lib/itinerary/createItinerary.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPlaces, insertItinerary } from "@/lib/supabase/queries";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import { generateItinerary, type MessagesParseClient } from "./generate";
import { assembleDays } from "./assemble";
import { generateSlug } from "./slug";

const SPECIAL_NEEDS_TAG: Record<string, string> = {
  acessibilidade: "acessibilidade",
  vegano: "vegano",
  bebe: "bebe",
  pet: "pet",
};

export class NoCandidatesError extends Error {}

export interface CreateItineraryDeps {
  supabase: SupabaseClient;
  anthropicClient?: MessagesParseClient;
}

export async function createItinerary(answers: QuizAnswers, deps: CreateItineraryDeps): Promise<ItineraryRow> {
  const allPlaces = await listPlaces(deps.supabase);
  const filtered = filterCandidates(allPlaces, answers);
  if (filtered.length === 0) {
    throw new NoCandidatesError("Não encontramos lugares suficientes para esse perfil ainda.");
  }

  const specialNeedsTag = answers.special ? (SPECIAL_NEEDS_TAG[answers.special] ?? null) : null;
  const candidates = weightedSample(filtered, { count: Math.min(25, filtered.length), specialNeedsTag });
  if (candidates.length < 8) {
    console.warn(`Low candidate pool (${candidates.length}) for answers`, answers);
  }

  const generation = deps.anthropicClient
    ? await generateItinerary(candidates, answers, deps.anthropicClient)
    : await generateItinerary(candidates, answers);

  const days = assembleDays(generation, candidates);
  const slug = generateSlug();

  return insertItinerary(deps.supabase, {
    slug,
    quiz_answers: answers as Record<string, unknown>,
    welcome_message: generation.welcome_message,
    days,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/createItinerary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for the route handler**

```ts
// src/app/api/itineraries/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/itinerary/createItinerary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/createItinerary")>(
    "@/lib/itinerary/createItinerary",
  );
  return { ...actual, createItinerary: vi.fn() };
});

import { POST } from "./route";
import { createItinerary, NoCandidatesError } from "@/lib/itinerary/createItinerary";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/itineraries", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/itineraries", () => {
  it("returns 400 when answers is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 201 with the slug on success", async () => {
    vi.mocked(createItinerary).mockResolvedValue({
      id: "1", slug: "abc12345", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ slug: "abc12345" });
  });

  it("returns 422 when there are no matching candidates", async () => {
    vi.mocked(createItinerary).mockRejectedValue(new NoCandidatesError("sem lugares"));
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(422);
  });

  it("returns 502 on an unexpected generation failure", async () => {
    vi.mocked(createItinerary).mockRejectedValue(new Error("boom"));
    const response = await POST(jsonRequest({ answers: { group: "solo" } }));
    expect(response.status).toBe(502);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/app/api/itineraries/route.test.ts`
Expected: FAIL — module `./route` not found.

- [ ] **Step 7: Implement the route handler**

```ts
// src/app/api/itineraries/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { createItinerary, NoCandidatesError } from "@/lib/itinerary/createItinerary";
import type { QuizAnswers } from "@/lib/quiz/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const answers = body?.answers as QuizAnswers | undefined;
  if (!answers) {
    return NextResponse.json({ error: "answers é obrigatório" }, { status: 400 });
  }

  try {
    const row = await createItinerary(answers, { supabase: getSupabaseAdminClient() });
    return NextResponse.json({ slug: row.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof NoCandidatesError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Itinerary generation failed", error);
    return NextResponse.json({ error: "Não foi possível gerar o roteiro agora. Tente novamente." }, { status: 502 });
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/app/api/itineraries/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Set real env vars and smoke-test the full quiz → roteiro flow manually**

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` in `.env.local`, run `npm run dev`, go through `/quiz` in the browser, and confirm it redirects to `/roteiro/<slug>` (the page itself is built in Task 19, so a 404 there is expected — confirm the redirect happens and that a row appears in the `itineraries` table in Supabase Studio with a sensible `welcome_message` and `days`).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add itinerary creation orchestration and POST /api/itineraries route"
```

---

## Task 18: Shared UI — GlowBackground, Button, Chip, BottomNav

**Files:**
- Create: `src/components/ui/GlowBackground.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Chip.tsx`
- Create: `src/components/nav/BottomNav.tsx`
- Test: `src/components/ui/Button.test.tsx`
- Test: `src/components/ui/Chip.test.tsx`
- Test: `src/components/nav/BottomNav.test.tsx`

**Interfaces:**
- Produces: `<GlowBackground variant="turquoise" | "coral" />`, `<Button variant="primary" | "ghost">`, `<Chip selected onClick>`, `<BottomNav slug />` — consumed by Tasks 19–23.

- [ ] **Step 1: Implement `GlowBackground` (no test — purely decorative, no branching logic)**

```tsx
// src/components/ui/GlowBackground.tsx
export function GlowBackground({ variant = "turquoise" }: { variant?: "turquoise" | "coral" }) {
  const color = variant === "coral" ? "#FF7A59" : "#00E6C8";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test for `Button`**

```tsx
// src/components/ui/Button.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the primary variant with the gradient class by default", () => {
    render(<Button>Continuar</Button>);
    expect(screen.getByRole("button", { name: "Continuar" }).className).toContain("from-turquoise");
  });

  it("renders the ghost variant without the gradient class", () => {
    render(<Button variant="ghost">Voltar</Button>);
    expect(screen.getByRole("button", { name: "Voltar" }).className).not.toContain("from-turquoise");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/components/ui/Button.test.tsx`
Expected: FAIL — module `./Button` not found.

- [ ] **Step 4: Implement `Button`**

```tsx
// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "rounded-pill px-6 py-3 font-display font-extrabold disabled:opacity-40";
  const variantClass =
    variant === "primary"
      ? "bg-gradient-to-r from-turquoise to-blue text-graphite"
      : "bg-transparent text-ink-dim";
  return <button type="button" className={`${base} ${variantClass} ${className}`} {...props} />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/components/ui/Button.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing test for `Chip`**

```tsx
// src/components/ui/Chip.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("calls onClick when clicked and reflects selection via aria-pressed", () => {
    const onClick = vi.fn();
    render(<Chip selected onClick={onClick}>Eventos</Chip>);
    const chip = screen.getByRole("button", { name: "Eventos" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it("reflects an unselected state", () => {
    render(<Chip selected={false} onClick={() => {}}>Programas</Chip>);
    expect(screen.getByRole("button", { name: "Programas" })).toHaveAttribute("aria-pressed", "false");
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/components/ui/Chip.test.tsx`
Expected: FAIL — module `./Chip` not found.

- [ ] **Step 8: Implement `Chip`**

```tsx
// src/components/ui/Chip.tsx
import type { ReactNode } from "react";

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-xs font-bold transition-colors ${
        selected ? "bg-turquoise text-graphite" : "bg-white/10 text-ink-dim"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/components/ui/Chip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 10: Write the failing test for `BottomNav`**

```tsx
// src/components/nav/BottomNav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("renders all 5 tabs pointing at the given slug", () => {
    render(<BottomNav slug="abc123" />);
    expect(screen.getByRole("link", { name: /roteiro/i })).toHaveAttribute("href", "/roteiro/abc123");
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("href", "/roteiro/abc123/mapa");
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
    expect(screen.getByRole("link", { name: /dicas/i })).toHaveAttribute("href", "/roteiro/abc123/dicas");
    expect(screen.getByRole("link", { name: /mais/i })).toHaveAttribute("href", "/roteiro/abc123/mais");
  });

  it("marks the tab matching the current pathname as active", () => {
    render(<BottomNav slug="abc123" />);
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /roteiro/i })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npm run test -- src/components/nav/BottomNav.test.tsx`
Expected: FAIL — module `./BottomNav` not found.

- [ ] **Step 12: Implement `BottomNav`**

```tsx
// src/components/nav/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: (slug: string) => string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "roteiro", label: "Roteiro", icon: "🗺️", path: (slug) => `/roteiro/${slug}` },
  { key: "mapa", label: "Mapa", icon: "📍", path: (slug) => `/roteiro/${slug}/mapa` },
  { key: "sos", label: "SOS", icon: "🆘", path: (slug) => `/roteiro/${slug}/sos` },
  { key: "dicas", label: "Dicas", icon: "💡", path: (slug) => `/roteiro/${slug}/dicas` },
  { key: "mais", label: "Mais", icon: "···", path: (slug) => `/roteiro/${slug}/mais` },
];

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t border-white/10 bg-white/5 py-2 backdrop-blur-lg">
      {NAV_ITEMS.map((item) => {
        const href = item.path(slug);
        const active = pathname === href;
        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-bold ${
              active ? (item.key === "sos" ? "text-coral" : "text-turquoise") : "text-ink-dim"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm run test -- src/components/nav/BottomNav.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Add shared UI components: GlowBackground, Button, Chip, BottomNav"
```

---

## Task 19: Roteiro home page

**Files:**
- Create: `src/app/api/itineraries/[slug]/route.ts`
- Create: `src/components/roteiro/DayCard.tsx`
- Create: `src/components/roteiro/RoteiroView.tsx`
- Create: `src/app/roteiro/[slug]/page.tsx`
- Test: `src/app/api/itineraries/[slug]/route.test.ts`
- Test: `src/components/roteiro/DayCard.test.tsx`
- Test: `src/components/roteiro/RoteiroView.test.tsx`

**Interfaces:**
- Consumes: `getItineraryBySlug` (Task 4), `ItineraryDay`/`ItineraryActivity` (Task 16), `GlowBackground`/`BottomNav` (Task 18).
- Produces: `GET /api/itineraries/[slug]`, `<RoteiroView itinerary />` — the GET route is reused by Task 24's edit UI to refetch after a PATCH.

`page.tsx` is an async Server Component (fetches directly, no client waterfall); it delegates all rendering to `RoteiroView`, which takes plain props and is fully unit-testable. Server Components that just fetch-and-delegate aren't unit tested here — verify them manually in Step 10.

- [ ] **Step 1: Write the failing test for the GET route**

```ts
// src/app/api/itineraries/[slug]/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getItineraryBySlug: vi.fn() }));

import { GET } from "./route";
import { getItineraryBySlug } from "@/lib/supabase/queries";

describe("GET /api/itineraries/[slug]", () => {
  it("returns the itinerary as JSON when found", async () => {
    const row = { id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z" };
    vi.mocked(getItineraryBySlug).mockResolvedValue(row);
    const response = await GET(new Request("http://localhost/api/itineraries/abc123"), { params: { slug: "abc123" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(row);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getItineraryBySlug).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/itineraries/missing"), { params: { slug: "missing" } });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/app/api/itineraries/[slug]/route.test.ts`
Expected: FAIL — module `./route` not found.

- [ ] **Step 3: Implement the GET route**

```ts
// src/app/api/itineraries/[slug]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const client = getSupabaseAdminClient();
  const row = await getItineraryBySlug(client, params.slug);
  if (!row) {
    return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
  }
  return NextResponse.json(row);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/app/api/itineraries/[slug]/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `DayCard`**

```tsx
// src/components/roteiro/DayCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DayCard } from "./DayCard";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

const day: ItineraryDay = {
  day_number: 1,
  theme: "Sul & pôr do sol",
  activities: [
    { place_id: "p1", name: "Praia do Campeche", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null },
    { place_id: "p2", name: "Ostradamus", time: "13:00", category: "Gastronomia", price_range: "R$$$", is_partner: true, address: "", lat: null, lng: null },
  ],
};

describe("DayCard", () => {
  it("renders the day number, theme, and each activity's time and name", () => {
    render(<DayCard day={day} />);
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(screen.getByText(/sul & pôr do sol/i)).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("Praia do Campeche")).toBeInTheDocument();
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
  });

  it("shows the partner badge only for partner activities", () => {
    render(<DayCard day={day} />);
    expect(screen.getAllByText(/parceiro/i)).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/DayCard.test.tsx`
Expected: FAIL — module `./DayCard` not found.

- [ ] **Step 7: Implement `DayCard` and `RoteiroView`**

```tsx
// src/components/roteiro/DayCard.tsx
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function DayCard({ day }: { day: ItineraryDay }) {
  return (
    <section className="rounded-card border border-white/10 bg-white/5 p-4">
      <h2 className="font-display text-xs font-extrabold uppercase tracking-wide text-turquoise">
        Dia {day.day_number} — {day.theme}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {day.activities.map((act) => (
          <li key={`${act.place_id}-${act.time}`} className="flex items-center gap-3">
            <div className="w-12 shrink-0 text-xs text-ink-dim">{act.time}</div>
            <div className="flex-1">
              <div className="font-display text-sm font-bold">
                {act.name}
                {act.is_partner && <span className="ml-2 text-coral">⭐ Parceiro</span>}
              </div>
              <div className="text-xs text-ink-dim">
                {act.price_range} · {act.category}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// src/components/roteiro/RoteiroView.tsx
"use client";

import { GlowBackground } from "@/components/ui/GlowBackground";
import { BottomNav } from "@/components/nav/BottomNav";
import { DayCard } from "./DayCard";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function RoteiroView({ itinerary }: { itinerary: ItineraryRow }) {
  const days = itinerary.days as ItineraryDay[];
  return (
    <main className="relative min-h-screen pb-24">
      <GlowBackground />
      <div className="relative px-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-wide text-turquoise">Seu roteiro</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">{itinerary.welcome_message}</h1>
      </div>
      <div className="relative mt-6 flex flex-col gap-4 px-4">
        {days.map((day) => (
          <DayCard key={day.day_number} day={day} />
        ))}
      </div>
      <BottomNav slug={itinerary.slug} />
    </main>
  );
}
```

- [ ] **Step 8: Write the failing test for `RoteiroView`, then run it and implement above until it passes**

```tsx
// src/components/roteiro/RoteiroView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123" }));

import { RoteiroView } from "./RoteiroView";
import type { ItineraryRow } from "@/lib/supabase/types";

const itinerary: ItineraryRow = {
  id: "1", slug: "abc123", quiz_answers: {},
  welcome_message: "Oi! Preparamos 2 dias incríveis pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", name: "Praia", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null }] }],
  created_at: "2026-01-01T00:00:00Z",
};

describe("RoteiroView", () => {
  it("renders the welcome message and a DayCard per day, plus the bottom nav", () => {
    render(<RoteiroView itinerary={itinerary} />);
    expect(screen.getByText(/preparamos 2 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("href", "/roteiro/abc123/mapa");
  });
});
```

Run: `npm run test -- src/components/roteiro/RoteiroView.test.tsx`
Expected: FAIL first (module not found), then PASS (1 test) once `RoteiroView.tsx` from Step 7 exists.

- [ ] **Step 9: Implement the page**

```tsx
// src/app/roteiro/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { RoteiroView } from "@/components/roteiro/RoteiroView";

export default async function RoteiroPage({ params }: { params: { slug: string } }) {
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, params.slug);
  if (!itinerary) notFound();
  return <RoteiroView itinerary={itinerary} />;
}
```

- [ ] **Step 10: Manually verify against the real database**

Run: `npm run dev`, visit `/roteiro/<a real slug from Task 17's smoke test>`. Expected: welcome message and day cards render, bottom nav is visible and highlights "Roteiro".

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Add Roteiro home page with GET /api/itineraries/[slug]"
```

---

## Task 20: Mapa page

**Files:**
- Create: `src/lib/itinerary/nearbyPlaces.ts`
- Create: `src/app/api/places/nearby/route.ts`
- Create: `src/components/roteiro/MapaView.tsx`
- Create: `src/app/roteiro/[slug]/mapa/page.tsx`
- Test: `src/lib/itinerary/nearbyPlaces.test.ts`
- Test: `src/components/roteiro/MapaView.test.tsx`

**Interfaces:**
- Consumes: `filterCandidates` (Task 12), `weightedSample` (Task 13), `getItineraryBySlug`/`listPlaces` (Task 4), `BottomNav` (Task 18), `ItineraryDay` (Task 16).
- Produces: `getNearbyPlaces(slug, supabase, count?)`, `GET /api/places/nearby?slug=`, `<MapaView slug days nearby />`.

- [ ] **Step 1: Install the Maps loader**

```bash
npm install @googlemaps/js-api-loader
npm install --save-dev @types/google.maps
```

- [ ] **Step 2: Write the failing test for `getNearbyPlaces`**

```ts
// src/lib/itinerary/nearbyPlaces.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNearbyPlaces } from "./nearbyPlaces";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Lugar",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: -27.6, lng: -48.5, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(itinerary: unknown, places: unknown[]): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      return chain;
    }
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.then = (resolve: (r: { data: unknown; error: null }) => void) => resolve({ data: places, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

describe("getNearbyPlaces", () => {
  it("returns an empty array when the itinerary doesn't exist", async () => {
    const supabase = fakeSupabase(null, []);
    expect(await getNearbyPlaces("missing", supabase)).toEqual([]);
  });

  it("excludes places already used in the itinerary's days", async () => {
    const itinerary = {
      slug: "abc123",
      quiz_answers: {},
      days: [{ day_number: 1, theme: "d", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const places = [place({ id: "p1" }), place({ id: "p2", name: "Outro" })];
    const supabase = fakeSupabase(itinerary, places);

    const result = await getNearbyPlaces("abc123", supabase, 5);

    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/nearbyPlaces.test.ts`
Expected: FAIL — module `./nearbyPlaces` not found.

- [ ] **Step 4: Implement `getNearbyPlaces`**

```ts
// src/lib/itinerary/nearbyPlaces.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, listPlaces } from "@/lib/supabase/queries";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import type { Place } from "@/lib/supabase/types";
import type { ItineraryDay } from "./assemble";
import type { QuizAnswers } from "@/lib/quiz/types";

export async function getNearbyPlaces(slug: string, supabase: SupabaseClient, count = 10): Promise<Place[]> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) return [];

  const usedIds = new Set((itinerary.days as ItineraryDay[]).flatMap((d) => d.activities.map((a) => a.place_id)));
  const allPlaces = await listPlaces(supabase);
  const filtered = filterCandidates(allPlaces, itinerary.quiz_answers as QuizAnswers).filter(
    (p) => !usedIds.has(p.id),
  );

  return weightedSample(filtered, { count });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/nearbyPlaces.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Implement the route (no additional test — thin wrapper, same pattern proven in Task 17/19)**

```ts
// src/app/api/places/nearby/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getNearbyPlaces } from "@/lib/itinerary/nearbyPlaces";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });
  }
  const places = await getNearbyPlaces(slug, getSupabaseAdminClient());
  return NextResponse.json(places);
}
```

- [ ] **Step 7: Write the failing test for `MapaView`**

```tsx
// src/components/roteiro/MapaView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));

import { MapaView } from "./MapaView";

describe("MapaView", () => {
  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("shows a setup message and still renders the bottom nav when no Maps API key is configured", () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    expect(screen.getByText(/configure.*google_maps_api_key/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/MapaView.test.tsx`
Expected: FAIL — module `./MapaView` not found.

- [ ] **Step 9: Implement `MapaView`**

```tsx
// src/components/roteiro/MapaView.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { BottomNav } from "@/components/nav/BottomNav";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { Place } from "@/lib/supabase/types";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: Place[];
}

const DEFAULT_CENTER = { lat: -27.5954, lng: -48.548 };

export function MapaView({ slug, days, nearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setStatusMessage("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver o mapa.");
      return;
    }
    if (!mapRef.current) return;

    const loader = new Loader({ apiKey, version: "weekly" });
    loader
      .load()
      .then((google) => {
        const activities = days.flatMap((d) => d.activities).filter((a) => a.lat !== null && a.lng !== null);
        const center = activities[0] ? { lat: activities[0].lat as number, lng: activities[0].lng as number } : DEFAULT_CENTER;
        const map = new google.maps.Map(mapRef.current as HTMLDivElement, { center, zoom: 12 });

        for (const act of activities) {
          new google.maps.Marker({
            position: { lat: act.lat as number, lng: act.lng as number },
            map,
            title: act.name,
            label: act.is_partner ? "⭐" : undefined,
          });
        }
        for (const place of nearby) {
          if (place.lat === null || place.lng === null) continue;
          new google.maps.Marker({ position: { lat: place.lat, lng: place.lng }, map, title: place.name, opacity: 0.7 });
        }
      })
      .catch(() => setStatusMessage("Não foi possível carregar o mapa agora."));
  }, [days, nearby]);

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />
      {statusMessage && <p className="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-ink-dim">{statusMessage}</p>}
      <BottomNav slug={slug} />
    </main>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/MapaView.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 11: Implement the page**

```tsx
// src/app/roteiro/[slug]/mapa/page.tsx
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { getNearbyPlaces } from "@/lib/itinerary/nearbyPlaces";
import { MapaView } from "@/components/roteiro/MapaView";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export default async function MapaPage({ params }: { params: { slug: string } }) {
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, params.slug);
  if (!itinerary) notFound();
  const nearby = await getNearbyPlaces(params.slug, client);
  return <MapaView slug={params.slug} days={itinerary.days as ItineraryDay[]} nearby={nearby} />;
}
```

- [ ] **Step 12: Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and manually verify**

Enable the Maps JavaScript API on the same Google Cloud project as Places, add the key to `.env.local`, run `npm run dev`, visit `/roteiro/<slug>/mapa`. Expected: a dark-themed map centered on Florianópolis with a marker per itinerary activity (partner ones show a ⭐ label) and fainter markers for the "outros pontos" suggestions.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Add Mapa page with itinerary pins and nearby-place suggestions"
```

---

## Task 21: Dicas page (events)

**Files:**
- Create: `src/lib/events/filterEvents.ts`
- Create: `src/components/roteiro/DicasView.tsx`
- Create: `src/app/roteiro/[slug]/dicas/page.tsx`
- Test: `src/lib/events/filterEvents.test.ts`
- Test: `src/components/roteiro/DicasView.test.tsx`

**Interfaces:**
- Consumes: `EventRow` (Task 4), `QuizAnswers` (Task 8), `BottomNav` (Task 18).
- Produces: `isEventActiveInMonth`, `filterEventsForTraveler(events, answers, month)`, `<DicasView slug events />`.

The quiz doesn't collect a travel date, only duration — the previous project's copy ("responda 8 perguntas e receba já") treats the trip as starting now, so Dicas uses the current calendar month to decide which recurring annual events are in season.

- [ ] **Step 1: Write the failing test for the event filters**

```ts
// src/lib/events/filterEvents.test.ts
import { describe, it, expect } from "vitest";
import { isEventActiveInMonth, filterEventsForTraveler } from "./filterEvents";
import type { EventRow } from "@/lib/supabase/types";

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "1", name: "Evento", start_month: 1, end_month: 4, location: "Jurerê",
    target_profiles: ["Todos"], is_free: "Não", active: true, notes: null,
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

describe("isEventActiveInMonth", () => {
  it("is true for a month within a normal (non-wrapping) range", () => {
    expect(isEventActiveInMonth({ start_month: 1, end_month: 4 }, 2)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 1, end_month: 4 }, 5)).toBe(false);
  });

  it("wraps around the year end when start_month > end_month", () => {
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 12)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 1)).toBe(true);
    expect(isEventActiveInMonth({ start_month: 12, end_month: 1 }, 6)).toBe(false);
  });
});

describe("filterEventsForTraveler", () => {
  it("keeps only events active in the given month", () => {
    const events = [event({ id: "in", start_month: 1, end_month: 4 }), event({ id: "out", start_month: 7, end_month: 7 })];
    expect(filterEventsForTraveler(events, {}, 2).map((e) => e.id)).toEqual(["in"]);
  });

  it("filters by the traveler's group when target_profiles is not 'Todos'", () => {
    const events = [
      event({ id: "match", target_profiles: ["Casal"] }),
      event({ id: "no-match", target_profiles: ["Negócios"] }),
    ];
    expect(filterEventsForTraveler(events, { group: "casal" }, 2).map((e) => e.id)).toEqual(["match"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/events/filterEvents.test.ts`
Expected: FAIL — module `./filterEvents` not found.

- [ ] **Step 3: Implement the filters**

```ts
// src/lib/events/filterEvents.ts
import type { EventRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

const GROUP_LABEL: Record<string, string> = { solo: "Solo", casal: "Casal", familia: "Família", amigos: "Amigos" };

export function isEventActiveInMonth(event: Pick<EventRow, "start_month" | "end_month">, month: number): boolean {
  if (event.start_month <= event.end_month) {
    return month >= event.start_month && month <= event.end_month;
  }
  return month >= event.start_month || month <= event.end_month;
}

export function filterEventsForTraveler(events: EventRow[], answers: QuizAnswers, month: number): EventRow[] {
  const profileLabel = answers.group ? GROUP_LABEL[answers.group] : undefined;
  return events.filter((event) => {
    if (!isEventActiveInMonth(event, month)) return false;
    if (!profileLabel) return true;
    return event.target_profiles.includes("Todos") || event.target_profiles.includes(profileLabel);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/events/filterEvents.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for `DicasView`**

```tsx
// src/components/roteiro/DicasView.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/dicas" }));

import { DicasView } from "./DicasView";
import type { EventRow } from "@/lib/supabase/types";

const events: EventRow[] = [
  { id: "1", name: "Fenaostra", start_month: 7, end_month: 7, location: "CentroSul", target_profiles: ["Todos"], is_free: "Parcial", active: true, notes: "Festa Nacional da Ostra.", created_at: "2026-01-01T00:00:00Z" },
];

describe("DicasView", () => {
  it("renders each event's name, location, and notes", () => {
    render(<DicasView slug="abc123" events={events} />);
    expect(screen.getByText("Fenaostra")).toBeInTheDocument();
    expect(screen.getByText("CentroSul")).toBeInTheDocument();
    expect(screen.getByText(/festa nacional da ostra/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no events in season", () => {
    render(<DicasView slug="abc123" events={[]} />);
    expect(screen.getByText(/nenhum evento em cartaz/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/DicasView.test.tsx`
Expected: FAIL — module `./DicasView` not found.

- [ ] **Step 7: Implement `DicasView`**

```tsx
// src/components/roteiro/DicasView.tsx
"use client";

import { BottomNav } from "@/components/nav/BottomNav";
import type { EventRow } from "@/lib/supabase/types";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function DicasView({ slug, events }: { slug: string; events: EventRow[] }) {
  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold">Dicas pra você</h1>
        <p className="mt-1 text-xs text-ink-dim">Eventos em cartaz durante sua viagem</p>
      </div>
      <ul className="mt-6 flex flex-col gap-3 px-4">
        {events.map((event) => (
          <li key={event.id} className="rounded-card border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-bold text-turquoise">
              {MONTH_NAMES[event.start_month]}
              {event.end_month !== event.start_month ? `–${MONTH_NAMES[event.end_month]}` : ""}
            </div>
            <div className="mt-1 font-display text-sm font-bold">{event.name}</div>
            <div className="text-xs text-ink-dim">{event.location}</div>
            {event.notes && <p className="mt-2 text-xs text-ink-dim">{event.notes}</p>}
          </li>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-ink-dim">Nenhum evento em cartaz no momento da sua viagem.</p>
        )}
      </ul>
      <BottomNav slug={slug} />
    </main>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/DicasView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Implement the page**

```tsx
// src/app/roteiro/[slug]/dicas/page.tsx
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listEvents } from "@/lib/supabase/queries";
import { filterEventsForTraveler } from "@/lib/events/filterEvents";
import { DicasView } from "@/components/roteiro/DicasView";
import type { QuizAnswers } from "@/lib/quiz/types";

export default async function DicasPage({ params }: { params: { slug: string } }) {
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, params.slug);
  if (!itinerary) notFound();

  const allEvents = await listEvents(client);
  const month = new Date().getMonth() + 1;
  const events = filterEventsForTraveler(allEvents, itinerary.quiz_answers as QuizAnswers, month);

  return <DicasView slug={params.slug} events={events} />;
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add Dicas page with season-aware, profile-filtered events"
```

---

## Task 22: SOS page

**Files:**
- Create: `src/components/roteiro/SosView.tsx`
- Create: `src/app/roteiro/[slug]/sos/page.tsx`
- Test: `src/components/roteiro/SosView.test.tsx`

**Interfaces:**
- Consumes: `SosPlace` (Task 4), `Chip`/`BottomNav` (Task 18).
- Produces: `<SosView slug places />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/roteiro/SosView.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/sos" }));

import { SosView } from "./SosView";
import type { SosPlace } from "@/lib/supabase/types";

const places: SosPlace[] = [
  { id: "1", category: "saude", tag: "publico", name: "Hospital Universitário", meta: "Trindade · 24h · Público", lat: null, lng: null, phone: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "2", category: "seguranca", tag: "publico", name: "Delegacia do Turista", meta: "Centro · en/es", lat: null, lng: null, phone: null, created_at: "2026-01-01T00:00:00Z" },
];

describe("SosView", () => {
  it("shows every place by default", () => {
    render(<SosView slug="abc123" places={places} />);
    expect(screen.getByText("Hospital Universitário")).toBeInTheDocument();
    expect(screen.getByText("Delegacia do Turista")).toBeInTheDocument();
  });

  it("filters to a single category when its chip is clicked", () => {
    render(<SosView slug="abc123" places={places} />);
    fireEvent.click(screen.getByRole("button", { name: /saúde/i }));
    expect(screen.getByText("Hospital Universitário")).toBeInTheDocument();
    expect(screen.queryByText("Delegacia do Turista")).not.toBeInTheDocument();
  });

  it("shows an empty state when a category has no matches", () => {
    render(<SosView slug="abc123" places={[]} />);
    expect(screen.getByText(/nenhum serviço/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/SosView.test.tsx`
Expected: FAIL — module `./SosView` not found.

- [ ] **Step 3: Implement `SosView`**

```tsx
// src/components/roteiro/SosView.tsx
"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { BottomNav } from "@/components/nav/BottomNav";
import type { SosPlace } from "@/lib/supabase/types";

const CATEGORIES: { key: SosPlace["category"] | "todos"; label: string; icon: string }[] = [
  { key: "todos", label: "Todos", icon: "🆘" },
  { key: "saude", label: "Saúde", icon: "🏥" },
  { key: "seguranca", label: "Segurança", icon: "🚔" },
  { key: "veiculo", label: "Veículo", icon: "🛞" },
  { key: "financeiro", label: "Financeiro", icon: "🏧" },
];

export function SosView({ slug, places }: { slug: string; places: SosPlace[] }) {
  const [category, setCategory] = useState<SosPlace["category"] | "todos">("todos");
  const visible = category === "todos" ? places : places.filter((p) => p.category === category);

  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold text-coral">🆘 SOS Floripa</h1>
        <p className="mt-1 text-xs text-ink-dim">Serviços essenciais perto de você</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.key} selected={category === c.key} onClick={() => setCategory(c.key)}>
              {c.icon} {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="mt-6 flex flex-col gap-2 px-4">
        {visible.map((place) => (
          <li key={place.id} className="rounded-card border border-white/10 bg-white/5 p-3">
            <div className="font-display text-sm font-bold">{place.name}</div>
            <div className="text-xs text-ink-dim">{place.meta}</div>
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-ink-dim">Nenhum serviço nessa categoria ainda.</p>}
      </ul>
      <BottomNav slug={slug} />
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/SosView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the page**

```tsx
// src/app/roteiro/[slug]/sos/page.tsx
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listSosPlaces } from "@/lib/supabase/queries";
import { SosView } from "@/components/roteiro/SosView";

export default async function SosPage({ params }: { params: { slug: string } }) {
  const places = await listSosPlaces(getSupabaseAdminClient());
  return <SosView slug={params.slug} places={places} />;
}
```

- [ ] **Step 6: Seed `sos_places` manually**

The spreadsheet has no SOS data — insert a starter set directly in Supabase Studio (health/vehicle/security/financial essentials for Florianópolis), reusing the categories from the previous project's mockup (`saude`, `veiculo`, `seguranca`, `financeiro`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add SOS page with category filtering"
```

---

## Task 23: Mais page

**Files:**
- Create: `src/components/roteiro/MaisView.tsx`
- Create: `src/app/roteiro/[slug]/mais/page.tsx`
- Test: `src/components/roteiro/MaisView.test.tsx`

**Interfaces:**
- Consumes: `BottomNav` (Task 18).
- Produces: `<MaisView slug />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/roteiro/MaisView.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mais" }));

import { MaisView } from "./MaisView";

describe("MaisView", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal("location", { href: "https://floripa.me/roteiro/abc123" });
  });

  it("renders the action list including a link back to the quiz", () => {
    render(<MaisView slug="abc123" />);
    expect(screen.getByRole("link", { name: /refazer quiz/i })).toHaveAttribute("href", "/quiz");
  });

  it("copies the roteiro link to the clipboard and confirms it", async () => {
    render(<MaisView slug="abc123" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://floripa.me/roteiro/abc123");
    expect(await screen.findByText(/link copiado/i)).toBeInTheDocument();
  });

  it("triggers window.print for the PDF/print action", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<MaisView slug="abc123" />);
    fireEvent.click(screen.getByRole("button", { name: /salvar.*pdf/i }));
    expect(printSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/MaisView.test.tsx`
Expected: FAIL — module `./MaisView` not found.

- [ ] **Step 3: Implement `MaisView`**

```tsx
// src/components/roteiro/MaisView.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/nav/BottomNav";

interface ActionRowProps {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

function ActionRow({ icon, label, onClick, href }: ActionRowProps) {
  const content = (
    <div className="flex items-center justify-between rounded-card border border-white/10 bg-white/5 p-3">
      <span className="text-sm">
        {icon} {label}
      </span>
      <span className="text-ink-dim">›</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

export function MaisView({ slug }: { slug: string }) {
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 3000);
  }

  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold">Mais</h1>
      </div>
      <div className="mt-6 flex flex-col gap-2 px-4">
        <ActionRow icon="✏️" label="Editar roteiro" href={`/roteiro/${slug}`} />
        <ActionRow icon="🔗" label="Compartilhar link" onClick={handleShare} />
        {copyConfirmed && <p className="px-1 text-xs text-turquoise">Link copiado!</p>}
        <ActionRow icon="🖨️" label="Salvar / imprimir PDF" onClick={() => window.print()} />
        <ActionRow icon="🔄" label="Refazer quiz" href="/quiz" />
      </div>
      <BottomNav slug={slug} />
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/MaisView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the page**

```tsx
// src/app/roteiro/[slug]/mais/page.tsx
import { MaisView } from "@/components/roteiro/MaisView";

export default function MaisPage({ params }: { params: { slug: string } }) {
  return <MaisView slug={params.slug} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Mais page: share link, print, redo quiz"
```

---

## Task 24: Edit itinerary — remove an activity

**Files:**
- Create: `src/lib/itinerary/removeActivity.ts`
- Modify: `src/app/api/itineraries/[slug]/route.ts` (add `PATCH`)
- Modify: `src/components/roteiro/DayCard.tsx` (optional remove button)
- Modify: `src/components/roteiro/RoteiroView.tsx` (own state + call the PATCH endpoint)
- Test: `src/lib/itinerary/removeActivity.test.ts`
- Test: `src/app/api/itineraries/[slug]/route.test.ts` (add PATCH cases)
- Test: `src/components/roteiro/DayCard.test.tsx` (add remove-button case)
- Test: `src/components/roteiro/RoteiroView.test.tsx` (add remove-flow case)

**Interfaces:**
- Consumes: `getItineraryBySlug`/`updateItineraryDays` (Task 4), `ItineraryDay` (Task 16).
- Produces: `removeActivity(slug, dayNumber, placeId, supabase)`, `PATCH /api/itineraries/[slug]`.

Scope: removing an activity from a day (drops the day entirely if it becomes empty). Swapping an activity for an alternative is a natural follow-up but isn't built here — it needs its own "pick a replacement" UI, which is out of scope for this pass.

- [ ] **Step 1: Write the failing test for `removeActivity`**

```ts
// src/lib/itinerary/removeActivity.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeActivity, ItineraryNotFoundError } from "./removeActivity";

function fakeSupabase(itinerary: unknown, updateResult: { data: unknown; error: unknown }): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = () => chain;
      chain.single = () => Promise.resolve(updateResult);
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

describe("removeActivity", () => {
  it("removes the matching activity from the given day and leaves other days untouched", async () => {
    const itinerary = {
      slug: "abc123",
      days: [
        { day_number: 1, theme: "d1", activities: [{ place_id: "p1", time: "09:00" }, { place_id: "p2", time: "13:00" }] },
        { day_number: 2, theme: "d2", activities: [{ place_id: "p3", time: "09:00" }] },
      ],
    };
    const updatedRow = { id: "1", slug: "abc123" };
    const supabase = fakeSupabase(itinerary, { data: updatedRow, error: null });

    const result = await removeActivity("abc123", 1, "p1", supabase);

    expect(result).toEqual(updatedRow);
  });

  it("drops the day entirely if removing the activity leaves it empty", async () => {
    let capturedDays: unknown = null;
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "p1", time: "09:00" }] }],
    };
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = (patch: { days: unknown }) => {
        capturedDays = patch.days;
        return chain;
      };
      chain.single = () => Promise.resolve({ data: { id: "1" }, error: null });
      return chain;
    });
    const supabase = { from } as unknown as SupabaseClient;

    await removeActivity("abc123", 1, "p1", supabase);

    expect(capturedDays).toEqual([]);
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const supabase = fakeSupabase(null, { data: null, error: null });
    await expect(removeActivity("missing", 1, "p1", supabase)).rejects.toBeInstanceOf(ItineraryNotFoundError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/itinerary/removeActivity.test.ts`
Expected: FAIL — module `./removeActivity` not found.

- [ ] **Step 3: Implement `removeActivity`**

```ts
// src/lib/itinerary/removeActivity.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";

export class ItineraryNotFoundError extends Error {}

export async function removeActivity(
  slug: string,
  dayNumber: number,
  placeId: string,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const days = (itinerary.days as ItineraryDay[])
    .map((day) =>
      day.day_number === dayNumber
        ? { ...day, activities: day.activities.filter((a) => a.place_id !== placeId) }
        : day,
    )
    .filter((day) => day.activities.length > 0);

  return updateItineraryDays(supabase, slug, days);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/itinerary/removeActivity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the failing PATCH test cases to the route test**

Append to `src/app/api/itineraries/[slug]/route.test.ts` (add `PATCH` and `removeActivity`/`ItineraryNotFoundError` to the mocked-module setup, mirroring how `createItinerary` is mocked in `src/app/api/itineraries/route.test.ts`):

```ts
vi.mock("@/lib/itinerary/removeActivity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/removeActivity")>(
    "@/lib/itinerary/removeActivity",
  );
  return { ...actual, removeActivity: vi.fn() };
});
```

Add near the top, alongside the existing imports:

```ts
import { PATCH } from "./route";
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";
```

And add these cases inside the existing `describe` block:

```ts
describe("PATCH /api/itineraries/[slug]", () => {
  it("returns 400 when day_number or place_id is missing", async () => {
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({}) });
    const response = await PATCH(req, { params: { slug: "abc123" } });
    expect(response.status).toBe(400);
  });

  it("returns the updated itinerary on success", async () => {
    vi.mocked(removeActivity).mockResolvedValue({
      id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ day_number: 1, place_id: "p1" }) });
    const response = await PATCH(req, { params: { slug: "abc123" } });
    expect(response.status).toBe(200);
  });

  it("returns 404 when the itinerary doesn't exist", async () => {
    vi.mocked(removeActivity).mockRejectedValue(new ItineraryNotFoundError("not found"));
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ day_number: 1, place_id: "p1" }) });
    const response = await PATCH(req, { params: { slug: "missing" } });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/app/api/itineraries/[slug]/route.test.ts`
Expected: FAIL — `PATCH` is not exported from `./route`.

- [ ] **Step 7: Implement the PATCH handler**

Append to `src/app/api/itineraries/[slug]/route.ts`:

```ts
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const body = await request.json().catch(() => null);
  const dayNumber = body?.day_number;
  const placeId = body?.place_id;
  if (typeof dayNumber !== "number" || typeof placeId !== "string") {
    return NextResponse.json({ error: "day_number e place_id são obrigatórios" }, { status: 400 });
  }

  try {
    const row = await removeActivity(params.slug, dayNumber, placeId, getSupabaseAdminClient());
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof ItineraryNotFoundError) {
      return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
    }
    console.error("Failed to update itinerary", error);
    return NextResponse.json({ error: "Não foi possível salvar a alteração." }, { status: 500 });
  }
}
```

(Add the import alongside the file's existing imports, not necessarily at the bottom — keep all imports together at the top per normal style.)

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/app/api/itineraries/[slug]/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Add the failing remove-button test to `DayCard.test.tsx`**

Append:

```tsx
it("renders a remove button per activity when onRemove is provided, and calls it with the place_id", () => {
  const onRemove = vi.fn();
  render(<DayCard day={day} onRemove={onRemove} />);
  fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
  expect(onRemove).toHaveBeenCalledWith("p1");
});
```

Add `fireEvent` and `vi` to the existing `@testing-library/react`/`vitest` imports at the top of the file.

- [ ] **Step 10: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/DayCard.test.tsx`
Expected: FAIL — no button with name "remover" is rendered yet.

- [ ] **Step 11: Add the optional remove button to `DayCard`**

Replace the `<li>` body in `src/components/roteiro/DayCard.tsx` (Step 7 of Task 19) with:

```tsx
export function DayCard({ day, onRemove }: { day: ItineraryDay; onRemove?: (placeId: string) => void }) {
  return (
    <section className="rounded-card border border-white/10 bg-white/5 p-4">
      <h2 className="font-display text-xs font-extrabold uppercase tracking-wide text-turquoise">
        Dia {day.day_number} — {day.theme}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {day.activities.map((act) => (
          <li key={`${act.place_id}-${act.time}`} className="flex items-center gap-3">
            <div className="w-12 shrink-0 text-xs text-ink-dim">{act.time}</div>
            <div className="flex-1">
              <div className="font-display text-sm font-bold">
                {act.name}
                {act.is_partner && <span className="ml-2 text-coral">⭐ Parceiro</span>}
              </div>
              <div className="text-xs text-ink-dim">
                {act.price_range} · {act.category}
              </div>
            </div>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remover ${act.name}`}
                onClick={() => onRemove(act.place_id)}
                className="text-ink-dim hover:text-alert"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/DayCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 13: Add the failing remove-flow test to `RoteiroView.test.tsx`**

Append:

```tsx
it("removes an activity via PATCH and updates the view optimistically", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ...itinerary, days: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<RoteiroView itinerary={itinerary} />);
  fireEvent.click(screen.getByRole("button", { name: /remover praia/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/itineraries/abc123",
    expect.objectContaining({ method: "PATCH" }),
  ));
  await waitFor(() => expect(screen.queryByText(/dia 1/i)).not.toBeInTheDocument());

  vi.unstubAllGlobals();
});
```

Add `fireEvent` and `waitFor` to the `@testing-library/react` import at the top of the file.

- [ ] **Step 14: Run the test to verify it fails**

Run: `npm run test -- src/components/roteiro/RoteiroView.test.tsx`
Expected: FAIL — no button named "remover praia" is rendered (`RoteiroView` doesn't pass `onRemove` to `DayCard` yet).

- [ ] **Step 15: Wire remove into `RoteiroView`**

```tsx
// src/components/roteiro/RoteiroView.tsx
"use client";

import { useState } from "react";
import { GlowBackground } from "@/components/ui/GlowBackground";
import { BottomNav } from "@/components/nav/BottomNav";
import { DayCard } from "./DayCard";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function RoteiroView({ itinerary }: { itinerary: ItineraryRow }) {
  const [days, setDays] = useState(itinerary.days as ItineraryDay[]);

  async function handleRemove(dayNumber: number, placeId: string) {
    const previous = days;
    setDays((current) =>
      current
        .map((d) => (d.day_number === dayNumber ? { ...d, activities: d.activities.filter((a) => a.place_id !== placeId) } : d))
        .filter((d) => d.activities.length > 0),
    );
    const response = await fetch(`/api/itineraries/${itinerary.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_number: dayNumber, place_id: placeId }),
    });
    if (!response.ok) {
      setDays(previous);
      return;
    }
    const updated = await response.json();
    setDays(updated.days as ItineraryDay[]);
  }

  return (
    <main className="relative min-h-screen pb-24">
      <GlowBackground />
      <div className="relative px-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-wide text-turquoise">Seu roteiro</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">{itinerary.welcome_message}</h1>
      </div>
      <div className="relative mt-6 flex flex-col gap-4 px-4">
        {days.map((day) => (
          <DayCard key={day.day_number} day={day} onRemove={(placeId) => handleRemove(day.day_number, placeId)} />
        ))}
      </div>
      <BottomNav slug={itinerary.slug} />
    </main>
  );
}
```

- [ ] **Step 16: Run the test to verify it passes**

Run: `npm run test -- src/components/roteiro/RoteiroView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "Add itinerary activity removal: PATCH endpoint and Roteiro UI wiring"
```

---

## Task 25: Surface specific generation errors to the user

**Files:**
- Modify: `src/lib/quiz/submit.ts`
- Modify: `src/lib/quiz/submit.test.ts`

**Interfaces:**
- Consumes: the `{ error: string }` JSON body Task 17's route returns on 422 (no matching candidates) and 502 (generation failure).
- Produces: `submitQuizAnswers` now throws the server's specific message when available.

Two pieces of the spec's error handling (§ Tratamento de erros) are already in place from earlier tasks and don't need new code: the "low candidate pool" case logs a warning server-side for the operator (Task 17, `createItinerary`), and the retry path is already live because the quiz page's error state doesn't clear `flow.answers` — the same "Ver meu roteiro" button submits again with the answers intact (Task 11). What's still generic is the message: today every non-2xx response collapses into one fallback string, so a "not enough places for this profile" case and a real API outage look identical to the traveler. This task makes `submitQuizAnswers` read the server's actual `error` message when the response body has one.

- [ ] **Step 1: Update the failing test**

Replace the existing "throws a friendly error when the response is not ok" test in `src/lib/quiz/submit.test.ts` with:

```ts
it("throws the server's specific error message when the response body has one", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "Não encontramos lugares suficientes para esse perfil ainda." }) }),
  );
  await expect(submitQuizAnswers({})).rejects.toThrow("Não encontramos lugares suficientes para esse perfil ainda.");
});

it("falls back to a generic message when the response body isn't parseable JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.reject(new Error("no body")) }));
  await expect(submitQuizAnswers({})).rejects.toThrow(/não foi possível/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/quiz/submit.test.ts`
Expected: FAIL — the current implementation always throws the generic message, ignoring the response body.

- [ ] **Step 3: Update `submitQuizAnswers`**

```ts
// src/lib/quiz/submit.ts
import type { QuizAnswers } from "./types";

export async function submitQuizAnswers(answers: QuizAnswers): Promise<{ slug: string }> {
  const response = await fetch("/api/itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Não foi possível gerar o roteiro. Tente novamente em instantes.");
  }
  return response.json();
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: PASS — every test file written across Tasks 1–25 is green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Surface the server's specific error message on itinerary generation failure"
```

---

## Final manual verification

Automated tests cover the deterministic logic (filtering, ranking, schema, generation orchestration, navigation, edit). The parts that can't be asserted in CI need one manual pass through the real app before calling v1 done:

1. `npm run migrate:excel`, `npm run places:discover`, `npm run places:enrich`, and manually seed `sos_places` (Tasks 5–7, 22) against a real Supabase project.
2. Go through `/quiz` end to end for at least 3 different profiles (e.g. solo/low-budget, família/high-budget with a special need, casal/gastronomia) and read the generated `welcome_message` and days for each — confirm the tone reads well and every suggested place is real (spec § Testes: "avaliada manualmente rodando perfis de exemplo").
3. On each generated roteiro, click through Mapa, Dicas, SOS, and Mais — confirm pins render, events (if any are in season) match the profile, SOS categories filter correctly, and share/print/redo work.
4. Remove an activity from a day and confirm it persists after a page reload.
5. Install the PWA from a mobile browser ("Adicionar à tela inicial") and confirm the icon and splash match the Ilha Neon Noturna identity.

