import type { Tip } from "./types";
import type { QuizAnswers } from "@/lib/quiz/types";

const WORK: Tip = {
  icon: "💼",
  label: "Trabalho",
  text: "vários cafés e coworkings da ilha têm wifi rápido e boa estrutura pra quem vai trabalhar remoto durante a viagem.",
};

const ATIVIDADE_FISICA: Tip = {
  icon: "🏃",
  label: "Atividade física",
  text: "Floripa tem trilhas conhecidas (Lagoinha do Leste, Morro das Aranhas) e pontos de treino na orla — bom terreno pra quem vem treinar ou competir.",
};

const PURPOSE_TIPS: Partial<Record<NonNullable<QuizAnswers["purpose"]>, Tip>> = {
  negocios: WORK,
  estudo_congresso: WORK,
  atividade_fisica: ATIVIDADE_FISICA,
};

export function purposeTip(purpose: QuizAnswers["purpose"]): Tip | null {
  if (!purpose) return null;
  return PURPOSE_TIPS[purpose] ?? null;
}
