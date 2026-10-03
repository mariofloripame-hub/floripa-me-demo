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

const STYLE_TIPS: Record<string, Tip> = {
  praia: ATIVIDADE_FISICA,
  negocios: WORK,
};

export function styleTips(style: QuizAnswers["style"]): Tip[] {
  return (style ?? []).flatMap((s) => STYLE_TIPS[s] ?? []);
}
