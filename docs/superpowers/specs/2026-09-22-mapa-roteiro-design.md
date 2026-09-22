# Mapa do roteiro: novo visual, ícones, filtro por dia e sugestões

Data: 2026-09-22

## Contexto

O mapa do roteiro (`/roteiro/[slug]/mapa`, componente `src/components/roteiro/MapaView.tsx`) usa
Leaflet com tiles OpenStreetMap padrão e marcadores em emoji cru (⭐ parceiro, 📍 atividade,
`·` sugestão próxima). Não há filtro por dia, nem forma de adicionar um lugar sugerido ao
roteiro direto pelo mapa — é só visualização.

Este design cobre quatro mudanças conectadas, todas no fluxo existente do mapa:

1. Novo tema visual (tiles)
2. Ícones customizados por categoria
3. Filtro por dia
4. Menu de sugestões (chips + lista) com opção de adicionar ao roteiro

Fora de escopo (decidido em brainstorming): traçar rota/trajeto entre os pontos do roteiro.
Fica para um design futuro se for pedido.

## 1. Tema visual do mapa

Trocar a URL do tile layer em `MapaView.tsx` de OpenStreetMap padrão para **CARTO Voyager**:

```
https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
```

Validado visualmente contra 3 outras opções (OSM atual, Positron, Dark Matter) — Voyager foi a
escolha. Sem novas dependências; é só trocar a URL e a atribuição (`&copy; CARTO`).

## 2. Ícones por categoria

Substituir os `L.divIcon` de emoji por **selos circulares por categoria** (validado visualmente
contra "pins numerados" e "minimalista estilo Google Maps"):

- Círculo colorido com ícone [Font Awesome](https://fontawesome.com) da categoria do lugar
  (`place.category`: hoje os valores usados para personalização são `praia`, `gastronomia`,
  `compras`, `cultura` — ver `src/lib/quiz/questions.ts`). Definir uma cor + ícone por categoria,
  com um par default para categorias fora dessa lista.
- Atividades do roteiro (já confirmadas no dia): selo cheio, 36px, borda branca.
- Parceiros (`is_partner`): mesma badge, mas com anel dourado.
- Sugestões (do menu, seção 4): selo menor (28px), levemente translúcido, mesma cor/ícone de
  categoria — visualmente "convidativo mas secundário" até o usuário interagir.

Font Awesome pode ser carregado via CDN (`cdnjs`) igual ao protótipo visual, ou instalado como
pacote (`@fortawesome/fontawesome-free`) — decisão de implementação, não de design.

## 3. Filtro por dia

Adicionar um seletor de dias (abas "Dia 1 / Dia 2 / ...") fixo no topo do mapa, acima da barra
de chips de categoria (seção 4). Selecionar um dia:

- Filtra os pins de atividades do roteiro para mostrar só os daquele dia.
- Ajusta o `map.fitBounds(...)` para enquadrar os pontos do dia selecionado.
- Não afeta os pins de sugestão (seção 4), que continuam mostrando lugares próximos
  independente do dia selecionado — o objetivo do filtro é limpar a visão do itinerário, não
  esconder sugestões.

Estado inicial: dia 1 selecionado (ou o primeiro dia com atividades com lat/lng).

## 4. Menu de sugestões

### Dados

Ampliar `getNearbyPlaces` (`src/lib/itinerary/nearbyPlaces.ts`) para retornar os campos
completos do `Place` já disponíveis em `allPlaces`/`sampled` (hoje descartados na linha de
`.map((p) => ({ id, name, lat, lng }))`), incluindo pelo menos: `category`, `photos`, `rating`,
`price_range`, `address`, `google_place_id`, `partner_offer`, `short_description`,
`is_partner`. A lógica de seleção (filtro por perfil do quiz + amostragem ponderada,
excluindo lugares já no roteiro) não muda.

### UI

Validado visualmente contra "botão flutuante + bottom sheet" e "só chips, sem lista":

- **Barra de chips de categoria** fixa no topo do mapa (abaixo do seletor de dias):
  Todos / Praia / Gastronomia / Compras / Cultura. Filtra ao mesmo tempo:
  - quais pins de sugestão aparecem no mapa;
  - quais cards aparecem na lista (abaixo).
- **Lista colapsável** ("bottom sheet" com handle) ancorada acima da `BottomNav`, mostrando os
  cards filtrados em scroll horizontal (foto + nome + categoria). Pode ser recolhida/expandida
  pelo usuário.

### Adicionar ao roteiro

Tocar num pin de sugestão **ou** num card da lista abre o `EstablishmentModal` já existente
(mesmo componente usado na lista de cards do roteiro, com fotos do Google e link de
avaliações), em modo "sugestão": mostra um botão **"Adicionar ao roteiro"** que hoje não existe
no modal.

Fluxo técnico:

- `EstablishmentModal` ganha uma prop opcional (ex.: `onAdd`) — quando presente, mostra o botão;
  quando ausente (uso atual na lista de cards, para itens já no roteiro), comportamento não
  muda.
- Novo caminho no endpoint `PATCH /api/itineraries/[slug]`: hoje aceita `{ day_number,
  activity: {name, time} }` (atividade digitada à mão) ou `{ day_number, place_id }` (remover).
  Adicionar um terceiro caso aditivo — `{ day_number, add_place_id }` — que busca o `Place`
  completo, monta um `ItineraryActivity` a partir dele (mesmo mapeamento já usado em
  `assembleDays`, `src/lib/itinerary/assemble.ts` linhas 39-55: `category`, `price_range`,
  `is_partner`, `address`, `lat`, `lng`, `photos`, `rating`, `google_place_id`,
  `partner_offer`, `short_description`) e insere no dia, com `time` calculado automaticamente
  (após a última atividade do dia, mesma ordenação por horário já usada em `addActivity`).
  Isso não altera o contrato de remoção existente (`place_id` sozinho continua removendo).
- Depois de adicionar, a atividade deixa de aparecer como sugestão (já é filtrada pela
  exclusão de `usedIds` em `getNearbyPlaces`) e passa a aparecer como pin de itinerário normal
  (selo cheio, seção 2).

## Testes

- `MapaView.test.tsx` já cobre o comportamento atual dos marcadores — precisa ser atualizado
  para a nova iconografia, filtro por dia e chips/lista de sugestão.
- Novo teste para o caminho `add_place_id` no endpoint PATCH (equivalente ao que já existe
  para `activity` e `place_id`/remoção).
- Novo teste para `getNearbyPlaces` retornando os campos ampliados.
