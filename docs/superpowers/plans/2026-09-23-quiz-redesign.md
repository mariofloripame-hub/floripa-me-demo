# Redesenho do quiz: motivo da viagem, janela de tempo e avisos personalizados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the quiz's dead-weight `timing` question with two useful ones (`purpose`, `when`),
simplify `budget` to 3 fixed options, drop the unused "Negócios" style category, and turn the
static "Aviso importante" card into a personalized Avisos block driven by quiz answers and the
existing seasonal-events system.

**Architecture:** All quiz question data lives in one file (`questions.ts`) rendered generically by
an existing data-driven `QuestionCard` — no component changes needed there. A new `src/lib/avisos/`
module holds small, independently-testable pure functions (date-window resolution, static tip
dictionaries, an orchestrator) that combine into a flat list of `Tip` objects. The server page
component fetches events, calls the orchestrator once, and passes the resulting list down as a
prop — same pattern already used for `partners`.

**Tech Stack:** Next.js (App Router), TypeScript, Vitest + Testing Library, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-23-quiz-redesign-design.md`

## Global Constraints

- No new dependencies — everything here is plain TypeScript/React using what's already installed.
- Avisos content (season/purpose tips) is static, in-code dictionaries — no database writes, no new
  tables, consistent with how other demo/personalization content in this app is done.
- All copy is Brazilian Portuguese, matching the existing quiz/roteiro tone.
- `days` and `transport` questions keep their exact current ids, options, and behavior — this plan
  must not change them.
- Tests use Vitest (`npm test -- <path>`) and follow each file's existing fixture style (a small
  `place(...)`/`event(...)` builder function with overrides) rather than repeating full objects.
- Run `npm test -- <path>` after every implementation step to confirm the specific test(s) pass, and
  a full `npm test` + `npm run build` at the end of the plan (Task 10).

## Review Focus

- **Old itineraries created before this change** have `quiz_answers` with a legacy `timing` field
  and a numeric `budget` (e.g. `150`) instead of the new string enum. Rendering one of these must
  not crash `tripSummary`/`buildAvisos` — the fields that no longer parse should just be silently
  skipped, not throw. (Task 4, Task 7)
- **An unrecognized `when` value** (not one of the 5 valid options — e.g. old/garbage data hitting
  the API directly) must resolve to "no reference month" rather than crashing or silently picking a
  wrong season. (Task 6)
- **Date-boundary wraparound for "2 a 4 semanas"**: when today is near year-end (e.g. Dec 20), "hoje
  + 21 dias" must resolve into January of the *following* year, not throw or produce month `13`.
  (Task 6)
- **`purpose` left unanswered** (`undefined`, since it's a required-but-possibly-missing field on
  old data) must produce no purpose tip, not throw when looked up in the tips dictionary. (Task 5)
- **An empty resulting `tips` list** (a defensive/edge case, since in normal operation the 4 general
  tips are always present) must not render a broken/empty "Aviso importante" card — the card should
  simply not render. (Task 8)

---

## File Structure

New:
- `src/lib/avisos/types.ts` — shared `Tip` interface.
- `src/lib/avisos/generalTips.ts` — the 4 always-on tips (moved out of `RoteiroView.tsx`).
- `src/lib/avisos/seasonTips.ts` — season-of-year tip lookup by month.
- `src/lib/avisos/purposeTips.ts` — tip lookup by `purpose` answer.
- `src/lib/avisos/travelWindow.ts` — resolves a reference month (or `null`) from the `when` answer.
- `src/lib/avisos/buildAvisos.ts` — orchestrator combining all of the above + seasonal events into
  one flat `Tip[]`.
- One `*.test.ts` per file above.

Modified:
- `src/lib/quiz/types.ts` — `QuizAnswers` shape.
- `src/lib/quiz/questions.ts` + `questions.test.ts` — new `purpose`/`when` questions, `budget`
  becomes 3 buttons, `style` loses the "Negócios" option.
- `src/lib/itinerary/filterCandidates.ts` + `.test.ts` — `allowedPriceRanges` keyed by the new
  budget enum; `STYLE_CATEGORIES` loses `negocios`.
- `src/lib/itinerary/prompt.ts` + `.test.ts` — drop `timing`/`TIMING_LABEL`.
- `src/lib/itinerary/tripSummary.ts` + `.test.ts` — drop the `timing` chip, budget chip reads the
  new enum.
- `src/components/roteiro/RoteiroView.tsx` + `.test.tsx` — `ImportantNotice` becomes prop-driven.
- `src/app/roteiro/[slug]/page.tsx` — fetch events, call `buildAvisos`, pass `tips` down.

---

### Task 1: Quiz data model and questions

**Files:**
- Modify: `src/lib/quiz/types.ts`
- Modify: `src/lib/quiz/questions.ts`
- Test: `src/lib/quiz/questions.test.ts`

**Interfaces:**
- Produces: `QuizAnswers` with fields `purpose?: "passeio" | "negocios" | "estudo_congresso" |
  "atividade_fisica" | "familia_amigos"`, `when?: "chegou" | "proximos_7_dias" | "2_a_4_semanas" |
  "mais_de_um_mes" | "planejando"`, `region?: string`, `days?: string`, `group?: string`,
  `style?: string[]`, `transport?: string`, `budget?: "economico" | "medio" | "alto"`,
  `special?: string`. (`timing` is gone.) Every later task that touches `QuizAnswers` relies on
  these exact field names and literal unions.
- Produces: `QUESTIONS` array (unchanged export name) in order `purpose, when, region, days, group,
  style, transport, budget, special`.

- [ ] **Step 1: Write the failing tests**

Replace the whole file `src/lib/quiz/questions.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { QUESTIONS } from "./questions";

