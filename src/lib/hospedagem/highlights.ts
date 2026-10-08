export const MAX_CARD_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHT_LENGTH = 30;

// Curated highlights the admin can tick for a lodging (as many as apply).
export const HIGHLIGHT_OPTIONS = [
  "🌊 Vista para o mar",
  "🏖️ Pé na areia",
  "☕ Café da manhã incluso",
  "🏊 Piscina",
  "💑 Ideal para casais",
  "👨‍👩‍👧 Ideal para famílias",
  "🐾 Pet friendly",
  "🍽️ Restaurante no local",
  "💆 Spa",
  "🅿️ Estacionamento",
] as const;

const OPTION_INDEX = new Map<string, number>(HIGHLIGHT_OPTIONS.map((option, index) => [option, index]));

// What most sells a stay, in this order, before the rest of the list.
const TOP_HIGHLIGHTS = ["🌊 Vista para o mar", "☕ Café da manhã incluso"];

const PROFILE_HIGHLIGHT: Record<string, string> = {
  casal: "💑 Ideal para casais",
  familia: "👨‍👩‍👧 Ideal para famílias",
};

// Only curated options survive (older free text is dropped), in list order.
export function orderHighlights(selected: string[]): string[] {
  const known = [...new Set(selected.map((item) => item.trim()))].filter((item) => OPTION_INDEX.has(item));
  return known.sort((a, b) => OPTION_INDEX.get(a)! - OPTION_INDEX.get(b)!);
}

// The few highlights shown over the card photo: sea view, breakfast, the
// tourist's own profile (from the quiz group), then the rest of the list.
export function cardHighlights(highlights: string[], group: string | undefined): string[] {
  const ordered = orderHighlights(highlights);
  const priority = [...TOP_HIGHLIGHTS, ...(group && PROFILE_HIGHLIGHT[group] ? [PROFILE_HIGHLIGHT[group]] : [])];
  const first = priority.filter((item) => ordered.includes(item));
  const rest = ordered.filter((item) => !first.includes(item));
  return [...first, ...rest].slice(0, MAX_CARD_HIGHLIGHTS);
}
