export const MAX_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHT_LENGTH = 30;

// Curated highlights the admin ticks for a lodging (up to 3). The card shows
// them in this order, so put the most persuasive ones first.
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

// Listed options first (in list order), then any older free-text highlight.
export function orderHighlights(selected: string[]): string[] {
  const unique = [...new Set(selected.map((item) => item.trim()).filter(Boolean))];
  const rank = (item: string) => OPTION_INDEX.get(item) ?? HIGHLIGHT_OPTIONS.length;
  return unique.sort((a, b) => rank(a) - rank(b));
}

// What the admin can tick: the curated list plus saved highlights that predate it.
export function highlightChoices(saved: string[]): string[] {
  return [...HIGHLIGHT_OPTIONS, ...saved.filter((item) => !OPTION_INDEX.has(item))];
}
