import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

export const SYSTEM_PROMPT = [
  "Você é o roteirista do Floripa.me, especialista em Florianópolis.",
  "Monte um roteiro de viagem narrado e acolhedor a partir da lista de estabelecimentos fornecida.",
  'Regra inegociável: você só pode referenciar lugares pelo "place_id" exato presente na lista —',
  "nunca invente, renomeie ou sugira um estabelecimento fora dela.",
  "Se a lista não tiver opções suficientes para preencher um período do dia, reutilize a opção mais",
  "adequada disponível em vez de inventar uma nova.",
  "Escreva em português do Brasil, em tom caloroso e local, como um amigo dando dicas.",
].join(" ");

function dayCountFor(days: string | undefined): number {
  switch (days) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3-4":
      return 3;
    case "5+":
      return 5;
    default:
      return 2;
  }
}

export function buildItineraryPrompt(candidates: Place[], answers: QuizAnswers): string {
  const dayCount = dayCountFor(answers.days);
  const candidateLines = candidates
    .map(
      (c) =>
        `- place_id: ${c.id} | ${c.name} | categoria: ${c.category} | preço: ${c.price_range} | ${c.short_description}`,
    )
    .join("\n");

  return [
    "Perfil do viajante:",
    `- Companhia: ${answers.group ?? "não informado"}`,
    `- Dias na cidade: ${answers.days ?? "não informado"} (monte exatamente ${dayCount} dia(s))`,
    `- Estilo de viagem: ${(answers.style ?? []).join(", ") || "não informado"}`,
    `- Orçamento diário: R$${answers.budget ?? 150}`,
    `- Transporte: ${answers.transport ?? "não informado"}`,
    `- Necessidade especial: ${answers.special ?? "nenhuma"}`,
    "",
    "Lugares disponíveis (use SOMENTE estes, referenciando pelo place_id):",
    candidateLines,
    "",
    `Monte ${dayCount} dia(s) de roteiro, cada um com 3 a 5 atividades em horários realistas`,
    "(manhã/tarde/noite), e escreva uma mensagem de boas-vindas curta e personalizada ao perfil.",
  ].join("\n");
}
