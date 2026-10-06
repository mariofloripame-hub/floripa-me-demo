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
