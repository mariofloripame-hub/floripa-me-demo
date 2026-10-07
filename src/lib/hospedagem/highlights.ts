export const MAX_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHT_LENGTH = 30;

// The admin types highlights as one comma-separated line ("🌊 Vista para o mar, ☕ Café da manhã").
export function parseHighlights(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function highlightsError(raw: string): string | null {
  const items = parseHighlights(raw);
  if (items.length > MAX_HIGHLIGHTS) return `Use no máximo ${MAX_HIGHLIGHTS} destaques`;
  // Counted in characters, so an emoji counts as one.
  if (items.some((item) => Array.from(item).length > MAX_HIGHLIGHT_LENGTH)) {
    return `Cada destaque pode ter até ${MAX_HIGHLIGHT_LENGTH} caracteres`;
  }
  return null;
}
