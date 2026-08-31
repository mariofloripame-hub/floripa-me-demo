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