describe("QUESTIONS", () => {
  it("has exactly 9 questions in the documented order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "purpose", "when", "region", "days", "group", "style", "transport", "budget", "special",
    ]);
  });

  it("marks region and special as optional, and the rest as required", () => {
    const optional = QUESTIONS.filter((q) => q.optional).map((q) => q.id);
    expect(optional).toEqual(["region", "special"]);
  });

  it("marks style as the only multi-select question", () => {
    const multi = QUESTIONS.filter((q) => q.type !== "slider" && q.multi).map((q) => q.id);
    expect(multi).toEqual(["style"]);
  });

  it("has no slider question anymore", () => {
    expect(QUESTIONS.some((q) => q.type === "slider")).toBe(false);
  });

  it("offers exactly 3 budget options: economico, medio, alto", () => {
    const budget = QUESTIONS.find((q) => q.id === "budget");
    if (budget?.type === "slider") throw new Error("budget must not be a slider question");
    expect(budget?.options.map((o) => o.value)).toEqual(["economico", "medio", "alto"]);
  });

  it("offers 5 purpose options including familia_amigos", () => {
    const purpose = QUESTIONS.find((q) => q.id === "purpose");
    if (purpose?.type === "slider") throw new Error("purpose must not be a slider question");
    expect(purpose?.options.map((o) => o.value)).toEqual([
      "passeio", "negocios", "estudo_congresso", "atividade_fisica", "familia_amigos",
    ]);
  });

  it("offers 5 when options for the travel window", () => {
    const when = QUESTIONS.find((q) => q.id === "when");
    if (when?.type === "slider") throw new Error("when must not be a slider question");
    expect(when?.options.map((o) => o.value)).toEqual([
      "chegou", "proximos_7_dias", "2_a_4_semanas", "mais_de_um_mes", "planejando",
    ]);
  });

  it("no longer offers 'negocios' as a style option (purpose covers that signal now)", () => {
    const style = QUESTIONS.find((q) => q.id === "style");
    if (style?.type === "slider") throw new Error("style must not be a slider question");
    expect(style?.options.map((o) => o.value)).not.toContain("negocios");
  });

  it("keeps days and transport exactly as before", () => {
    const days = QUESTIONS.find((q) => q.id === "days");
    if (days?.type === "slider") throw new Error("days must not be a slider question");
    expect(days?.options.map((o) => o.value)).toEqual(["1", "2", "3-4", "5+"]);

    const transport = QUESTIONS.find((q) => q.id === "transport");
    if (transport?.type === "slider") throw new Error("transport must not be a slider question");
    expect(transport?.options.map((o) => o.value)).toEqual(["carro", "app", "onibus", "pe"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/quiz/questions.test.ts`
Expected: FAIL — `QUESTIONS` still has the old 8-question shape (`timing` as the first id, `budget`
as a slider, etc).

- [ ] **Step 3: Update `QuizAnswers` in `src/lib/quiz/types.ts`**

Replace the `QuizAnswers` interface at the bottom of the file with:

```ts
export interface QuizAnswers {
  purpose?: "passeio" | "negocios" | "estudo_congresso" | "atividade_fisica" | "familia_amigos";
  when?: "chegou" | "proximos_7_dias" | "2_a_4_semanas" | "mais_de_um_mes" | "planejando";
  region?: string;
  days?: string;
  group?: string;
  style?: string[];
  transport?: string;
  budget?: "economico" | "medio" | "alto";
  special?: string;
}
```

- [ ] **Step 4: Rewrite `QUESTIONS` in `src/lib/quiz/questions.ts`**

Replace the whole file's content (keep the `import type { QuizQuestion } from "./types";` line at
the top) with:

```ts
import type { QuizQuestion } from "./types";

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "purpose",
    text: "Qual o motivo da sua viagem a Florianópolis?",
    sub: "Isso nos ajuda a te mostrar dicas mais relevantes pra sua viagem.",
    type: "rows",
    options: [
      { emoji: "🏖️", label: "Passeio / Turismo", desc: "Viagem de lazer", value: "passeio" },
      { emoji: "💼", label: "Negócios", desc: "Trabalho na cidade", value: "negocios" },
      { emoji: "🎓", label: "Estudo ou Congresso", desc: "Evento, curso ou faculdade", value: "estudo_congresso" },
      { emoji: "🏃", label: "Atividade Física/Competição", desc: "Treino, prova ou trilha", value: "atividade_fisica" },
      { emoji: "👨‍👩‍👧", label: "Visitar Família/Amigos", desc: "Reencontro por aqui", value: "familia_amigos" },
    ],
  },
  {
    id: "when",
    text: "Quando você vem para Florianópolis?",
    sub: "Assim conseguimos te avisar sobre eventos e a época da sua viagem.",
    type: "rows",
    options: [
      { emoji: "📍", label: "Já estou em Floripa", desc: "Quero o roteiro agora!", value: "chegou" },
      { emoji: "🗓️", label: "Nos próximos 7 dias", desc: "Viagem é essa semana", value: "proximos_7_dias" },
      { emoji: "📆", label: "Entre 2 e 4 semanas", desc: "Ainda tenho um tempinho", value: "2_a_4_semanas" },
      { emoji: "🔭", label: "Daqui a mais de um mês", desc: "Planejando com calma", value: "mais_de_um_mes" },
      { emoji: "🤔", label: "Ainda estou planejando", desc: "Sem data definida", value: "planejando" },
    ],
  },
  {
    id: "region",
    text: "Onde você vai se hospedar?",
    sub: "Isso nos ajuda a montar um roteiro logisticamente inteligente para você.",
    type: "rows",
    optional: true,
    options: [
      { emoji: "🏛️", label: "Centro / Continente", desc: "Próximo ao centro histórico", value: "centro" },
      { emoji: "🌴", label: "Norte da Ilha", desc: "Jurerê, Ingleses, Canasvieiras", value: "norte" },
      { emoji: "🌊", label: "Leste da Ilha", desc: "Lagoa da Conceição, Barra da Lagoa", value: "leste" },
      { emoji: "🌿", label: "Sul da Ilha", desc: "Campeche, Armação, Pântano do Sul", value: "sul" },
      { emoji: "🔍", label: "Ainda não tenho hospedagem", desc: "Me indica uma pousada parceira!", value: "semhospedagem" },
      { emoji: "🤷", label: "Prefiro não informar", desc: "Seguir com roteiro geral", value: "nao" },
    ],
  },
  {
    id: "days",
    text: "Quantos dias você vai ficar em Floripa?",
    sub: "Vamos montar o roteiro certinho para o seu tempo.",
    type: "grid2",
    options: [
      { emoji: "⚡", label: "1 dia", desc: "Só um dia, mas intenso", value: "1" },
      { emoji: "🌅", label: "2 dias", desc: "Um fim de semana perfeito", value: "2" },
      { emoji: "🏝️", label: "3 a 4 dias", desc: "Tempo bom para explorar", value: "3-4" },
      { emoji: "✈️", label: "5 dias ou mais", desc: "Mergulho completo na ilha", value: "5+" },
    ],
  },
  {
    id: "group",
    text: "Como você está viajando?",
    sub: "O roteiro muda bastante dependendo da companhia.",
    type: "grid2",
    options: [
      { emoji: "🙋", label: "Solo", desc: "Na minha", value: "solo" },
      { emoji: "💑", label: "Casal", desc: "A dois", value: "casal" },
      { emoji: "👨‍👩‍👧", label: "Família", desc: "Com crianças", value: "familia" },
      { emoji: "🎉", label: "Amigos", desc: "Em grupo", value: "amigos" },
    ],
  },
  {
    id: "style",
    text: "Qual é o seu estilo de viagem?",
    sub: "Pode escolher mais de um! Escolha tudo que combina com você.",
    type: "grid2",
    multi: true,
    options: [
      { emoji: "🏄", label: "Praia, Surf & Aventura", desc: "Mar, trilhas e natureza", value: "praia" },
      { emoji: "🍽️", label: "Gastronomia", desc: "Comer bem é obrigação", value: "gastronomia" },
      { emoji: "🛍️", label: "Compras", desc: "Shoppings, feiras e lojas", value: "compras" },
      { emoji: "🏛️", label: "Lazer & Cultura", desc: "História, arte e passeios", value: "cultura" },
      { emoji: "🌙", label: "Balada & Bares", desc: "A noite é jovem", value: "noite" },
    ],
  },
  {
    id: "transport",
    text: "Como você vai se locomover?",
    sub: "Isso afeta muito o seu roteiro.",
    type: "rows",
    options: [
      { emoji: "🚗", label: "Tenho carro / moto", desc: "Liberdade total para explorar", value: "carro" },
      { emoji: "📱", label: "Uber / 99", desc: "Prático e sem preocupação", value: "app" },
      { emoji: "🚌", label: "Ônibus / transporte público", desc: "Econômico e sustentável", value: "onibus" },
      { emoji: "🚶", label: "A pé e aluguel eventual", desc: "Curto, exploro devagar", value: "pe" },
    ],
  },
  {
    id: "budget",
    text: "Qual o seu orçamento?",
    sub: "Isso ajuda a sugerir lugares dentro do seu perfil de gasto.",
    type: "rows",
    options: [
      { emoji: "💰", label: "Econômico", desc: "Rolê redondo sem gastar muito", value: "economico" },
      { emoji: "💵", label: "Médio", desc: "Equilíbrio entre custo e conforto", value: "medio" },
      { emoji: "💎", label: "Alto", desc: "Conforto e experiências em primeiro lugar", value: "alto" },
    ],
  },
  {
    id: "special",
    text: "Alguma necessidade especial?",
    sub: "Opcional — mas ajuda a personalizar melhor.",
    type: "rows",
    optional: true,
    options: [
      { emoji: "🦽", label: "Acessibilidade", desc: "Mobilidade reduzida no grupo", value: "acessibilidade" },
      { emoji: "🌱", label: "Vegetariano / vegano", desc: "Preciso de opções plant-based", value: "vegano" },
      { emoji: "👶", label: "Crianças pequenas", desc: "Bebê ou criança até 5 anos", value: "bebe" },
      { emoji: "🐾", label: "Pet friendly", desc: "Viajando com o bichinho", value: "pet" },
      { emoji: "✌️", label: "Nenhuma", desc: "Pode mandar o roteiro normal", value: "nenhuma" },
    ],
  },
];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/quiz/questions.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/quiz/types.ts src/lib/quiz/questions.ts src/lib/quiz/questions.test.ts
git commit -m "feat(quiz): replace timing with purpose/when, simplify budget to 3 options"
```

---

### Task 2: `filterCandidates` — budget enum + drop "negocios" style

**Files:**
- Modify: `src/lib/itinerary/filterCandidates.ts`
- Test: `src/lib/itinerary/filterCandidates.test.ts`

**Interfaces:**
- Consumes: `QuizAnswers.budget` as `"economico" | "medio" | "alto" | undefined` (Task 1).
- Produces: `filterCandidates(places: Place[], answers: QuizAnswers): Place[]` — same signature and
  export as today; only the budget matching and the `STYLE_CATEGORIES` map change.

- [ ] **Step 1: Write the failing tests**

In `src/lib/itinerary/filterCandidates.test.ts`, replace the two budget tests with:

```ts
  it("excludes places above the allowed price range for an 'economico' budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: "economico" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("allows all price ranges for an 'alto' budget", () => {
    const places = [place({ id: "a", price_range: "Gratuito" }), place({ id: "b", price_range: "R$$$" })];
    const result = filterCandidates(places, { budget: "alto" });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("allows up to R$$ for a 'medio' budget", () => {
    const places = [
      place({ id: "a", price_range: "R$$" }),
      place({ id: "b", price_range: "R$$$" }),
    ];
    const result = filterCandidates(places, { budget: "medio" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("defaults to the 'medio' price range when no budget was answered", () => {
    const places = [
      place({ id: "a", price_range: "R$$" }),
      place({ id: "b", price_range: "R$$$" }),
    ];
    const result = filterCandidates(places, {});
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
```

Also update the last combined-filters test to use the enum:

```ts
  it("combines profile, price, and style filters", () => {
    const places = [
      place({ id: "match", target_profiles: ["Casal"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-profile", target_profiles: ["Família"], price_range: "R$", category: "Gastronomia" }),
      place({ id: "wrong-category", target_profiles: ["Casal"], price_range: "R$", category: "Bar / Noturno" }),
    ];
    const result = filterCandidates(places, { group: "casal", budget: "medio", style: ["gastronomia"] });
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });
```

And add a regression test guarding the "negocios" removal, next to the existing "no longer
references invented category names" test:

```ts
  it("no longer has a 'negocios' entry in STYLE_CATEGORIES", () => {
    expect(STYLE_CATEGORIES.negocios).toBeUndefined();
  });
```

(this needs `STYLE_CATEGORIES` imported alongside `filterCandidates` at the top of the test file —
change `import { filterCandidates } from "./filterCandidates";` to
`import { filterCandidates, STYLE_CATEGORIES } from "./filterCandidates";`)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/itinerary/filterCandidates.test.ts`
Expected: FAIL — `allowedPriceRanges` still expects a `number`, and `STYLE_CATEGORIES.negocios`
still exists.

- [ ] **Step 3: Implement**

In `src/lib/itinerary/filterCandidates.ts`:

```ts
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
```

(the `filterCandidates` function body below it is unchanged — it already just calls
`allowedPriceRanges(answers.budget)`)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/itinerary/filterCandidates.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/filterCandidates.ts src/lib/itinerary/filterCandidates.test.ts
git commit -m "feat(itinerary): key price filtering off the new budget enum, drop negocios style"
```

---

### Task 3: `prompt.ts` — drop `timing`

**Files:**
- Modify: `src/lib/itinerary/prompt.ts`
- Test: `src/lib/itinerary/prompt.test.ts`

**Interfaces:**
- Consumes: `QuizAnswers` (Task 1) — no longer reads `.timing`.
- Produces: `buildItineraryPrompt(candidates: Place[], answers: QuizAnswers): string` — same
  signature; the "Chegada: ..." line is removed from the output. `days`/`region` behavior is
  unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/lib/itinerary/prompt.test.ts`, replace this test:

```ts
  it("includes readable timing and region labels when informed", () => {
    const prompt = buildItineraryPrompt([place({})], { timing: "aviao", region: "leste" });
    expect(prompt).toContain("chegando de avião");
    expect(prompt).toContain("Leste da Ilha");
  });
```

with:

```ts
  it("includes a readable region label when informed", () => {
    const prompt = buildItineraryPrompt([place({})], { region: "leste" });
    expect(prompt).toContain("Leste da Ilha");
  });

  it("no longer mentions arrival/chegada — the prompt doesn't use the timing answer anymore", () => {
    const prompt = buildItineraryPrompt([place({})], { region: "leste" });
    expect(prompt).not.toMatch(/chegada/i);
  });
```

And replace this test:

```ts
  it("falls back to a sensible default when timing/region are absent or 'não informar'", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt).toContain("- Chegada: não informado");
    expect(prompt).toContain("- Região de hospedagem: não informado");

    const promptWithNao = buildItineraryPrompt([place({})], { region: "nao" });
    expect(promptWithNao).toContain("- Região de hospedagem: não informado");
  });
```

with:

```ts
  it("falls back to a sensible default when region is absent or 'não informar'", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt).toContain("- Região de hospedagem: não informado");

    const promptWithNao = buildItineraryPrompt([place({})], { region: "nao" });
    expect(promptWithNao).toContain("- Região de hospedagem: não informado");
  });
```

Also add a new test guarding the budget line format, since `answers.budget` changed from a number to
an enum string and the old `R$${budget}` interpolation would now read nonsensically ("R$medio"):

```ts
  it("describes budget as a tier label, not a currency amount", () => {
    const prompt = buildItineraryPrompt([place({})], { budget: "medio" });
    expect(prompt).toContain("- Orçamento: medio");
    expect(prompt).not.toContain("R$medio");

    const promptWithout = buildItineraryPrompt([place({})], {});
    expect(promptWithout).toContain("- Orçamento: não informado");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/itinerary/prompt.test.ts`
Expected: FAIL — the prompt still contains a "- Chegada: ..." line built from `answers.timing`.

- [ ] **Step 3: Implement**

In `src/lib/itinerary/prompt.ts`, delete the `TIMING_LABEL` map entirely, and in
`buildItineraryPrompt` delete the `timingLabel` line and the `` `- Chegada: ${timingLabel}`, `` line
from the returned array. The function becomes:

```ts
const REGION_LABEL: Record<string, string> = {
  centro: "Centro / Continente",
  norte: "Norte da Ilha",
  leste: "Leste da Ilha",
  sul: "Sul da Ilha",
  semhospedagem: "ainda sem hospedagem definida",
};

function dayCountFor(days: string | undefined): number {
  switch (days) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3-4":
      return 3;
    case "5+":
      return 5;
    default:
      return 2;
  }
}

export function buildItineraryPrompt(candidates: Place[], answers: QuizAnswers): string {
  const dayCount = dayCountFor(answers.days);
  const candidateLines = candidates
    .map(
      (c) =>
        `- place_id: ${c.id} | ${c.name} | categoria: ${c.category} | preço: ${c.price_range} | ${c.short_description}`,
    )
    .join("\n");

  const regionLabel =
    answers.region && answers.region !== "nao"
      ? (REGION_LABEL[answers.region] ?? "não informado")
      : "não informado / sem hospedagem definida";

  return [
    "Perfil do viajante:",
    `- Companhia: ${answers.group ?? "não informado"}`,
    `- Dias na cidade: ${answers.days ?? "não informado"} (monte exatamente ${dayCount} dia(s))`,
    `- Estilo de viagem: ${(answers.style ?? []).join(", ") || "não informado"}`,
    `- Orçamento: ${answers.budget ?? "não informado"}`,
    `- Transporte: ${answers.transport ?? "não informado"}`,
    `- Necessidade especial: ${answers.special ?? "nenhuma"}`,
    `- Região de hospedagem: ${regionLabel}`,
    "",
    "Lugares disponíveis (use SOMENTE estes, referenciando pelo place_id):",
    candidateLines,
    "",
    `Monte ${dayCount} dia(s) de roteiro, cada um com 3 a 5 atividades em horários realistas`,
    "(manhã/tarde/noite), e escreva uma mensagem de boas-vindas curta e personalizada ao perfil.",
    "Use a região de hospedagem informada (quando houver) para ordenar as atividades de cada dia",
    "de forma logisticamente inteligente, evitando deslocamentos desnecessários pela ilha.",
  ].join("\n");
}
```

Note: `answers.budget` is now an enum string (e.g. `"medio"`) instead of a number (Task 1), so the
line drops the old `R$${budget}` currency framing in favor of a plain tier label — it's free-text
fed to an LLM, not parsed, so `"- Orçamento: medio"` reads fine there even though the raw value is
the internal enum key, not the Portuguese label.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/itinerary/prompt.test.ts`
Expected: PASS (all tests, including the pre-existing day-count and candidate-list tests, which are
untouched).

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/prompt.ts src/lib/itinerary/prompt.test.ts
git commit -m "feat(itinerary): drop timing from the itinerary prompt, fix budget label"
```

---

### Task 4: `tripSummary.ts` — drop the timing chip, fix the budget chip

**Files:**
- Modify: `src/lib/itinerary/tripSummary.ts`
- Test: `src/lib/itinerary/tripSummary.test.ts`

**Interfaces:**
- Consumes: `Record<string, unknown>` (this file already takes the loosely-typed
  `ItineraryRow.quiz_answers`, not `QuizAnswers` directly — keep that signature so it stays tolerant
  of legacy rows).
- Produces: `getTripTitle`/`getTripChips` — same exported names and signatures.

- [ ] **Step 1: Write the failing tests**

Replace the `getTripChips` describe block in `src/lib/itinerary/tripSummary.test.ts` with:

```ts
describe("getTripChips", () => {
  it("builds one chip per recognized answer, in order", () => {
    const chips = getTripChips({
      region: "semhospedagem",
      group: "amigos",
      budget: "medio",
      days: "3-4",
    });
    expect(chips).toEqual([
      { icon: "🏨", label: "Sem hospedagem" },
      { icon: "👥", label: "Com amigos" },
      { icon: "💰", label: "Médio" },
      { icon: "📅", label: "3 a 4 dias" },
    ]);
  });

  it("skips answers that are missing or not recognized", () => {
    expect(getTripChips({})).toEqual([]);
    expect(getTripChips({ region: "nao" })).toEqual([]);
  });

  it("gracefully ignores a legacy numeric budget from itineraries created before this change", () => {
    // old rows have quiz_answers.budget as a number (e.g. 150) and quiz_answers.timing as a string —
    // neither should produce a chip anymore, and neither should throw.
    expect(getTripChips({ timing: "agora", budget: 150 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/itinerary/tripSummary.test.ts`
Expected: FAIL — `getTripChips` still emits a 📍 timing chip and a `R$200/dia`-style budget chip.

- [ ] **Step 3: Implement**

In `src/lib/itinerary/tripSummary.ts`, delete the `TIMING_LABEL` map, add a `BUDGET_LABEL` map, and
update `getTripChips`:

```ts
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
```

(the order of the `if` blocks is why the chip order in the test changed — region, group, budget,
days, same relative order as before minus the timing chip)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/itinerary/tripSummary.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary/tripSummary.ts src/lib/itinerary/tripSummary.test.ts
git commit -m "feat(itinerary): drop timing chip, read the new budget enum for the chip label"
```

---

### Task 5: Avisos static content — general, season, and purpose tips

**Files:**
- Create: `src/lib/avisos/types.ts`
- Create: `src/lib/avisos/generalTips.ts`
- Test: `src/lib/avisos/generalTips.test.ts`
- Create: `src/lib/avisos/seasonTips.ts`
- Test: `src/lib/avisos/seasonTips.test.ts`
- Create: `src/lib/avisos/purposeTips.ts`
- Test: `src/lib/avisos/purposeTips.test.ts`

**Interfaces:**
- Produces: `Tip` interface (`{ icon: string; label: string; text: string }`), used by every file in
  this task and by Task 6/7/8.
- Produces: `GENERAL_TIPS: Tip[]` (exactly 4 entries, same copy as today's `NOTICE_TIPS`).
- Produces: `seasonTipForMonth(month: number): Tip | null` — `null` only for an out-of-range month
  (not 1–12); every valid month maps to a tip.
- Produces: `purposeTip(purpose: QuizAnswers["purpose"]): Tip | null` — `null` for `undefined`,
  `"passeio"`, and `"familia_amigos"`; a `Tip` for the other three values.

- [ ] **Step 1: Write the failing tests**

`src/lib/avisos/generalTips.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GENERAL_TIPS } from "./generalTips";

describe("GENERAL_TIPS", () => {
  it("has exactly the 4 always-on tips, each with icon/label/text", () => {
    expect(GENERAL_TIPS).toHaveLength(4);
    expect(GENERAL_TIPS.map((t) => t.label)).toEqual(["Uber/99", "Estacionamento", "Trânsito", "Cuidados"]);
    for (const tip of GENERAL_TIPS) {
      expect(tip.icon.length).toBeGreaterThan(0);
      expect(tip.text.length).toBeGreaterThan(0);
    }
  });
});
```

`src/lib/avisos/seasonTips.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { seasonTipForMonth } from "./seasonTips";

describe("seasonTipForMonth", () => {
  it("returns the alta temporada tip for December through March", () => {
    for (const month of [12, 1, 2, 3]) {
      expect(seasonTipForMonth(month)?.label).toBe("Alta temporada");
    }
  });

  it("returns the friagem/inverno tip for June through August", () => {
    for (const month of [6, 7, 8]) {
      expect(seasonTipForMonth(month)?.label).toBe("Inverno");
    }
  });

  it("returns a tip for every valid month (1-12)", () => {
    for (let month = 1; month <= 12; month++) {
      expect(seasonTipForMonth(month)).not.toBeNull();
    }
  });

  it("returns null for an out-of-range month", () => {
    expect(seasonTipForMonth(0)).toBeNull();
    expect(seasonTipForMonth(13)).toBeNull();
  });
});
```

`src/lib/avisos/purposeTips.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { purposeTip } from "./purposeTips";

describe("purposeTip", () => {
  it("returns a work-focused tip for negocios and estudo_congresso", () => {
    expect(purposeTip("negocios")?.label).toBeTruthy();
    expect(purposeTip("estudo_congresso")?.label).toBeTruthy();
  });

  it("returns a trilhas/treino tip for atividade_fisica", () => {
    expect(purposeTip("atividade_fisica")?.label).toBeTruthy();
  });

  it("returns null for passeio, familia_amigos, and unanswered", () => {
    expect(purposeTip("passeio")).toBeNull();
    expect(purposeTip("familia_amigos")).toBeNull();
    expect(purposeTip(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/avisos/generalTips.test.ts src/lib/avisos/seasonTips.test.ts src/lib/avisos/purposeTips.test.ts`
Expected: FAIL — none of these modules exist yet.

- [ ] **Step 3: Implement**

`src/lib/avisos/types.ts`:

```ts
export interface Tip {
  icon: string;
  label: string;
  text: string;
}
```

`src/lib/avisos/generalTips.ts`:

```ts
import type { Tip } from "./types";

export const GENERAL_TIPS: Tip[] = [
  {
    icon: "🚕",
    label: "Uber/99",
    text: "costuma ser a forma mais prática de ir entre praias — o valor varia bastante conforme distância e horário, então confira o app antes de sair.",
  },
  {
    icon: "🅿️",
    label: "Estacionamento",
    text: "em pontos turísticos como Lagoa da Conceição e Centro, chegue cedo ou prefira deixar o carro na pousada e usar apps de transporte.",
  },
  {
    icon: "🕒",
    label: "Trânsito",
    text: "evite a Via Expressa/SC-401 no fim da tarde em dias úteis — costuma ser o horário de maior movimento da ilha.",
  },
  {
    icon: "☀️",
    label: "Cuidados",
    text: "leve protetor solar e água mesmo em dias nublados, e confira as condições do mar antes de entrar — várias praias têm correnteza forte.",
  },
];
```

`src/lib/avisos/seasonTips.ts`:

```ts
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
```

`src/lib/avisos/purposeTips.ts`:

```ts
import type { Tip } from "./types";
import type { QuizAnswers } from "@/lib/quiz/types";

const WORK: Tip = {
  icon: "💼",
  label: "Trabalho",
  text: "vários cafés e coworkings da ilha têm wifi rápido e boa estrutura pra quem vai trabalhar remoto durante a viagem.",
};

const ATIVIDADE_FISICA: Tip = {
  icon: "🏃",
  label: "Atividade física",
  text: "Floripa tem trilhas conhecidas (Lagoinha do Leste, Morro das Aranhas) e pontos de treino na orla — bom terreno pra quem vem treinar ou competir.",
};

const PURPOSE_TIPS: Partial<Record<NonNullable<QuizAnswers["purpose"]>, Tip>> = {
  negocios: WORK,
  estudo_congresso: WORK,
  atividade_fisica: ATIVIDADE_FISICA,
};

export function purposeTip(purpose: QuizAnswers["purpose"]): Tip | null {
  if (!purpose) return null;
  return PURPOSE_TIPS[purpose] ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/avisos/generalTips.test.ts src/lib/avisos/seasonTips.test.ts src/lib/avisos/purposeTips.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avisos/types.ts src/lib/avisos/generalTips.ts src/lib/avisos/generalTips.test.ts src/lib/avisos/seasonTips.ts src/lib/avisos/seasonTips.test.ts src/lib/avisos/purposeTips.ts src/lib/avisos/purposeTips.test.ts
git commit -m "feat(avisos): add static general/season/purpose tip content"
```

---

### Task 6: `travelWindow.ts` — resolve a reference month from `when`

**Files:**
- Create: `src/lib/avisos/travelWindow.ts`
- Test: `src/lib/avisos/travelWindow.test.ts`

**Interfaces:**
- Consumes: `QuizAnswers["when"]` (Task 1).
- Produces: `resolveTravelMonth(when: QuizAnswers["when"], now?: Date): number | null` — `1`-`12` for
  `"chegou"`/`"proximos_7_dias"`/`"2_a_4_semanas"`; `null` for `"mais_de_um_mes"`, `"planejando"`,
  `undefined`, or any unrecognized string. Task 7 calls this directly.

- [ ] **Step 1: Write the failing test**

`src/lib/avisos/travelWindow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveTravelMonth } from "./travelWindow";

describe("resolveTravelMonth", () => {
  it("resolves 'chegou' and 'proximos_7_dias' to the current month", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("chegou", now)).toBe(3);
    expect(resolveTravelMonth("proximos_7_dias", now)).toBe(3);
  });

  it("resolves '2_a_4_semanas' to the month 21 days from now", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("2_a_4_semanas", now)).toBe(4);
  });

  it("wraps '2_a_4_semanas' across a year boundary", () => {
    const now = new Date("2026-12-20T12:00:00Z");
    expect(resolveTravelMonth("2_a_4_semanas", now)).toBe(1);
  });

  it("returns null for 'mais_de_um_mes' and 'planejando' — the exact month is too uncertain", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("mais_de_um_mes", now)).toBeNull();
    expect(resolveTravelMonth("planejando", now)).toBeNull();
  });

  it("returns null when when is undefined or an unrecognized value", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth(undefined, now)).toBeNull();
    // @ts-expect-error — deliberately passing bad/legacy data
    expect(resolveTravelMonth("garbage", now)).toBeNull();
  });

  it("defaults 'now' to the real current date when not provided", () => {
    const result = resolveTravelMonth("chegou");
    expect(result).toBe(new Date().getMonth() + 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/avisos/travelWindow.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/avisos/travelWindow.ts`:

```ts
import type { QuizAnswers } from "@/lib/quiz/types";

export function resolveTravelMonth(when: QuizAnswers["when"], now: Date = new Date()): number | null {
  switch (when) {
    case "chegou":
    case "proximos_7_dias":
      return now.getMonth() + 1;
    case "2_a_4_semanas": {
      const future = new Date(now);
      future.setDate(future.getDate() + 21);
      return future.getMonth() + 1;
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/avisos/travelWindow.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avisos/travelWindow.ts src/lib/avisos/travelWindow.test.ts
git commit -m "feat(avisos): resolve a reference travel month from the when answer"
```

---

### Task 7: `buildAvisos.ts` — combine everything into one tip list

**Files:**
- Create: `src/lib/avisos/buildAvisos.ts`
- Test: `src/lib/avisos/buildAvisos.test.ts`

**Interfaces:**
- Consumes: `GENERAL_TIPS` (Task 5), `seasonTipForMonth` (Task 5), `purposeTip` (Task 5),
  `resolveTravelMonth` (Task 6), `filterEventsForTraveler` (existing,
  `src/lib/events/filterEvents.ts`), `Tip` (Task 5), `EventRow`/`QuizAnswers` (existing types).
- Produces: `buildAvisos(params: { answers: QuizAnswers; events: EventRow[]; now?: Date }): Tip[]` —
  consumed by Task 8 (`RoteiroView`) and Task 9 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

`src/lib/avisos/buildAvisos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAvisos } from "./buildAvisos";
import type { EventRow } from "@/lib/supabase/types";

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "1", name: "Evento", start_month: 1, end_month: 4, location: "Jurerê",
    target_profiles: ["Todos"], is_free: "Não", active: true, notes: null,
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

const NOW = new Date("2026-03-15T12:00:00Z"); // March

describe("buildAvisos", () => {
  it("always includes the 4 general tips, regardless of answers", () => {
    const tips = buildAvisos({ answers: {}, events: [], now: NOW });
    const labels = tips.map((t) => t.label);
    expect(labels).toEqual(expect.arrayContaining(["Uber/99", "Estacionamento", "Trânsito", "Cuidados"]));
  });

  it("adds a season tip and matching events when 'when' resolves to a month", () => {
    const events = [event({ id: "in-season", start_month: 1, end_month: 4 })];
    const tips = buildAvisos({ answers: { when: "chegou" }, events, now: NOW });
    expect(tips.some((t) => t.label === "Alta temporada")).toBe(true);
    expect(tips.some((t) => t.label === "Evento")).toBe(true);
  });

  it("omits the season tip and all events when 'when' is 'mais_de_um_mes' or 'planejando'", () => {
    const events = [event({ id: "would-match", start_month: 1, end_month: 4 })];

    const farOut = buildAvisos({ answers: { when: "mais_de_um_mes" }, events, now: NOW });
    expect(farOut.some((t) => t.label === "Alta temporada")).toBe(false);
    expect(farOut).toHaveLength(4); // only the general tips

    const planning = buildAvisos({ answers: { when: "planejando" }, events, now: NOW });
    expect(planning).toHaveLength(4);
  });

  it("omits the season tip and events when 'when' is unanswered (legacy itineraries)", () => {
    const events = [event({ id: "would-match", start_month: 1, end_month: 4 })];
    const tips = buildAvisos({ answers: {}, events, now: NOW });
    expect(tips).toHaveLength(4);
  });

  it("excludes events outside the resolved month", () => {
    const events = [event({ id: "out-of-season", start_month: 7, end_month: 7 })];
    const tips = buildAvisos({ answers: { when: "chegou" }, events, now: NOW });
    expect(tips.some((t) => t.label === "Evento")).toBe(false);
  });

  it("adds a work-related purpose tip for negocios, nothing for passeio", () => {
    const withNegocios = buildAvisos({ answers: { purpose: "negocios" }, events: [], now: NOW });
    expect(withNegocios).toHaveLength(5); // 4 general + 1 purpose

    const withPasseio = buildAvisos({ answers: { purpose: "passeio" }, events: [], now: NOW });
    expect(withPasseio).toHaveLength(4);
  });

  it("tolerates a legacy quiz_answers shape (old timing field, numeric budget) without throwing", () => {
    // old itineraries stored { timing: "agora", budget: 150, ... } — buildAvisos must not crash
    // when it receives that shape cast as QuizAnswers.
    expect(() => buildAvisos({ answers: { timing: "agora" } as never, events: [], now: NOW })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/avisos/buildAvisos.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/avisos/buildAvisos.ts`:

```ts
import type { EventRow } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";
import { filterEventsForTraveler } from "@/lib/events/filterEvents";
import { GENERAL_TIPS } from "./generalTips";
import { seasonTipForMonth } from "./seasonTips";
import { purposeTip } from "./purposeTips";
import { resolveTravelMonth } from "./travelWindow";
import type { Tip } from "./types";

export function buildAvisos(params: { answers: QuizAnswers; events: EventRow[]; now?: Date }): Tip[] {
  const { answers, events, now = new Date() } = params;
  const tips: Tip[] = [...GENERAL_TIPS];

  const month = resolveTravelMonth(answers.when, now);
  if (month !== null) {
    const season = seasonTipForMonth(month);
    if (season) tips.push(season);

    for (const event of filterEventsForTraveler(events, answers, month)) {
      tips.push({
        icon: "🎉",
        label: event.name,
        text: event.notes ? `${event.location} — ${event.notes}` : event.location,
      });
    }
  }

  const purpose = purposeTip(answers.purpose);
  if (purpose) tips.push(purpose);

  return tips;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/avisos/buildAvisos.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avisos/buildAvisos.ts src/lib/avisos/buildAvisos.test.ts
git commit -m "feat(avisos): add buildAvisos orchestrator combining tips and seasonal events"
```

---

### Task 8: `RoteiroView.tsx` — `ImportantNotice` becomes prop-driven

**Files:**
- Modify: `src/components/roteiro/RoteiroView.tsx`
- Test: `src/components/roteiro/RoteiroView.test.tsx`

**Interfaces:**
- Consumes: `Tip` (Task 5), `GENERAL_TIPS` (Task 5).
- Produces: `RoteiroView` gains an optional `tips?: Tip[]` prop (defaults to `GENERAL_TIPS`),
  consumed by Task 9 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

Add to `src/components/roteiro/RoteiroView.test.tsx` (needs `import type { Tip } from
"@/lib/avisos/types";` added near the top imports):

```ts
  it("shows the general avisos tips by default when no tips prop is given", () => {
    render(<RoteiroView itinerary={itinerary} />);
    expect(screen.getByText(/uber\/99/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver mais/i }));
    expect(screen.getByText(/cuidados/i)).toBeInTheDocument();
  });

  it("renders a custom tips list instead of the defaults when tips is passed", () => {
    const tips: Tip[] = [{ icon: "🎉", label: "Festival de Inverno", text: "Rola no Centro em julho." }];
    render(<RoteiroView itinerary={itinerary} tips={tips} />);
    expect(screen.getByText(/festival de inverno/i)).toBeInTheDocument();
    expect(screen.queryByText(/uber\/99/i)).not.toBeInTheDocument();
  });

  it("renders no avisos card when tips is an empty array", () => {
    render(<RoteiroView itinerary={itinerary} tips={[]} />);
    expect(screen.queryByText(/aviso importante/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/roteiro/RoteiroView.test.tsx`
Expected: FAIL — `RoteiroView` doesn't accept a `tips` prop yet, and `ImportantNotice` always shows
the hardcoded `NOTICE_TIPS`.

- [ ] **Step 3: Implement**

In `src/components/roteiro/RoteiroView.tsx`:

1. Add imports near the top, next to the other `@/lib/itinerary/...` imports:

```ts
import type { Tip } from "@/lib/avisos/types";
import { GENERAL_TIPS } from "@/lib/avisos/generalTips";
```

2. Delete the `const NOTICE_TIPS = [...]` block entirely (it now lives in `generalTips.ts`).

3. Replace the `ImportantNotice` function:

```ts
function ImportantNotice({ tips }: { tips: Tip[] }) {
  const [expanded, setExpanded] = useState(false);
  if (tips.length === 0) return null;
  const visibleTips = expanded ? tips : tips.slice(0, 1);

  return (
    <div className="rounded-card border border-coral/40 bg-coral/10 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-coral">⚠️ Aviso importante</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-ink-dim">
        {visibleTips.map((tip) => (
          <li key={tip.label}>
            {tip.icon} <strong className="text-ink">{tip.label}:</strong> {tip.text}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs font-bold text-coral">
        {expanded ? "Ver menos ↑" : "Ver mais ↓"}
      </button>
    </div>
  );
}
```

4. Update the `RoteiroView` export signature and its call site:

```ts
export function RoteiroView({
  itinerary,
  partners = [],
  tips = GENERAL_TIPS,
}: {
  itinerary: ItineraryRow;
  partners?: Place[];
  tips?: Tip[];
}) {
```

...and further down, where `<ImportantNotice />` is rendered:

```tsx
      <div className="relative mt-4 px-6">
        <ImportantNotice tips={tips} />
      </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/roteiro/RoteiroView.test.tsx`
Expected: PASS (all tests, including the pre-existing ones — none of them assert on avisos content,
so they're unaffected by the default-prop change).

- [ ] **Step 5: Commit**

```bash
git add src/components/roteiro/RoteiroView.tsx src/components/roteiro/RoteiroView.test.tsx
git commit -m "feat(roteiro): make the avisos card read from a tips prop instead of a hardcoded list"
```

---

### Task 9: Wire it up in the roteiro page

**Files:**
- Modify: `src/app/roteiro/[slug]/page.tsx`

**Interfaces:**
- Consumes: `buildAvisos` (Task 7), `listEvents` (existing, `src/lib/supabase/queries.ts`),
  `RoteiroView`'s new `tips` prop (Task 8).
- Produces: nothing further downstream — this is the final wiring task.

There's no dedicated test file for this route (none of the other `src/app/roteiro/[slug]/**/page.tsx`
files have one either — they're thin wiring covered indirectly by the component tests). Task 10's
full build/test run is what catches wiring mistakes here.

- [ ] **Step 1: Implement**

Replace the full content of `src/app/roteiro/[slug]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug, listPlaces, listEvents } from "@/lib/supabase/queries";
import { RoteiroView } from "@/components/roteiro/RoteiroView";
import { selectPartners } from "@/lib/itinerary/simulatedPartners";
import { buildAvisos } from "@/lib/avisos/buildAvisos";
import type { QuizAnswers } from "@/lib/quiz/types";

export default async function RoteiroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const itinerary = await getItineraryBySlug(client, slug);
  if (!itinerary) notFound();
  const places = await listPlaces(client);
  const partners = selectPartners(places);
  const events = await listEvents(client);
  const tips = buildAvisos({ answers: itinerary.quiz_answers as QuizAnswers, events });
  return <RoteiroView itinerary={itinerary} partners={partners} tips={tips} />;
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — every test file in the repo, including all the ones touched in Tasks 1-8.

- [ ] **Step 3: Commit**

```bash
git add src/app/roteiro/[slug]/page.tsx
git commit -m "feat(roteiro): fetch events and build personalized avisos for the roteiro page"
```

---

### Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run the production build to catch type errors across the whole change set**

Run: `npm run build`
Expected: builds successfully — this is what catches any place still referencing the removed
`QuizAnswers.timing` field or the old numeric `budget` type that the test suite didn't happen to
exercise.

- [ ] **Step 3: Manual smoke check**

Check whether a Next.js dev server is already running for this project before starting a new one
(starting a second one against the same `.next` build directory causes conflicts). If one is
already running, use it; otherwise run `npm run dev`.

Walk through the quiz end to end in the browser:
- Confirm the first question is "Qual o motivo da sua viagem a Florianópolis?" with 5 options.
- Confirm the second question is "Quando você vem para Florianópolis?" with 5 options.
- Confirm "Quantos dias você vai ficar em Floripa?" still appears, unchanged, later in the flow.
- Confirm the budget question shows 3 buttons (Econômico/Médio/Alto), not a slider.
- Confirm the style question no longer offers "Negócios".
- Complete the quiz and open the resulting roteiro page — confirm the "⚠️ Aviso importante" card
  renders, and that answering "when" with a near-term option (e.g. "Nos próximos 7 dias") makes a
  season-specific tip appear when expanded.

This step has no pass/fail assertion beyond "nothing looks broken and the new copy renders" — it's
a visual check, not a substitute for Steps 1-2.

- [ ] **Step 4: Commit** (only if Step 3 required fixes; otherwise this task produces no diff)

```bash
git add -A
git commit -m "fix: address issues found in manual quiz redesign smoke check"
```
