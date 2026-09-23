import type { QuizAnswers } from "@/lib/quiz/types";

export function resolveTravelMonth(when: QuizAnswers["when"], now: Date = new Date()): number | null {
  switch (when) {
    case "chegou":
    case "proximos_7_dias":
      return now.getMonth() + 1;
    case "2_a_4_semanas": {
      const future = new Date(now);
      future.setDate(future.getDate() + 21);
      return future.getMonth() + 1;
    }
    default:
      return null;
  }
}
