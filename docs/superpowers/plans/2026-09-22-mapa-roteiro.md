# Mapa do Roteiro: Visual, Ícones, Filtro por Dia e Sugestões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp `/roteiro/[slug]/mapa` with a themed Leaflet tile layer, category-based marker icons, a per-day filter, and a suggestions menu (category chips + collapsible list) that lets a visitor add a nearby place straight from the map.

**Architecture:** `MapaView.tsx` keeps a single persistent Leaflet map instance (created once) and re-renders two sets of markers — itinerary stops and nearby suggestions — via focused `useEffect`s whenever the underlying data or active filters change, instead of tearing down and rebuilding the whole map. New pure helper modules (`mapIcons.ts`, widened `NearbyPlace`, `addPlaceActivity.ts`) carry the new logic so it can be unit tested without mocking Leaflet.

**Tech Stack:** Next.js 15 (App Router), React 19, Leaflet 1.9 (dynamically imported client-side), Supabase, Vitest + Testing Library. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-22-mapa-roteiro-design.md`

## Global Constraints

- No new npm dependencies. Tile theme change is a URL swap; marker icons are hand-authored inline SVG, matching the existing pattern of local icon components (see `src/app/page.tsx`'s `ClockIcon`, `BadgeIcon`).
- All Supabase access goes through `src/lib/supabase/queries.ts` — no ad-hoc `.from(...)` calls in route handlers or lib functions.
- Every new function and every new PATCH branch needs a passing test before moving to the next task (this repo's existing convention — see `addActivity.test.ts`, `route.test.ts`).
- The suggestions category chip bar is limited to the four already-validated values: Todos, Praia, Gastronomia, Compras, Cultura. Do not add "Noite"/"Negócios" chips — out of the approved design.
- Reuse the existing `EstablishmentModal` component for suggestion details (fotos, avaliações) rather than building a new one.

---

## Task 1: Category icon styles (`mapIcons.ts`)

**Files:**
- Create: `src/lib/itinerary/mapIcons.ts`
- Test: `src/lib/itinerary/mapIcons.test.ts`

**Interfaces:**
- Produces: `getCategoryStyle(category: string): CategoryStyle`, `categoryIconOptions(category: string, variant: "stop" | "partner" | "suggestion"): { html: string; className: string; iconSize: [number, number]; iconAnchor: [number, number] }`, `CATEGORY_STYLES: Record<string, CategoryStyle>`. Used by Task 3 (MapaView) to build Leaflet `divIcon` options.

- [ ] **Step 1: Write the failing test**

Create `src/lib/itinerary/mapIcons.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCategoryStyle, categoryIconOptions, CATEGORY_STYLES } from "./mapIcons";

describe("getCategoryStyle", () => {
  it("returns the mapped style for a known category", () => {
    expect(getCategoryStyle("Praia").color).toBe(CATEGORY_STYLES.Praia.color);
  });

  it("falls back to a default style for an unknown category", () => {
    const style = getCategoryStyle("Categoria Inexistente");
    expect(style.color).toBe("#123542");
  });
});

