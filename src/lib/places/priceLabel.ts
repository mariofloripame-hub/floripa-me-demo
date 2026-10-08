// The database keeps the original price codes; visitors see the same budget
// words the quiz uses (Econômico / Médio / Alto).
const PRICE_LABELS: Record<string, { label: string; emoji: string }> = {
  Gratuito: { label: "Grátis", emoji: "🎟️" },
  "R$": { label: "Econômico", emoji: "💰" },
  "R$$": { label: "Médio", emoji: "💵" },
  "R$$$": { label: "Alto", emoji: "💎" },
};

export function priceLabel(priceRange: string): string {
  return PRICE_LABELS[priceRange]?.label ?? priceRange;
}

export function priceBadge(priceRange: string): string {
  const entry = PRICE_LABELS[priceRange];
  return entry ? `${entry.emoji} ${entry.label}` : priceRange;
}
