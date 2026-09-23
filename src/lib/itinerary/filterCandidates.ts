import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

const GROUP_PROFILE_LABEL: Record<string, string> = {
  solo: "Solo",
  casal: "Casal",
  familia: "Família",
  amigos: "Amigos",
};

export const STYLE_CATEGORIES: Record<string, string[]> = {
  praia: ["Praia", "Trilha", "Natureza", "Mirante", "Atividade", "Esporte", "Passeio"],
  gastronomia: ["Gastronomia", "Café / Padaria"],
  compras: ["Atividade", "Passeio"],
  cultura: ["Cultura", "Passeio"],
  noite: ["Bar / Noturno", "Beach Club"],
};

const PRICE_ORDER = ["Gratuito", "R$", "R$$", "R$$$"];

function allowedPriceRanges(budget: QuizAnswers["budget"]): string[] {
  if (budget === "economico") return ["Gratuito", "R$"];
  if (budget === "alto") return PRICE_ORDER;
  return ["Gratuito", "R$", "R$$"]; // "medio" and unanswered/legacy values both fall back here
}

export function filterCandidates(places: Place[], answers: QuizAnswers): Place[] {
  const profileLabel = answers.group ? GROUP_PROFILE_LABEL[answers.group] : undefined;
  const allowedPrices = allowedPriceRanges(answers.budget);
  const styleCategories = new Set((answers.style ?? []).flatMap((s) => STYLE_CATEGORIES[s] ?? []));

  return places.filter((place) => {
    const profileOk =
      !profileLabel || place.target_profiles.includes("Todos") || place.target_profiles.includes(profileLabel);
    const priceOk = allowedPrices.includes(place.price_range);
    const styleOk = styleCategories.size === 0 || styleCategories.has(place.category);
    return place.is_verified && profileOk && priceOk && styleOk;
  });
}
