// Activities typed in by the visitor ("+ Adicionar programação") have no real
// place behind them, so the card can't show a photo. Instead we guess a
// category from the words they typed and show that category's icon — the
// same one used for map pins — and use it to pick swap suggestions.

// Checked in order: the first rule with a matching keyword wins, so more
// specific intents ("almoço na praia" is a meal, not a beach) come first.
const KEYWORD_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "Beach Club", keywords: ["beach club"] },
  { category: "Café / Padaria", keywords: ["cafe", "cafezinho", "padaria", "brunch", "sorvete", "doceria"] },
  {
    category: "Gastronomia",
    keywords: [
      "jantar", "janta", "almoco", "almocar", "restaurante", "comer", "comida", "pizza", "pizzaria",
      "sushi", "churrasco", "ostra", "ostras", "frutos do mar", "lanche", "hamburguer", "rodizio",
    ],
  },
  {
    category: "Bar / Noturno",
    keywords: ["bar", "balada", "boate", "festa", "show", "pub", "chopp", "cerveja", "drink", "drinks", "happy hour"],
  },
  { category: "Mirante", keywords: ["mirante", "por do sol", "vista"] },
  { category: "Trilha", keywords: ["trilha", "caminhada", "hiking"] },
  { category: "Esporte", keywords: ["surf", "kite", "kitesurf", "sup", "stand up", "mergulho", "remo", "esporte"] },
  { category: "Passeio", keywords: ["passeio", "barco", "lancha", "escuna", "tour"] },
  { category: "Cultura", keywords: ["museu", "igreja", "historia", "historico", "teatro", "arte", "feira", "mercado"] },
  { category: "Natureza", keywords: ["parque", "lagoa", "cachoeira", "dunas", "natureza"] },
  { category: "Praia", keywords: ["praia", "mar", "banho de mar"] },
];

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

export function guessCategory(name: string): string | null {
  const text = normalize(name);
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => text.includes(` ${keyword} `))) return rule.category;
  }
  return null;
}

export function isCustomActivity(act: { place_id: string }): boolean {
  return act.place_id.startsWith("custom-");
}
