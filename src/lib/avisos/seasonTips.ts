import type { Tip } from "./types";

const ALTA_TEMPORADA: Tip = {
  icon: "☀️",
  label: "Alta temporada",
  text: "praias mais cheias, trânsito mais intenso e preços de hospedagem mais altos — reserve passeios e restaurantes com antecedência.",
};

const ENTRESSAFRA: Tip = {
  icon: "🍂",
  label: "Entressafra",
  text: "cidade mais tranquila e o verão ainda não lotou as praias — bom momento pra economizar em hospedagem, mas alguns bares sazonais podem estar fechados.",
};

const INVERNO: Tip = {
  icon: "🧥",
  label: "Inverno",
  text: "mar mais frio e dias mais curtos — é a temporada da tainha (ressaca), ótimo clima pra trilhas, mas leve um casaco pra noite.",
};

// index 0 unused, 1-12 = Jan-Dez
const SEASON_BY_MONTH: (Tip | undefined)[] = [
  undefined,
  ALTA_TEMPORADA, // Jan
  ALTA_TEMPORADA, // Fev
  ALTA_TEMPORADA, // Mar
  ENTRESSAFRA, // Abr
  ENTRESSAFRA, // Mai
  INVERNO, // Jun
  INVERNO, // Jul
  INVERNO, // Ago
  ENTRESSAFRA, // Set
  ENTRESSAFRA, // Out
  ENTRESSAFRA, // Nov
  ALTA_TEMPORADA, // Dez
];

export function seasonTipForMonth(month: number): Tip | null {
  return SEASON_BY_MONTH[month] ?? null;
}
