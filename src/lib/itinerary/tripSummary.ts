const REGION_LABEL: Record<string, string> = {
  centro: "Centro / Continente",
  norte: "Norte da Ilha",
  leste: "Leste da Ilha",
  sul: "Sul da Ilha",
  semhospedagem: "Sem hospedagem",
};

const GROUP_LABEL: Record<string, string> = {
  solo: "Sozinho(a)",
  casal: "Casal",
  familia: "Em família",
  amigos: "Com amigos",
};

const BUDGET_LABEL: Record<string, string> = {
  economico: "Econômico",
  medio: "Médio",
  alto: "Alto",
};

const DAYS_LABEL: Record<string, string> = {
  "1": "1 dia",
  "2": "2 dias",
  "3-4": "3 a 4 dias",
  "5+": "5+ dias",
};

const GROUP_TITLE: Record<string, string> = {
  solo: "Floripa na sua",
  casal: "Floripa a dois",
  familia: "Floripa em família",
  amigos: "Floripa com amigos",
};

export interface TripChip {
  icon: string;
  label: string;
}

export function getTripTitle(answers: Record<string, unknown>): string {
  const title = typeof answers.group === "string" ? GROUP_TITLE[answers.group] : undefined;
  return title ?? "Seu roteiro em Floripa";
}

export function getTripChips(answers: Record<string, unknown>): TripChip[] {
  const chips: TripChip[] = [];

  if (typeof answers.region === "string" && REGION_LABEL[answers.region]) {
    chips.push({ icon: "🏨", label: REGION_LABEL[answers.region] });
  }
  if (typeof answers.group === "string" && GROUP_LABEL[answers.group]) {
    chips.push({ icon: "👥", label: GROUP_LABEL[answers.group] });
  }
  if (typeof answers.budget === "string" && BUDGET_LABEL[answers.budget]) {
    chips.push({ icon: "💰", label: BUDGET_LABEL[answers.budget] });
  }
  if (typeof answers.days === "string" && DAYS_LABEL[answers.days]) {
    chips.push({ icon: "📅", label: DAYS_LABEL[answers.days] });
  }

  return chips;
}
