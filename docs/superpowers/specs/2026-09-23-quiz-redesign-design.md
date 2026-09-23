# Redesenho do quiz: motivo da viagem, janela de tempo, avisos personalizados e orçamento simplificado

Data: 2026-09-23

## Contexto

O quiz (`src/lib/quiz/questions.ts:3-106`, tipos em `src/lib/quiz/types.ts`, fluxo em
`src/lib/quiz/useQuizFlow.ts`, renderização em `src/components/quiz/QuestionCard.tsx`) tem hoje 8
perguntas: `timing` (como chega), `region` (onde hospeda), `days` (quantos dias), `group`
(companhia), `style` (estilo, multi), `transport` (como se locomove), `budget` (slider R$50-600) e
`special` (necessidade especial).

Duas perguntas hoje **não têm nenhum efeito estrutural**: `timing` e `transport` só viram texto
solto dentro do prompt enviado à IA que monta o roteiro (`src/lib/itinerary/prompt.ts:14-19,65`) —
não filtram nem ordenam nada no código. O card de "Avisos" do roteiro
(`ImportantNotice`, `src/components/roteiro/RoteiroView.tsx:93-135`) é uma lista estática
(`NOTICE_TIPS`) igual para todo mundo, sem relação com as respostas do quiz. Já existe um sistema
de eventos sazonais funcionando (`EventRow`, `src/lib/supabase/types.ts:30-41`,
`filterEventsForTraveler`, `src/lib/events/filterEvents.ts`), mas hoje só aparece numa aba separada
("Dicas pra você", `src/components/dicas/DicasView.tsx`), sem ligação com o quiz nem com o roteiro.

Este design substitui a pergunta `timing` por duas novas perguntas mais úteis (`purpose` e `when`),
simplifica `budget` para 3 opções fixas, remove `days` (roteiro passa a ter sempre 3 dias),
remove a opção "Negócios" de `style`, e cria um bloco de **Avisos personalizados** alimentado pelas
respostas do quiz, substituindo o card estático atual. O quiz continua com 8 perguntas no total.

**Fora de escopo** (decidido em brainstorming, fica para uma spec futura): lógica de progressão
geográfica no roteiro (dia 1 perto da hospedagem, dias seguintes mais longe) e integração de
previsão do tempo em tempo real. Esta spec não mexe em `filterCandidates`, `rankCandidates` nem em
como os dias são montados pela IA além da contagem fixa de dias (seção 3).

## 1. Nova pergunta: motivo da viagem (`purpose`)

Substitui a posição da pergunta `timing` na primeira posição do quiz.

```
id: "purpose"
texto: "Qual o motivo da sua viagem a Florianópolis?"
tipo: grid2
opções:
  🏖️ Passeio / Turismo         → "passeio"
  💼 Negócios                   → "negocios"
  🎓 Estudo ou Congresso        → "estudo_congresso"
  🏃 Atividade Física/Competição → "atividade_fisica"
  👨‍👩‍👧 Visitar Família/Amigos    → "familia_amigos"
```

Não filtra nem prioriza estabelecimentos (`filterCandidates.ts` não muda por causa desta pergunta).
Serve exclusivamente para escolher qual bloco extra aparece no sistema de Avisos (seção 7):
`negocios` e `estudo_congresso` mostram um bloco de dica prática de trabalho/evento;
`atividade_fisica` mostra um bloco de trilhas/pontos de treino; `passeio` e `familia_amigos` não
adicionam bloco extra.

## 2. Nova pergunta: quando vai viajar (`when`)

Substitui a pergunta `timing` (que perguntava "como você chega"), na segunda posição.

```
id: "when"
texto: "Quando você vem para Florianópolis?"
tipo: rows
opções:
  📍 Já estou em Floripa        → "chegou"
  🗓️ Nos próximos 7 dias        → "proximos_7_dias"
  📆 Entre 2 e 4 semanas        → "2_a_4_semanas"
  🔭 Daqui a mais de um mês     → "mais_de_um_mes"
  🤔 Ainda estou planejando     → "planejando"
```