describe("categoryIconOptions", () => {
  it("builds a bigger, opaque icon for a confirmed itinerary stop", () => {
    const opts = categoryIconOptions("Praia", "stop");
    expect(opts.iconSize).toEqual([34, 34]);
    expect(opts.html).toContain("#00A8E0");
    expect(opts.html).toContain("opacity:1");
  });

  it("adds a gold border for a partner stop", () => {
    const opts = categoryIconOptions("Praia", "partner");
    expect(opts.html).toContain("#F2B705");
  });

  it("builds a smaller, translucent icon for a suggestion", () => {
    const opts = categoryIconOptions("Gastronomia", "suggestion");
    expect(opts.iconSize).toEqual([26, 26]);
    expect(opts.html).toContain("opacity:0.85");
    expect(opts.html).toContain("#FF7A59");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/itinerary/mapIcons.test.ts`
Expected: FAIL with "Cannot find module './mapIcons'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/itinerary/mapIcons.ts`:

```ts
export interface CategoryStyle {
  color: string;
  path: string;
}

const COLORS = {
  blue: "#00A8E0",
  turquoise: "#00E6C8",
  coral: "#FF7A59",
  turquoiseDeep: "#007367",
  coralDeep: "#A8391F",
  graphiteDeep: "#123542",
};

const GOLD = "#F2B705";

const DEFAULT_STYLE: CategoryStyle = {
  color: COLORS.graphiteDeep,
  path: "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Praia: { color: COLORS.blue, path: "M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M5 13l5-9 3 5 2-3 4 5" },
  Trilha: { color: COLORS.blue, path: "M4 20l6-16 3 8 2-4 5 12M8 20h8" },
  Natureza: { color: COLORS.blue, path: "M12 3 6 14h4l-3 7h10l-3-7h4Z" },
  Mirante: { color: COLORS.blue, path: "M3 18 9 6l4 7 2-3 6 8H3Z" },
  Atividade: {
    color: COLORS.turquoise,
    path: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
  },
  Esporte: { color: COLORS.turquoise, path: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20" },
  Passeio: { color: COLORS.turquoise, path: "M4 19c4-10 12-10 16 0M8 19V9l4-4 4 4v10" },
  Gastronomia: { color: COLORS.coral, path: "M7 2v8a2 2 0 0 0 4 0V2M9 10v12M17 2c-2 0-3 2-3 5s1 5 3 5v10" },
  "Café / Padaria": {
    color: COLORS.coral,
    path: "M4 8h13a3 3 0 0 1 0 6h-1M4 8v8a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4v-2M4 8l1-4h8l1 4",
  },
  Cultura: { color: COLORS.turquoiseDeep, path: "M4 10 12 4l8 6M5 10v9h14v-9M9 19v-6h6v6" },
  "Bar / Noturno": { color: COLORS.coralDeep, path: "M5 4h14l-6 8v7h3v1H8v-1h3v-7L5 4Z" },
  "Beach Club": { color: COLORS.coralDeep, path: "M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9ZM3 15h18M3 19h18" },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}

export type PinVariant = "stop" | "partner" | "suggestion";

export function categoryIconOptions(
  category: string,
  variant: PinVariant,
): { html: string; className: string; iconSize: [number, number]; iconAnchor: [number, number] } {
  const style = getCategoryStyle(category);
  const size = variant === "suggestion" ? 26 : 34;
  const border = variant === "partner" ? `3px solid ${GOLD}` : "2px solid #fff";
  const opacity = variant === "suggestion" ? "0.85" : "1";
  const iconSize = Math.round(size * 0.55);
  const html =
    `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${style.color};` +
    `border:${border};opacity:${opacity};box-shadow:0 1px 4px rgba(0,0,0,.4);` +
    `display:flex;align-items:center;justify-content:center">` +
    `<svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="#fff" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${style.path}"/></svg>` +
    `</div>`;
  return { html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/itinerary/mapIcons.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/mapIcons.ts src/lib/itinerary/mapIcons.test.ts
git commit -m "feat: add category-based marker icon styles for the roteiro map"
```

---

## Task 2: Widen `NearbyPlace` with the fields the map/modal need

**Files:**
- Modify: `src/lib/itinerary/nearbyPlaces.ts`
- Modify: `src/lib/itinerary/nearbyPlaces.test.ts`

**Interfaces:**
- Produces: `NearbyPlace` now carries `category, price_range, is_partner, address, short_description, photos, rating, google_place_id, partner_offer` in addition to `id, name, lat, lng`. Consumed by Task 3 (icon variant needs `category`) and Task 8 (`nearbyPlaceToDetail`).
- Consumes: nothing new — same `filterCandidates`/`weightedSample` pipeline.

**Context:** the current `getNearbyPlaces` deliberately narrows the returned shape to 4 fields, and an existing test (`"only returns the fields the map needs..."`) guards against leaking the raw `Place` row (its comment worries about a Google Places API key ending up in `photos`). In this codebase, `photos` entries are always *bare* Google Places photo references — never a URL with an embedded key — see `src/lib/itinerary/placeImages.ts:29-35`, and `ItineraryActivity.photos` (an itinerary's confirmed stops) already ships these bare references to the browser today. So widening `NearbyPlace` to the same whitelist `ItineraryActivity` already uses is not a new exposure — it's consistency. The test is updated to assert the new, larger, but still explicit whitelist (still excluding internal-only fields like `region`, `neighborhood`, `point_type`, `target_profiles`, `special_needs_tags`, `is_verified`, `created_at`, `phone`, `instagram`, `notes`, `partner_plan`, `partner_status`).

- [ ] **Step 1: Write the failing test**

In `src/lib/itinerary/nearbyPlaces.test.ts`, replace the third test (`"only returns the fields the map needs..."`, lines 58-71) with:

```ts
  it("returns an explicit whitelist of fields — including the ones the suggestion modal needs — never the raw place row", async () => {
    // `photos` entries are bare Google Places photo references (routed through
    // /api/place-photo, see placeImages.ts), same as ItineraryActivity.photos
    // already ships to the browser — safe to include here too.
    const itinerary = {
      slug: "abc123",
      quiz_answers: {},
      days: [{ day_number: 1, theme: "d", activities: [] }],
    };
    const places = [place({ id: "p1", region: "Sul", neighborhood: "Campeche", point_type: "Ponto Turístico" })];
    const supabase = fakeSupabase(itinerary, places);

    const result = await getNearbyPlaces("abc123", supabase, 5);

    expect(Object.keys(result[0]).sort()).toEqual(
      [
        "address",
        "category",
        "google_place_id",
        "id",
        "is_partner",
        "lat",
        "lng",
        "name",
        "partner_offer",
        "photos",
        "price_range",
        "rating",
        "short_description",
      ].sort(),
    );
    expect(result[0]).not.toHaveProperty("region");
    expect(result[0]).not.toHaveProperty("neighborhood");
    expect(result[0]).not.toHaveProperty("point_type");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/itinerary/nearbyPlaces.test.ts`
Expected: FAIL — `Object.keys(result[0]).sort()` is `["id","lat","lng","name"]`, not the new whitelist.

- [ ] **Step 3: Write minimal implementation**

Replace `src/lib/itinerary/nearbyPlaces.ts` with:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, listPlaces } from "@/lib/supabase/queries";
import { filterCandidates } from "./filterCandidates";
import { weightedSample } from "./rankCandidates";
import type { ItineraryDay } from "./assemble";
import type { QuizAnswers } from "@/lib/quiz/types";

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  price_range: string;
  is_partner: boolean;
  address: string;
  short_description: string;
  photos: string[];
  rating: number | null;
  google_place_id: string | null;
  partner_offer: string | null;
  lat: number | null;
  lng: number | null;
}

export async function getNearbyPlaces(
  slug: string,
  supabase: SupabaseClient,
  count = 10,
): Promise<NearbyPlace[]> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) return [];

  const usedIds = new Set((itinerary.days as ItineraryDay[]).flatMap((d) => d.activities.map((a) => a.place_id)));
  const allPlaces = await listPlaces(supabase);
  const filtered = filterCandidates(allPlaces, itinerary.quiz_answers as QuizAnswers).filter(
    (p) => !usedIds.has(p.id),
  );

  const sampled = weightedSample(filtered, { count });
  return sampled.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price_range: p.price_range,
    is_partner: p.is_partner,
    address: p.address,
    short_description: p.short_description,
    photos: p.photos,
    rating: p.rating,
    google_place_id: p.google_place_id,
    partner_offer: p.partner_offer,
    lat: p.lat,
    lng: p.lng,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/itinerary/nearbyPlaces.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/nearbyPlaces.ts src/lib/itinerary/nearbyPlaces.test.ts
git commit -m "feat: widen NearbyPlace with the fields the map and suggestion modal need"
```

---

## Task 3: MapaView — persistent map, Voyager tiles, category icons

**Files:**
- Modify: `src/components/roteiro/MapaView.tsx` (full rewrite)
- Modify: `src/components/roteiro/MapaView.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `categoryIconOptions` from Task 1, widened `NearbyPlace` from Task 2.
- Produces: `MapaView` keeps the same public props (`slug, days, nearby`) — no callers need to change.

**Context:** today's `MapaView` rebuilds the entire Leaflet map (new `L.map(...)`, new tile layer, all markers) every time `days`/`nearby` change. Tasks 4 and 5 add a day filter and a category filter that change on every click — rebuilding the whole map on each click would flicker and re-run tile loading. This task splits map creation (once) from marker rendering (reactive), so later tasks can add filters cheaply.

- [ ] **Step 1: Write the failing test**

Replace `src/components/roteiro/MapaView.test.tsx` with:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

const markerInstance = {
  addTo: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  remove: vi.fn(),
};
const tileLayerInstance = { addTo: vi.fn() };
const mapInstance = { remove: vi.fn(), setView: vi.fn().mockReturnThis(), fitBounds: vi.fn() };

const mapFn = vi.fn(() => mapInstance);
const tileLayerFn = vi.fn(() => tileLayerInstance);
const markerFn = vi.fn(() => markerInstance);
const divIconFn = vi.fn((opts: unknown) => opts);
const latLngBoundsFn = vi.fn((coords: unknown) => coords);

vi.mock("leaflet", () => ({
  map: mapFn,
  tileLayer: tileLayerFn,
  marker: markerFn,
  divIcon: divIconFn,
  latLngBounds: latLngBoundsFn,
}));

import { MapaView } from "./MapaView";

function activity(overrides: Partial<ItineraryDay["activities"][number]> = {}): ItineraryDay["activities"][number] {
  return {
    place_id: "1",
    time: "09:00",
    name: "Praia do Campeche",
    category: "Praia",
    price_range: "Gratuito",
    lat: -27.68,
    lng: -48.49,
    is_partner: false,
    address: "",
    short_description: "",
    ...overrides,
  };
}

function nearbyPlace(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    id: "n1",
    name: "Restaurante X",
    category: "Gastronomia",
    price_range: "R$$",
    is_partner: false,
    address: "",
    short_description: "",
    photos: [],
    rating: null,
    google_place_id: null,
    partner_offer: null,
    lat: -27.6,
    lng: -48.5,
    ...overrides,
  };
}

describe("MapaView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the bottom nav with Mapa active", async () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    await waitFor(() => expect(mapFn).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
  });

  it("uses the Voyager tile layer", async () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    await waitFor(() => expect(tileLayerFn).toHaveBeenCalled());
    expect(tileLayerFn).toHaveBeenCalledWith(
      expect.stringContaining("basemaps.cartocdn.com/rastertiles/voyager"),
      expect.any(Object),
    );
    expect(tileLayerInstance.addTo).toHaveBeenCalledWith(mapInstance);
  });

  it("fits the map to the activities with coordinates", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ lat: -27.6, lng: -48.5 })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapInstance.fitBounds).toHaveBeenCalledTimes(1));
    expect(latLngBoundsFn).toHaveBeenCalledWith([[-27.6, -48.5]]);
  });

  it("falls back to the Florianópolis default center when no activity has coordinates", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ lat: null, lng: null })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapFn).toHaveBeenCalledTimes(1));
    expect(markerFn).not.toHaveBeenCalled();
    expect(mapInstance.setView).toHaveBeenLastCalledWith([-27.5954, -48.548], 12);
  });

  it("adds a category-styled marker with a popup for each activity with coordinates", async () => {
    const days: ItineraryDay[] = [
      {
        day_number: 1,
        theme: "Dia 1",
        activities: [activity({ name: "Lagoa da Conceição", category: "Cultura", lat: -27.6, lng: -48.5 })],
      },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
    const iconArg = (markerFn.mock.calls[0][1] as { icon: { html: string } }).icon;
    expect(iconArg.html).toContain("#007367");
    expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance);
    expect(markerInstance.bindPopup).toHaveBeenCalledWith("Lagoa da Conceição");
  });

  it("gives partner activities a gold-ring icon", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ is_partner: true, lat: -27.6, lng: -48.5 })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    const iconArg = (markerFn.mock.calls[0][1] as { icon: { html: string } }).icon;
    expect(iconArg.html).toContain("#F2B705");
  });

  it("adds a marker for each nearby suggestion with coordinates, skipping ones without", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1" }), nearbyPlace({ id: "n2", lat: null, lng: null })];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: FAIL — `tileLayerFn` still called with the OpenStreetMap URL, `mapInstance.fitBounds`/`latLngBoundsFn` never called (don't exist in the old component), icon html doesn't contain hex colors.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/roteiro/MapaView.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BottomNav } from "@/components/nav/BottomNav";
import { categoryIconOptions } from "@/lib/itinerary/mapIcons";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: NearbyPlace[];
}

const DEFAULT_CENTER: [number, number] = [-27.5954, -48.548];
const VOYAGER_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const VOYAGER_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a>';

export function MapaView({ slug, days, nearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const leafletMapRef = useRef<Leaflet.Map | null>(null);
  const stopMarkersRef = useRef<Leaflet.Marker[]>([]);
  const suggestionMarkersRef = useRef<Leaflet.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 12);
      L.tileLayer(VOYAGER_TILE_URL, { attribution: VOYAGER_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      leafletMapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = leafletMapRef.current;
    if (!ready || !L || !map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    const activities = days
      .flatMap((d) => d.activities)
      .filter((a): a is typeof a & { lat: number; lng: number } => a.lat !== null && a.lng !== null);

    activities.forEach((act) => {
      const marker = L.marker([act.lat, act.lng], {
        icon: L.divIcon(categoryIconOptions(act.category, act.is_partner ? "partner" : "stop")),
      })
        .addTo(map)
        .bindPopup(act.name);
      stopMarkersRef.current.push(marker);
    });

    if (activities.length > 0) {
      map.fitBounds(
        L.latLngBounds(activities.map((a) => [a.lat, a.lng])),
        { padding: [40, 40], maxZoom: 15 },
      );
    } else {
      map.setView(DEFAULT_CENTER, 12);
    }
  }, [ready, days]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = leafletMapRef.current;
    if (!ready || !L || !map) return;

    suggestionMarkersRef.current.forEach((m) => m.remove());
    suggestionMarkersRef.current = [];

    nearby
      .filter((p): p is typeof p & { lat: number; lng: number } => p.lat !== null && p.lng !== null)
      .forEach((place) => {
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
        })
          .addTo(map)
          .bindPopup(place.name);
        suggestionMarkersRef.current.push(marker);
      });
  }, [ready, nearby]);

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />
      <BottomNav slug={slug} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/roteiro/MapaView.tsx src/components/roteiro/MapaView.test.tsx
git commit -m "feat: switch roteiro map to Voyager tiles and category-based marker icons"
```

---

## Task 4: Day filter (tabs + auto-fit per day)

**Files:**
- Modify: `src/components/roteiro/MapaView.tsx`
- Modify: `src/components/roteiro/MapaView.test.tsx`

**Interfaces:**
- Consumes: `ItineraryDay[]` (already a prop).
- Produces: internal `selectedDay` state — no new exports.

- [ ] **Step 1: Write the failing test**

In `src/components/roteiro/MapaView.test.tsx`, change the testing-library import to add `fireEvent`:

```ts
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
```

Add these tests at the end of the `describe("MapaView", ...)` block (before the closing `});`):

```tsx
  it("only shows day tabs when there is more than one day", async () => {
    render(<MapaView slug="abc123" days={[{ day_number: 1, theme: "Dia 1", activities: [] }]} nearby={[]} />);
    await waitFor(() => expect(mapFn).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Dia 1" })).not.toBeInTheDocument();
  });

  it("filters markers to the selected day and switches when a day tab is clicked", async () => {
    const days: ItineraryDay[] = [
      {
        day_number: 1,
        theme: "Dia 1",
        activities: [activity({ place_id: "d1", name: "Dia 1 lugar", lat: -27.6, lng: -48.5 })],
      },
      {
        day_number: 2,
        theme: "Dia 2",
        activities: [activity({ place_id: "d2", name: "Dia 2 lugar", lat: -27.7, lng: -48.6 })],
      },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalledWith("Dia 1 lugar"));
    expect(markerInstance.bindPopup).not.toHaveBeenCalledWith("Dia 2 lugar");

    fireEvent.click(screen.getByRole("button", { name: "Dia 2" }));

    await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalledWith("Dia 2 lugar"));
  });

  it("defaults to the first day that has activities with coordinates", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ place_id: "d1", lat: null, lng: null })] },
      {
        day_number: 2,
        theme: "Dia 2",
        activities: [activity({ place_id: "d2", name: "Dia 2 lugar", lat: -27.7, lng: -48.6 })],
      },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);
    await waitFor(() => expect(markerInstance.bindPopup).toHaveBeenCalledWith("Dia 2 lugar"));
    expect(screen.getByRole("button", { name: "Dia 2" })).toHaveClass("bg-turquoise");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: FAIL — there is no "Dia 1"/"Dia 2" button yet, and markers still come from all days combined.

- [ ] **Step 3: Write minimal implementation**

In `src/components/roteiro/MapaView.tsx`, add this helper above the `MapaView` function:

```ts
function firstDayWithCoords(days: ItineraryDay[]): number {
  const dayWithCoords = days.find((d) => d.activities.some((a) => a.lat !== null && a.lng !== null));
  return dayWithCoords?.day_number ?? days[0]?.day_number ?? 1;
}
```

Add day state right after `const [ready, setReady] = useState(false);`:

```ts
  const [selectedDay, setSelectedDay] = useState(() => firstDayWithCoords(days));
```

Replace the activities line inside the stop-markers effect:

```ts
    const activities = days
      .flatMap((d) => d.activities)
      .filter((a): a is typeof a & { lat: number; lng: number } => a.lat !== null && a.lng !== null);
```

with:

```ts
    const activeDay = days.find((d) => d.day_number === selectedDay);
    const activities = (activeDay?.activities ?? []).filter(
      (a): a is typeof a & { lat: number; lng: number } => a.lat !== null && a.lng !== null,
    );
```

and change that effect's dependency array from `[ready, days]` to `[ready, days, selectedDay]`.

Replace the `return (...)` block with:

```tsx
  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />

      {days.length > 1 && (
        <div className="no-scrollbar absolute left-3 right-3 top-3 flex gap-2 overflow-x-auto">
          {days.map((day) => (
            <button
              key={day.day_number}
              type="button"
              onClick={() => setSelectedDay(day.day_number)}
              className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-bold shadow ${
                selectedDay === day.day_number ? "bg-turquoise text-graphite" : "bg-white/90 text-graphite"
              }`}
            >
              Dia {day.day_number}
            </button>
          ))}
        </div>
      )}

      <BottomNav slug={slug} />
    </main>
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/roteiro/MapaView.tsx src/components/roteiro/MapaView.test.tsx
git commit -m "feat: filter roteiro map markers by day, with a day tab selector"
```

---

## Task 5: Category chip bar + collapsible suggestions sheet

**Files:**
- Modify: `src/lib/itinerary/filterCandidates.ts:11` (export `STYLE_CATEGORIES`)
- Modify: `src/components/roteiro/MapaView.tsx`
- Modify: `src/components/roteiro/MapaView.test.tsx`

**Interfaces:**
- Produces: `STYLE_CATEGORIES` exported from `filterCandidates.ts` (used here and already implicitly relied on by `filterCandidates()`).

- [ ] **Step 1: Write the failing test**

Add these tests to the end of the `describe("MapaView", ...)` block in `src/components/roteiro/MapaView.test.tsx`:

```tsx
  it("filters nearby suggestion markers by category chip", async () => {
    const nearby: NearbyPlace[] = [
      nearbyPlace({ id: "n1", name: "Praia Y", category: "Praia", lat: -27.61, lng: -48.51 }),
      nearbyPlace({ id: "n2", name: "Restaurante Z", category: "Gastronomia", lat: -27.62, lng: -48.52 }),
    ];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);
    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Gastronomia" }));

    await waitFor(() => expect(markerInstance.remove).toHaveBeenCalled());
    expect(markerFn).toHaveBeenLastCalledWith([-27.62, -48.52], expect.any(Object));
  });

  it("shows a collapsible list of the visible suggestions", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1", name: "Restaurante Z" })];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);
    await waitFor(() => expect(screen.getByText("Restaurante Z")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /recolher sugest/i }));
    expect(screen.queryByText("Restaurante Z")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: FAIL — no "Gastronomia" chip button and no suggestion list exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/itinerary/filterCandidates.ts`, export the constant:

```ts
export const STYLE_CATEGORIES: Record<string, string[]> = {
```

(only the `const` → `export const` change on that line; the rest of the object is unchanged.)

In `src/components/roteiro/MapaView.tsx`, update the imports:

```ts
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BottomNav } from "@/components/nav/BottomNav";
import { categoryIconOptions } from "@/lib/itinerary/mapIcons";
import { STYLE_CATEGORIES } from "@/lib/itinerary/filterCandidates";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";
```

Add these module-scope constants below `firstDayWithCoords`:

```ts
const CATEGORY_CHIPS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "praia", label: "Praia" },
  { value: "gastronomia", label: "Gastronomia" },
  { value: "compras", label: "Compras" },
  { value: "cultura", label: "Cultura" },
];

function matchesCategory(chip: string, category: string): boolean {
  if (chip === "todos") return true;
  return (STYLE_CATEGORIES[chip] ?? []).includes(category);
}
```

Add state below `selectedDay`:

```ts
  const [activeCategory, setActiveCategory] = useState("todos");
  const [sheetOpen, setSheetOpen] = useState(true);
```

Add a memoized filtered list above the suggestion-markers effect:

```ts
  const visibleSuggestions = useMemo(
    () =>
      nearby.filter(
        (p): p is typeof p & { lat: number; lng: number } =>
          p.lat !== null && p.lng !== null && matchesCategory(activeCategory, p.category),
      ),
    [nearby, activeCategory],
  );
```

Replace the body of the suggestion-markers effect (keep the same `useEffect` wrapper) — change:

```ts
    nearby
      .filter((p): p is typeof p & { lat: number; lng: number } => p.lat !== null && p.lng !== null)
      .forEach((place) => {
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
        })
          .addTo(map)
          .bindPopup(place.name);
        suggestionMarkersRef.current.push(marker);
      });
  }, [ready, nearby]);
```

to:

```ts
    visibleSuggestions.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
      })
        .addTo(map)
        .bindPopup(place.name);
      suggestionMarkersRef.current.push(marker);
    });
  }, [ready, visibleSuggestions]);
```

Insert the chip bar and the suggestions sheet into the JSX, between the day-tabs block and `<BottomNav slug={slug} />`:

```tsx
      <div
        className="no-scrollbar absolute left-3 right-3 flex gap-2 overflow-x-auto"
        style={{ top: days.length > 1 ? 56 : 12 }}
      >
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setActiveCategory(chip.value)}
            className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-bold shadow ${
              activeCategory === chip.value ? "bg-turquoise text-graphite" : "bg-white/90 text-graphite"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="absolute inset-x-0 bottom-16 rounded-t-2xl bg-graphite/95 px-3 pb-2 pt-2 shadow-lg">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={sheetOpen ? "Recolher sugestões" : "Expandir sugestões"}
            className="mx-auto block h-1 w-9 rounded-full bg-white/30"
          />
          {sheetOpen && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {visibleSuggestions.map((place) => (
                <div key={place.id} className="w-28 shrink-0 rounded-card bg-white/10 p-2 text-left">
                  <p className="truncate text-xs font-bold text-ink">{place.name}</p>
                  <p className="truncate text-[10px] text-ink-dim">{place.category}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: PASS (12 tests)

Also run the filterCandidates suite to make sure the export didn't change its behavior:

Run: `npx vitest run src/lib/itinerary/filterCandidates.test.ts`
Expected: PASS (unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/filterCandidates.ts src/components/roteiro/MapaView.tsx src/components/roteiro/MapaView.test.tsx
git commit -m "feat: add category chip filter and collapsible suggestions sheet to the map"
```

---

## Task 6: `getPlaceById` + `addPlaceActivity`

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/lib/supabase/queries.test.ts`
- Create: `src/lib/itinerary/addPlaceActivity.ts`
- Test: `src/lib/itinerary/addPlaceActivity.test.ts`

**Interfaces:**
- Produces: `getPlaceById(client, id): Promise<Place | null>`; `addPlaceActivity(slug, dayNumber, placeId, supabase): Promise<ItineraryRow>`; `PlaceNotFoundError`. Consumed by Task 7 (PATCH route).
- Consumes: `getItineraryBySlug`, `updateItineraryDays` (existing), `ItineraryActivity`/`ItineraryDay` from `./assemble`, `ItineraryNotFoundError` from `./removeActivity`.

- [ ] **Step 1: Write the failing test**

Add `getPlaceById` to the import list at the top of `src/lib/supabase/queries.test.ts`:

```ts
import {
  listPlaces,
  listEvents,
  listSosPlaces,
  listPartners,
  insertItinerary,
  getItineraryBySlug,
  updateItineraryDays,
  updatePlaceEnrichment,
  getPlaceById,
} from "./queries";
```

Add this test at the end of the `describe("queries", ...)` block:

```ts
  it("getPlaceById returns the matching place, or null when not found", async () => {
    const row = { id: "p1", name: "Praia do Campeche" };
    const client = fakeClientFor("places", makeChain({ data: row, error: null }));
    await expect(getPlaceById(client, "p1")).resolves.toEqual(row);

    const missingClient = fakeClientFor("places", makeChain({ data: null, error: null }));
    await expect(getPlaceById(missingClient, "missing")).resolves.toBeNull();
  });
```

Create `src/lib/itinerary/addPlaceActivity.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addPlaceActivity, PlaceNotFoundError } from "./addPlaceActivity";
import { ItineraryNotFoundError } from "./removeActivity";

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "Praia extensa.", address: "Campeche",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: "ChIJ-abc", lat: -27.68, lng: -48.49, rating: 4.5, photos: ["places/abc/photos/1"],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeSupabase(itinerary: unknown, placeRow: unknown) {
  let capturedDays: unknown = null;
  const from = vi.fn((table: string) => {
    if (table === "itineraries") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: itinerary, error: null });
      chain.update = (patch: { days: unknown }) => {
        capturedDays = patch.days;
        return chain;
      };
      chain.single = () => Promise.resolve({ data: { id: "1", days: capturedDays }, error: null });
      return chain;
    }
    if (table === "places") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: placeRow, error: null });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { supabase: { from } as unknown as SupabaseClient, getCapturedDays: () => capturedDays };
}

describe("addPlaceActivity", () => {
  it("adds the place as a new activity, timed 90 minutes after the day's last activity", async () => {
    const itinerary = {
      slug: "abc123",
      days: [{ day_number: 1, theme: "d1", activities: [{ place_id: "other", name: "Café", time: "09:00" }] }],
    };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await addPlaceActivity("abc123", 1, "p1", supabase);

    const days = getCapturedDays() as Array<{
      activities: Array<{ place_id: string; name: string; time: string; category: string; lat: number | null }>;
    }>;
    const added = days[0].activities.find((a) => a.place_id === "p1");
    expect(added).toMatchObject({ name: "Praia do Campeche", time: "10:30", category: "Praia", lat: -27.68 });
  });

  it("defaults to 09:00 when the day has no activities yet", async () => {
    const itinerary = { slug: "abc123", days: [{ day_number: 1, theme: "d1", activities: [] }] };
    const { supabase, getCapturedDays } = fakeSupabase(itinerary, place());

    await addPlaceActivity("abc123", 1, "p1", supabase);

    const days = getCapturedDays() as Array<{ activities: Array<{ time: string }> }>;
    expect(days[0].activities[0].time).toBe("09:00");
  });

  it("throws ItineraryNotFoundError when the slug doesn't exist", async () => {
    const { supabase } = fakeSupabase(null, place());
    await expect(addPlaceActivity("missing", 1, "p1", supabase)).rejects.toBeInstanceOf(ItineraryNotFoundError);
  });

  it("throws PlaceNotFoundError when the place doesn't exist", async () => {
    const itinerary = { slug: "abc123", days: [{ day_number: 1, theme: "d1", activities: [] }] };
    const { supabase } = fakeSupabase(itinerary, null);
    await expect(addPlaceActivity("abc123", 1, "missing", supabase)).rejects.toBeInstanceOf(PlaceNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase/queries.test.ts src/lib/itinerary/addPlaceActivity.test.ts`
Expected: FAIL — `getPlaceById` isn't exported yet, `./addPlaceActivity` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/supabase/queries.ts`, add at the end of the file:

```ts
export async function getPlaceById(client: SupabaseClient, id: string): Promise<Place | null> {
  const { data, error } = await client.from("places").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Place | null;
}
```

Create `src/lib/itinerary/addPlaceActivity.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getItineraryBySlug, getPlaceById, updateItineraryDays } from "@/lib/supabase/queries";
import type { ItineraryActivity, ItineraryDay } from "./assemble";
import type { ItineraryRow } from "@/lib/supabase/types";
import { ItineraryNotFoundError } from "./removeActivity";

export class PlaceNotFoundError extends Error {}

function nextTimeSlot(activities: ItineraryActivity[]): string {
  if (activities.length === 0) return "09:00";
  const last = activities.reduce((a, b) => (a.time > b.time ? a : b));
  const [hours, minutes] = last.time.split(":").map(Number);
  const total = hours * 60 + minutes + 90;
  const nextHours = Math.min(23, Math.floor(total / 60));
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

export async function addPlaceActivity(
  slug: string,
  dayNumber: number,
  placeId: string,
  supabase: SupabaseClient,
): Promise<ItineraryRow> {
  const itinerary = await getItineraryBySlug(supabase, slug);
  if (!itinerary) throw new ItineraryNotFoundError(`Itinerary not found: ${slug}`);

  const place = await getPlaceById(supabase, placeId);
  if (!place) throw new PlaceNotFoundError(`Place not found: ${placeId}`);

  const days = itinerary.days as ItineraryDay[];
  const day = days.find((d) => d.day_number === dayNumber);
  const time = nextTimeSlot(day?.activities ?? []);

  const newActivity: ItineraryActivity = {
    place_id: place.id,
    name: place.name,
    time,
    category: place.category,
    price_range: place.price_range,
    is_partner: place.is_partner,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    photo: place.photos[0],
    photos: place.photos,
    rating: place.rating,
    google_place_id: place.google_place_id,
    partner_offer: place.partner_offer,
    short_description: place.short_description,
  };

  const updatedDays = days.map((d) =>
    d.day_number === dayNumber
      ? { ...d, activities: [...d.activities, newActivity].sort((a, b) => a.time.localeCompare(b.time)) }
      : d,
  );

  return updateItineraryDays(supabase, slug, updatedDays);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/supabase/queries.test.ts src/lib/itinerary/addPlaceActivity.test.ts`
Expected: PASS (11 + 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts src/lib/supabase/queries.test.ts src/lib/itinerary/addPlaceActivity.ts src/lib/itinerary/addPlaceActivity.test.ts
git commit -m "feat: add addPlaceActivity to insert a real Place into an itinerary day"
```

---

## Task 7: `PATCH /api/itineraries/[slug]` — `add_place_id` branch

**Files:**
- Modify: `src/app/api/itineraries/[slug]/route.ts`
- Modify: `src/app/api/itineraries/[slug]/route.test.ts`

**Interfaces:**
- Consumes: `addPlaceActivity`, `PlaceNotFoundError` from Task 6.
- Produces: `PATCH` now also accepts `{ day_number, add_place_id }`. The existing `{ day_number, place_id }` (remove) and `{ day_number, activity }` (custom add) contracts are unchanged.

- [ ] **Step 1: Write the failing test**

In `src/app/api/itineraries/[slug]/route.test.ts`, add a mock for the new module (next to the existing `removeActivity` mock) and import the new symbols:

```ts
vi.mock("@/lib/itinerary/addPlaceActivity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/itinerary/addPlaceActivity")>(
    "@/lib/itinerary/addPlaceActivity",
  );
  return { ...actual, addPlaceActivity: vi.fn() };
});

import { GET, PATCH } from "./route";
import { getItineraryBySlug } from "@/lib/supabase/queries";
import { removeActivity, ItineraryNotFoundError } from "@/lib/itinerary/removeActivity";
import { addPlaceActivity, PlaceNotFoundError } from "@/lib/itinerary/addPlaceActivity";
```

Add these tests inside `describe("PATCH /api/itineraries/[slug]", ...)`:

```ts
  it("returns 400 when add_place_id is not a string", async () => {
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: 123 }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(400);
  });

  it("adds a place by id and returns the updated itinerary", async () => {
    vi.mocked(addPlaceActivity).mockResolvedValue({
      id: "1", slug: "abc123", quiz_answers: {}, welcome_message: "Oi!", days: [], created_at: "2026-01-01T00:00:00Z",
    });
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: "p1" }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(200);
    expect(addPlaceActivity).toHaveBeenCalledWith("abc123", 1, "p1", {});
  });

  it("returns 404 when the place doesn't exist", async () => {
    vi.mocked(addPlaceActivity).mockRejectedValue(new PlaceNotFoundError("not found"));
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ day_number: 1, add_place_id: "missing" }),
    });
    const response = await PATCH(req, { params: Promise.resolve({ slug: "abc123" }) });
    expect(response.status).toBe(404);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/itineraries/[slug]/route.test.ts`
Expected: FAIL — `add_place_id` is currently ignored, so the route falls through to "place_id é obrigatório" (400) instead of calling `addPlaceActivity`.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/itineraries/[slug]/route.ts`, add the import:

```ts
import { addPlaceActivity, PlaceNotFoundError } from "@/lib/itinerary/addPlaceActivity";
```

Insert a new branch right after the existing `if (body?.activity) { ... }` block and before the `place_id` (remove) check:

```ts
    if (body?.add_place_id) {
      const addPlaceId = body.add_place_id;
      if (typeof addPlaceId !== "string") {
        return NextResponse.json({ error: "add_place_id deve ser uma string" }, { status: 400 });
      }
      const row = await addPlaceActivity(slug, dayNumber, addPlaceId, getSupabaseAdminClient());
      return NextResponse.json(row);
    }
```

Extend the `catch` block to handle the new error, right after the `ItineraryNotFoundError` check:

```ts
    if (error instanceof PlaceNotFoundError) {
      return NextResponse.json({ error: "Lugar não encontrado" }, { status: 404 });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/itineraries/[slug]/route.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/itineraries/[slug]/route.ts src/app/api/itineraries/[slug]/route.test.ts
git commit -m "feat: accept add_place_id in the itinerary PATCH endpoint"
```

---

## Task 8: `EstablishmentModal` — add-to-itinerary button

**Files:**
- Modify: `src/components/roteiro/EstablishmentModal.tsx`
- Modify: `src/components/roteiro/EstablishmentModal.test.tsx`

**Interfaces:**
- Produces: `EstablishmentDetail` gains `id: string`. `EstablishmentModal` gains an optional `onAdd?: () => void` prop. New export `nearbyPlaceToDetail(place: NearbyPlace): EstablishmentDetail`. Consumed by Task 9 (MapaView wiring).
- Consumes: `NearbyPlace` from Task 2.

- [ ] **Step 1: Write the failing test**

In `src/components/roteiro/EstablishmentModal.test.tsx`, update the imports and the `detail()` factory to include `id`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EstablishmentModal, nearbyPlaceToDetail, type EstablishmentDetail } from "./EstablishmentModal";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

function detail(overrides: Partial<EstablishmentDetail>): EstablishmentDetail {
  return {
    id: "p1",
    name: "Ilha do Campeche",
    category: "Praia",
    price_range: "R$$$",
    address: "Saída da Praia do Campeche",
    short_description: "Um dos principais atrativos de Floripa; acesso depende de operação e mar.",
    photos: [],
    rating: null,
    google_place_id: null,
    partner_offer: null,
    lat: null,
    lng: null,
    ...overrides,
  };
}
```

Add these tests inside `describe("EstablishmentModal", ...)`:

```tsx
  it("shows an Adicionar ao roteiro button only when onAdd is provided", () => {
    const { rerender } = render(<EstablishmentModal detail={detail({})} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /adicionar ao roteiro/i })).not.toBeInTheDocument();

    rerender(<EstablishmentModal detail={detail({})} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /adicionar ao roteiro/i })).toBeInTheDocument();
  });

  it("calls onAdd when the button is clicked", () => {
    const onAdd = vi.fn();
    render(<EstablishmentModal detail={detail({})} onClose={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar ao roteiro/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
```

Add a new describe block at the end of the file:

```tsx
describe("nearbyPlaceToDetail", () => {
  it("maps a NearbyPlace into an EstablishmentDetail", () => {
    const place: NearbyPlace = {
      id: "n1",
      name: "Restaurante X",
      category: "Gastronomia",
      price_range: "R$$",
      is_partner: false,
      address: "Rua X",
      short_description: "Bom",
      photos: ["places/x/photos/1"],
      rating: 4.2,
      google_place_id: "ChIJ-x",
      partner_offer: null,
      lat: -27.6,
      lng: -48.5,
    };
    expect(nearbyPlaceToDetail(place)).toEqual({
      id: "n1",
      name: "Restaurante X",
      category: "Gastronomia",
      price_range: "R$$",
      address: "Rua X",
      short_description: "Bom",
      photos: ["places/x/photos/1"],
      rating: 4.2,
      google_place_id: "ChIJ-x",
      partner_offer: null,
      lat: -27.6,
      lng: -48.5,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/roteiro/EstablishmentModal.test.tsx`
Expected: FAIL — no `onAdd` prop/button, `nearbyPlaceToDetail` isn't exported.

- [ ] **Step 3: Write minimal implementation**

In `src/components/roteiro/EstablishmentModal.tsx`, update imports:

```ts
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import type { Place } from "@/lib/supabase/types";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";
```

Add `id` to `EstablishmentDetail`:

```ts
export interface EstablishmentDetail {
  id: string;
  name: string;
  category: string;
  price_range: string;
  address: string;
  short_description?: string;
  photos: string[];
  rating: number | null;
  google_place_id: string | null;
  partner_offer?: string | null;
  lat: number | null;
  lng: number | null;
}
```

Add `id` in `placeToDetail`:

```ts
export function placeToDetail(place: Place): EstablishmentDetail {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    price_range: place.price_range,
    address: place.address,
    short_description: place.short_description,
    photos: place.photos,
    rating: place.rating,
    google_place_id: place.google_place_id,
    partner_offer: place.partner_offer,
    lat: place.lat,
    lng: place.lng,
  };
}
```

Add the new conversion function right after `placeToDetail`:

```ts
export function nearbyPlaceToDetail(place: NearbyPlace): EstablishmentDetail {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    price_range: place.price_range,
    address: place.address,
    short_description: place.short_description,
    photos: place.photos,
    rating: place.rating,
    google_place_id: place.google_place_id,
    partner_offer: place.partner_offer,
    lat: place.lat,
    lng: place.lng,
  };
}
```

Update the component signature:

```tsx
export function EstablishmentModal({
  detail,
  onClose,
  onAdd,
}: {
  detail: EstablishmentDetail | null;
  onClose: () => void;
  onAdd?: () => void;
}) {
```

Insert the button right before the `<div className="mt-4 flex gap-2">` actions row:

```tsx
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 w-full rounded-pill bg-turquoise py-2 text-center text-xs font-bold text-graphite"
          >
            ➕ Adicionar ao roteiro
          </button>
        )}

        <div className="mt-4 flex gap-2">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/roteiro/EstablishmentModal.test.tsx`
Expected: PASS (11 tests)

- [ ] **Step 5: Run the full suite to catch other `EstablishmentDetail` consumers**

Run: `npx vitest run src/components/roteiro`
Expected: PASS — `RoteiroView.tsx` calls `placeToDetail(place)`, which now includes `id` automatically; no other file constructs an `EstablishmentDetail` by hand.

- [ ] **Step 6: Commit**

```bash
git add src/components/roteiro/EstablishmentModal.tsx src/components/roteiro/EstablishmentModal.test.tsx
git commit -m "feat: add an Adicionar ao roteiro action to the establishment modal"
```

---

## Task 9: Wire suggestion → modal → add-to-itinerary in MapaView

**Files:**
- Modify: `src/components/roteiro/MapaView.tsx`
- Modify: `src/components/roteiro/MapaView.test.tsx`

**Interfaces:**
- Consumes: `EstablishmentModal`, `nearbyPlaceToDetail` from Task 8; `PATCH /api/itineraries/[slug]` `add_place_id` branch from Task 7.

- [ ] **Step 1: Write the failing test**

Add these tests to the end of the `describe("MapaView", ...)` block in `src/components/roteiro/MapaView.test.tsx`:

```tsx
  it("opens the establishment modal when a suggestion marker is clicked", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1", name: "Restaurante X" })];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);
    await waitFor(() => expect(markerInstance.on).toHaveBeenCalledWith("click", expect.any(Function)));

    const clickHandler = markerInstance.on.mock.calls[0][1] as () => void;
    clickHandler();

    expect(await screen.findByRole("dialog", { name: "Restaurante X" })).toBeInTheDocument();
  });

  it("opens the modal when a suggestion card in the sheet is clicked", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1", name: "Restaurante X" })];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);
    await waitFor(() => expect(screen.getByText("Restaurante X")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /restaurante x/i }));

    expect(await screen.findByRole("dialog", { name: "Restaurante X" })).toBeInTheDocument();
  });

  it("adds the suggestion to the itinerary and closes the modal when confirmed", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1", name: "Restaurante X" })];
    const updatedItinerary = {
      id: "1",
      slug: "abc123",
      days: [
        {
          day_number: 1,
          theme: "Dia 1",
          activities: [activity({ place_id: "n1", name: "Restaurante X" })],
        },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedItinerary) });

    render(
      <MapaView slug="abc123" days={[{ day_number: 1, theme: "Dia 1", activities: [] }]} nearby={nearby} />,
    );
    await waitFor(() => expect(screen.getByText("Restaurante X")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /restaurante x/i }));

    const addButton = await screen.findByRole("button", { name: /adicionar ao roteiro/i });
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/itineraries/abc123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ day_number: 1, add_place_id: "n1" }),
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: FAIL — suggestion markers/cards don't open anything yet, no `fetch` call is made.

- [ ] **Step 3: Write minimal implementation**

In `src/components/roteiro/MapaView.tsx`, update the import to pull in the modal helpers:

```ts
import { EstablishmentModal, nearbyPlaceToDetail, type EstablishmentDetail } from "./EstablishmentModal";
```

Replace the `days`/`nearby` prop usage with local state so an added place can update the UI immediately. Replace everything from the function signature down to and including the existing `const [selectedDay, setSelectedDay] = useState(() => firstDayWithCoords(days));` line (added in Task 4 — it stays in the same position, just sourced from `initialDays` now) with:

```ts
export function MapaView({ slug, days: initialDays, nearby: initialNearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const leafletMapRef = useRef<Leaflet.Map | null>(null);
  const stopMarkersRef = useRef<Leaflet.Marker[]>([]);
  const suggestionMarkersRef = useRef<Leaflet.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState(initialDays);
  const [nearby, setNearby] = useState(initialNearby);
  const [detail, setDetail] = useState<EstablishmentDetail | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => firstDayWithCoords(initialDays));
```

The `const [activeCategory, ...]` and `const [sheetOpen, ...]` lines (added in Task 5) come right after in the file and are unaffected — leave them in place.

In the suggestion-markers effect, replace `.bindPopup(place.name);` with a click handler that opens the modal:

```ts
    visibleSuggestions.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
      }).addTo(map);
      marker.on("click", () => setDetail(nearbyPlaceToDetail(place)));
      suggestionMarkersRef.current.push(marker);
    });
```

Add the add-to-itinerary handler, above the `return (`:

```ts
  async function handleAddSuggestion(placeId: string) {
    const response = await fetch(`/api/itineraries/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_number: selectedDay, add_place_id: placeId }),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setDays(updated.days as ItineraryDay[]);
    setNearby((current) => current.filter((p) => p.id !== placeId));
    setDetail(null);
  }
```

Make the sheet cards clickable — replace the suggestion card `<div>` with a `<button>`:

```tsx
              {visibleSuggestions.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setDetail(nearbyPlaceToDetail(place))}
                  className="w-28 shrink-0 rounded-card bg-white/10 p-2 text-left"
                >
                  <p className="truncate text-xs font-bold text-ink">{place.name}</p>
                  <p className="truncate text-[10px] text-ink-dim">{place.category}</p>
                </button>
              ))}
```

Render the modal right before `<BottomNav slug={slug} />`:

```tsx
      <EstablishmentModal
        detail={detail}
        onClose={() => setDetail(null)}
        onAdd={detail ? () => handleAddSuggestion(detail.id) : undefined}
      />

      <BottomNav slug={slug} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/roteiro/MapaView.test.tsx`
Expected: PASS (15 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including `RoteiroView.test.tsx`, `EstablishmentModal.test.tsx`, `route.test.ts`, `nearbyPlaces.test.ts`, `addPlaceActivity.test.ts`, `mapIcons.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/components/roteiro/MapaView.tsx src/components/roteiro/MapaView.test.tsx
git commit -m "feat: let visitors add a suggested place to the itinerary from the map"
```
