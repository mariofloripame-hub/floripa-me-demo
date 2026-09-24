import type { EventRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { filterEventsForTraveler } from "@/lib/events/filterEvents";
import { GENERAL_TIPS } from "./generalTips";
import { seasonTipForMonth } from "./seasonTips";
import { purposeTip } from "./purposeTips";
import { resolveTravelMonth } from "./travelWindow";
import type { Tip } from "./types";

const MAX_EVENT_TIPS = 3;

export function buildAvisos(params: { answers: QuizAnswers; events: EventRow[]; now?: Date }): Tip[] {
  const { answers, events, now = new Date() } = params;
  const personalizedTips: Tip[] = [];

  const month = resolveTravelMonth(answers.when, now);
  if (month !== null) {
    const season = seasonTipForMonth(month);
    if (season) personalizedTips.push(season);

    for (const event of filterEventsForTraveler(events, answers, month).slice(0, MAX_EVENT_TIPS)) {
      personalizedTips.push({
        icon: "🎉",
        label: event.name,
        text: event.notes ? `${event.location} — ${event.notes}` : event.location,
      });
    }
  }

  const purpose = purposeTip(answers.purpose);
  if (purpose) personalizedTips.push(purpose);

  // Personalized tips come first so the collapsed Avisos card (which shows only the
  // first tip) leads with something the traveler's own answers produced, not a
  // generic tip that's identical for every visitor.
  return [...personalizedTips, ...GENERAL_TIPS];
}