Usada só pelo sistema de Avisos (seção 7) para calcular um mês de referência e decidir se mostra
conteúdo sazonal (ver seção 7). Não é passada para o prompt da IA — a IA não precisa saber quando a
pessoa viaja para montar o roteiro em si.

## 3. Remoção da pergunta `days` → 3 dias fixos

A pergunta `days` sai do quiz inteiramente (não aparece mais, em nenhuma posição).

`dayCountFor()` (`src/lib/itinerary/prompt.ts:29-42`) é removido. `buildItineraryPrompt` passa a
usar uma constante fixa `const FIXED_DAY_COUNT = 3` no lugar do valor calculado — o texto do prompt
troca `Dias na cidade: ${answers.days}` por simplesmente instruir a IA a montar 3 dias.
`QuizAnswers.days` é removido do tipo.

## 4. Orçamento: slider → 3 botões

A pergunta `budget` deixa de ser slider numérico (R$50–600) e passa a ser 3 botões:

```
id: "budget"
texto: "Qual o seu orçamento?"
tipo: grid2 (ou rows)
opções:
  💰 Econômico → "economico"
  💵 Médio     → "medio"
  💎 Alto      → "alto"
```

`QuizAnswers.budget` muda de `number | undefined` para `"economico" | "medio" | "alto" | undefined`.
`allowedPriceRanges()` (`src/lib/itinerary/filterCandidates.ts:20-27`) passa a mapear direto por
enum em vez de faixas numéricas:

```
economico → ["Gratuito", "R$"]
medio     → ["Gratuito", "R$", "R$$"]
alto      → ["Gratuito", "R$", "R$$", "R$$$"]  (PRICE_ORDER completo)
```

Resultado idêntico ao comportamento atual nos três casos (o slider já colapsava para essas mesmas
3 faixas por baixo dos panos) — é uma limpeza de UI e de código, não uma mudança de filtro.

## 5. Estilo: remoção da opção "Negócios"

A opção `negocios` (💼 "Negócios") sai da pergunta `style`
(`src/lib/quiz/questions.ts` questão `style`) e de `STYLE_CATEGORIES`
(`src/lib/itinerary/filterCandidates.ts:11-18`). A nova pergunta `purpose` (seção 1) já cobre esse
sinal de forma mais clara; manter as duas criava duas perguntas usando a palavra "negócios" com
significados diferentes (motivo da viagem vs. categoria de lazer).

## 6. Transporte: de texto solto a gatilho de avisos práticos

A pergunta `transport` não muda (mesmas 4 opções). O que muda é seu uso: hoje só vira uma linha de
texto no prompt da IA (`prompt.ts:65`); passa a também escolher qual dica prática aparece no bloco
de Avisos (seção 7), no lugar do card estático genérico atual.

## 7. Sistema de Avisos (novo)

Substitui o componente `ImportantNotice` atual (`RoteiroView.tsx:93-135`, lista estática
`NOTICE_TIPS`) por um bloco montado a partir das respostas do quiz. Conteúdo estático (dicionários
em código, sem escrita em banco — consistente com a preferência já usada em outras telas de dados
de demonstração), com três fontes combinadas:

### a) Dica de época do ano (a partir de `when`)

Um dicionário `SEASON_TIPS` com um texto curto por estação/período do ano em Floripa (ex.: alta
temporada dez–mar, inverno/friagem jun–ago, entressafras abr–mai e set–nov), indexado por mês
(1–12).

Só é mostrado quando dá pra calcular um mês de referência com confiança razoável:

- `chegou` ou `proximos_7_dias` → mês atual (`new Date().getMonth() + 1`)
- `2_a_4_semanas` → mês resultante de "hoje + 21 dias"
- `mais_de_um_mes` ou `planejando` (ou pergunta não respondida) → **não mostra** dica de época
  (mês real é incerto demais para não passar informação errada)

