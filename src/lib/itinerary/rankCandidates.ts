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
