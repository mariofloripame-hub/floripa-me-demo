import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

const GROUP_PROFILE_LABEL: Record<string, string> = {
  solo: "Solo",
  casal: "Casal",
  familia: "Família",
  amigos: "Amigos",
};

const STYLE_CATEGORIES: Record<string, string[]> = {
  praia: ["Praia", "Trilha", "Natureza", "Mirante", "Atividade"],
  gastronomia: ["Gastronomia", "Café / Padaria"],
  compras: ["Lazer / Compras"],
  cultura: ["Cultura", "Lazer"],
  noite: ["Bar / Noturno", "Beach Club"],
  negocios: ["Cultura", "Gastronomia"],
};

const PRICE_ORDER = ["Gratuito", "R$", "R$$", "R$$$"];

function allowedPriceRanges(budget: number | undefined): string[] {
  const value = budget ?? 150;
  if (value < 100) return ["Gratuito", "R$"];
  if (value < 250) return ["Gratuito", "R$", "R$$"];
  return PRICE_ORDER;
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
    return profileOk && priceOk && styleOk;
  });
}
