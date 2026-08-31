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
