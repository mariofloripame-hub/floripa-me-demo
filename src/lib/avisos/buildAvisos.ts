import type { EventRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { filterEventsForTraveler } from "@/lib/events/filterEvents";
import { GENERAL_TIPS } from "./generalTips";
import { seasonTipForMonth } from "./seasonTips";
import { purposeTip } from "./purposeTips";
import { resolveTravelMonth } from "./travelWindow";
import type { Tip } from "./types";

export function buildAvisos(params: { answers: QuizAnswers; events: EventRow[]; now?: Date }): Tip[] {
  const { answers, events, now = new Date() } = params;
  const tips: Tip[] = [...GENERAL_TIPS];

  const month = resolveTravelMonth(answers.when, now);
  if (month !== null) {
    const season = seasonTipForMonth(month);
    if (season) tips.push(season);

    for (const event of filterEventsForTraveler(events, answers, month)) {
      tips.push({
        icon: "🎉",
        label: event.name,
        text: event.notes ? `${event.location} — ${event.notes}` : event.location,
      });
    }
  }

  const purpose = purposeTip(answers.purpose);
  if (purpose) tips.push(purpose);

  return tips;
}
