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
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
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
