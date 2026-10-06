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

export function isBetween(iso: string, from: Date, to: Date | null): boolean {
  const time = new Date(iso).getTime();
  return time >= from.getTime() && (to === null || time < to.getTime());
}

export function perDayThisMonth(isoDates: string[], now: Date): DayCount[] {
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

export function byNewest<T>(items: T[], date: (item: T) => string): T[] {
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
