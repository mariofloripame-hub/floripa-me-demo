// Anonymous, partner-facing description of a tourist's quiz answers.
export const GROUP_OPTIONS = [
  { value: "casal", label: "Casal", emoji: "💑" },
  { value: "familia", label: "Família", emoji: "👨‍👩‍👧" },
  { value: "amigos", label: "Amigos", emoji: "🎉" },
  { value: "solo", label: "Solo", emoji: "🙋" },
] as const;

const DAYS_LABEL: Record<string, string> = { "1": "1 dia", "2": "2 dias", "3-4": "3 a 4 dias", "5+": "5+ dias" };

const STYLE_LABEL: Record<string, string> = {
  praia: "Praia",
  gastronomia: "Gastronomia",
  compras: "Compras",
  cultura: "Cultura",
  noite: "Balada",
};

const MAX_STYLES = 2;

export function roteiroSummary(answers: Record<string, unknown>): string {
  const group = GROUP_OPTIONS.find((g) => g.value === answers.group)?.label;
  const days = typeof answers.days === "string" ? DAYS_LABEL[answers.days] : undefined;
  const styles = Array.isArray(answers.style)
    ? answers.style
        .map((s) => (typeof s === "string" ? STYLE_LABEL[s] : undefined))
        .filter((s): s is string => Boolean(s))
        .slice(0, MAX_STYLES)
        .join(" & ")
    : "";
  const parts = [group, days, styles].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : "Roteiro";
}