### b) Eventos sazonais relevantes (a partir de `when` + `group`)

Quando um mês de referência foi calculado (casos acima), reaproveita
`filterEventsForTraveler(events, answers, mes)` (`src/lib/events/filterEvents.ts`) — já existe e já
filtra por perfil de grupo + mês. Mostra até N eventos ativos naquele mês como parte do bloco de
Avisos (hoje só aparecem em "Dicas pra você").

### c) Dica prática de transporte (a partir de `transport`)

Um dicionário `TRANSPORT_TIPS` com uma dica por resposta de `transport`:

- `carro` → dica de estacionamento + trânsito (reaproveita texto de `NOTICE_TIPS` atual)
- `app` → dica de Uber/99 (reaproveita texto de `NOTICE_TIPS` atual)
- `onibus` → dica de linhas/passagem (conteúdo novo, hoje não existe nenhum texto sobre ônibus)
- `pe` → dica de caminhada/segurança (conteúdo novo)

A dica de "Cuidados" (sol/água/correnteza) do `NOTICE_TIPS` atual continua sempre visível,
independente de `transport` — não é específica de um modo de locomoção.

### d) Dica de propósito (a partir de `purpose`)

Um dicionário `PURPOSE_TIPS` só com entradas para `negocios`/`estudo_congresso` (dica de
wifi/coworking) e `atividade_fisica` (trilhas/pontos de treino). `passeio` e `familia_amigos` não
adicionam nada aqui.

### Layout

Mesmo componente visual de card colapsável que existe hoje (`⚠️ Aviso importante`, expandir/
recolher), só troca a fonte da lista de itens: em vez de `NOTICE_TIPS` fixo, monta a lista
combinando (sempre) Cuidados + dica de transporte, e (condicionalmente) dica de época, eventos e
dica de propósito.

## Modelo de dados: `QuizAnswers`

```ts
// src/lib/quiz/types.ts — antes
export interface QuizAnswers {
  timing?: string;
  region?: string;
  days?: string;
  group?: string;
  style?: string[];
  transport?: string;
  budget?: number;
  special?: string;
}

// depois
export interface QuizAnswers {
  purpose?: "passeio" | "negocios" | "estudo_congresso" | "atividade_fisica" | "familia_amigos";
  when?: "chegou" | "proximos_7_dias" | "2_a_4_semanas" | "mais_de_um_mes" | "planejando";
  region?: string;
  group?: string;
  style?: string[];
  transport?: string;
  budget?: "economico" | "medio" | "alto";
  special?: string;
}
```

`timing` e `days` somem do tipo. Respostas antigas já salvas em `quiz_answers` (JSONB,
`supabase/migrations/0001_init.sql:60`) continuam existindo no banco para itinerários já gerados —
como é histórico read-only e não há re-geração automática de roteiros antigos, não precisa de
migração de dados, só o código novo passa a ignorar `timing`/`days` e não vai mais receber esses
campos em respostas novas.

## Testes

- `filterCandidates`: atualizar teste de `allowedPriceRanges`/orçamento para os 3 valores enum em
  vez de números; remover qualquer caso que dependa de `negocios` em `STYLE_CATEGORIES`.
- `prompt.ts`: atualizar teste de `buildItineraryPrompt` para contagem fixa de 3 dias (sem
  `answers.days`) e sem `TIMING_LABEL`.
- Novo teste para a função de mês de referência a partir de `when` (casos: cada uma das 5 opções +
  resposta ausente).
- Novo teste para a montagem do bloco de Avisos: confirma que Cuidados + transporte sempre
  aparecem, que época/eventos só aparecem para `when` de curto prazo, e que a dica de propósito só
  aparece para `negocios`/`estudo_congresso`/`atividade_fisica`.
- Atualizar snapshot/teste do componente do quiz (`QuestionCard`/fluxo) para a nova lista de 8
  perguntas na nova ordem.
