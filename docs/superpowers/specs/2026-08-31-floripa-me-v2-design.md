# Floripa.me v2 — Design

## Contexto

Floripa.me é um app de turismo para Florianópolis: o usuário responde 8 perguntas e recebe um roteiro personalizado gerado por IA (boas-vindas + programação dia a dia com pontos turísticos, gastronomia, esportes, trilhas e passeios). Um projeto anterior produziu um conjunto extenso de mockups estáticos em HTML (quiz, editor de roteiro, mockup de SOS, painéis de parceiro) e uma planilha curada de ~60 estabelecimentos, parceiros e eventos anuais de Florianópolis — mas nada disso é um app funcional: não há backend, geração por IA real, nem integração com Google Places.

Este documento especifica a reconstrução do Floripa.me como aplicação real, com uma nova identidade visual, reaproveitando o conteúdo/dados já levantados (perguntas do quiz, banco de locais, parceiros, eventos) e a lógica de produto já validada nos mockups.

**Fora de escopo nesta fase:** painel de administração completo para parceiros (CRUD, contratos, leads). Nesta fase, o catálogo é editado diretamente no Supabase Studio. Um painel de admin dedicado pode ser uma fase 2, especificada separadamente.

## Objetivo e critérios de sucesso

- Usuário completa o quiz de 8 perguntas e recebe, em poucos segundos, um roteiro coerente, com lugares reais (existentes, com endereço/coordenadas corretos) e um texto de boas-vindas personalizado ao perfil.
- Estabelecimentos parceiros aparecem com mais frequência que os demais, mas não de forma exclusiva/travada — os não-parceiros compatíveis se revezam a cada geração.
- Navegação por Roteiro (home), Mapa, Dicas, SOS e Mais, todas alimentadas pelos mesmos dados de catálogo.
- Visual novo, no estilo aprovado "Ilha Neon Noturna" (ver seção de Design Visual), sensivelmente mais bonito e premium que os mockups anteriores.
- App funciona como PWA instalável, sem exigir cadastro/login.

## Arquitetura

- **Stack**: Next.js (App Router, TypeScript) + Tailwind CSS + Supabase (Postgres), hospedado na Vercel.
- **Frontend**: rotas para Boas-vindas → Quiz → Roteiro (`/roteiro/[slug]`, tela home pós-quiz) → Mapa / Dicas / SOS / Mais, como PWA instalável (manifest + service worker padrão, sem exigência de funcionamento offline completo).
- **Backend**: API routes do Next.js orquestram: (1) filtragem e ranking de candidatos no catálogo Supabase a partir das respostas do quiz; (2) chamada à API do Claude para gerar a narrativa estruturada do roteiro; (3) endpoints de leitura para Mapa/Dicas/SOS.
- **Persistência sem login**: cada roteiro gerado recebe um slug único, salvo em `itineraries` e também em `localStorage` do navegador que o gerou. O link do roteiro funciona como "conta" — pode ser reaberto, compartilhado e editado por quem tiver o link (sem autenticação, análogo a um link de documento compartilhado; aceitável pois não há dados sensíveis).
- **Sincronização de catálogo**: scripts server-side (rodados manualmente por enquanto) consultam a Google Places API para descobrir novos estabelecimentos e enriquecer os já cadastrados (coordenadas, fotos, nota, horário). A chave da API nunca é exposta ao navegador. Curadoria (marcar parceiro, ajustar descrição/perfil) acontece direto no Supabase Studio.

## Modelo de dados (Supabase)

### `places`
Catálogo central de estabelecimentos/pontos turísticos, migrado da planilha existente e enriquecido via Places API.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `region` | text | Sul / Leste / Norte / Centro / Continente |
| `neighborhood` | text | Bairro/local (ex: Campeche, Lagoa da Conceição) |
| `name` | text | |
| `category` | text | Praia, Gastronomia, Bar/Noturno, Trilha, Esporte, Cultura, Natureza, Mirante, Beach Club, Atividade, Passeio, Café/Padaria |
| `target_profiles` | text[] | Todos, Casal, Família, Amigos, Solo, Negócios |
| `price_range` | text | Gratuito, R$, R$$, R$$$ |
| `point_type` | text | Ponto Turístico, Restaurante, Bar, Atividade, etc. |
| `short_description` | text | Usada pela IA na narrativa do roteiro |
| `address` | text | |
| `opening_hours` | text/jsonb | |
| `phone` | text | |
| `instagram` | text | |
| `notes` | text | Observações/dicas locais |
| `google_place_id` | text | preenchido pelo sync |
| `lat`, `lng` | float | preenchido pelo sync |
| `rating` | float | preenchido pelo sync |
| `photos` | text[] | URLs, preenchido pelo sync |
| `is_partner` | boolean | default false |
| `partner_plan` | text | Destaque / Essencial |
| `partner_offer` | text | Texto da oferta exclusiva |
| `partner_status` | text | Ativo / Em negociação |
| `special_needs_tags` | text[] | acessibilidade, vegano, pet, bebê |

### `events`
Eventos anuais recorrentes (Carnaval, Fenaostra, Réveillon etc.), migrados da aba correspondente da planilha.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | |
| `start_month`, `end_month` | int | 1-12 |
| `location` | text | |
| `target_profiles` | text[] | |
| `is_free` | boolean/text | Sim / Não / Parcial |
| `active` | boolean | |
| `notes` | text | Instrução de quando/como injetar no roteiro ou em Dicas |

### `sos_places`
Estabelecimentos de serviços essenciais.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `category` | text | saude, veiculo, seguranca, financeiro |
| `tag` | text | publico / parceiro |
| `name` | text | |
| `meta` | text | descrição curta (ex: "Trindade · 24h · Público") |
| `lat`, `lng` | float | |
| `phone` | text | |

### `itineraries`
Um roteiro gerado.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | |
| `slug` | text (unique) | usado na URL pública |
| `quiz_answers` | jsonb | as 8 respostas |
| `welcome_message` | text | gerado pela IA |
| `days` | jsonb | array de dias → atividades (horário, place_id, categoria, custo, parceiro) |
| `created_at` | timestamptz | |

## Quiz (8 perguntas)

Reaproveitado do mockup existente, sem mudança de conteúdo:

1. **Chegada** (`timing`) — avião / ônibus / carro / já estou em Floripa
2. **Hospedagem** (`region`, opcional) — Centro/Continente / Norte / Leste / Sul / sem hospedagem ainda / prefiro não informar
3. **Dias de estadia** (`days`) — 1 / 2 / 3-4 / 5+
4. **Companhia** (`group`) — Solo / Casal / Família / Amigos
5. **Estilo de viagem** (`style`, múltipla escolha) — Praia/Surf/Aventura, Gastronomia, Compras, Lazer/Cultura, Balada/Bares, Negócios
6. **Locomoção** (`transport`) — carro/moto, app (Uber/99), ônibus, a pé
7. **Orçamento diário** (`budget`) — slider R$50–R$600
8. **Necessidade especial** (`special`, opcional) — acessibilidade, vegetariano/vegano, crianças pequenas, pet friendly, nenhuma

## Pipeline de geração do roteiro

1. **Filtragem**: a partir das 8 respostas, filtrar `places` por perfil compatível (`target_profiles`), faixa de preço compatível com o orçamento, categoria compatível com o(s) estilo(s) escolhido(s), e priorizar `special_needs_tags` quando aplicável. Região de hospedagem influencia a ordenação logística dos dias, não exclui o restante da ilha. `events` ativos no período da viagem (cruzando `days` do quiz com `start_month`/`end_month`) entram como candidatos extras quando o perfil combina.
2. **Ranking com prioridade de parceiro**: para cada slot (categoria × período do dia), os candidatos compatíveis passam por amostragem aleatória ponderada — peso alto para `is_partner = true` (ex: 6-8x), mas não determinístico, e revezamento entre os não-parceiros compatíveis a cada geração nova.
3. **Geração da narrativa (Claude)**: a lista final de ~15-25 candidatos (com todos os dados relevantes) mais as respostas do quiz são enviadas ao Claude com instrução explícita de montar o roteiro **somente** a partir dessa lista — decidindo ordem, ritmo do dia e escrevendo a mensagem de boas-vindas e transições narrativas. Saída em JSON estruturado (schema: dias → atividades, cada atividade referenciando o `id` do place). O backend casa o JSON de volta com os dados completos do catálogo antes de salvar/exibir.
4. **Persistência**: resultado salvo em `itineraries` com slug único; slug guardado em `localStorage` do navegador.

## Design visual

Direção aprovada: **"Ilha Neon Noturna"** — evolução premium do visual atual do projeto.

- **Paleta**: fundo escuro grafite/petróleo (`#0B1416`, gradientes para `#123542`), turquesa vibrante (`#00E6C8`) e azul (`#00A8E0`) como cor primária de ação/destaque, coral quente (`#FF7A59`) como accent secundário (parceiros, alertas). Tela de SOS desloca a paleta para tons coral/vermelho mantendo a mesma família visual, sinalizando "alerta" sem sair do sistema.
- **Tipografia**: Syne (display, peso 700-800) para títulos, DM Sans para corpo de texto — mantido do projeto anterior por já funcionar bem com essa direção.
- **Elementos característicos**: gradientes radiais suaves ("glow") turquesa/coral no fundo das telas-chave, glassmorphism na barra de navegação inferior (blur + transparência), cards com bordas sutis (`rgba(255,255,255,.08)`), selo "⭐ Parceiro" em coral discreto.
- **Telas principais** (ver mockups aprovados em `.superpowers/brainstorm/`): Quiz (uma pergunta por tela, progresso no topo, seleção com glow), Roteiro/home (mensagem de boas-vindas + dias em cards com timeline), Mapa (pins coloridos por tipo, cartão flutuante ao tocar), Dicas (eventos vigentes em destaque, filtráveis), SOS (paleta alerta, chips de categoria, distância sempre visível), Mais (editar roteiro, compartilhar link, salvar/imprimir PDF, refazer quiz, instalar PWA).
- Refinamento visual adicional (espaçamento fino, micro-interações) fica para uma iteração posterior, após a primeira versão funcional.

## Integração com Google Places

- **Descoberta**: script server-side busca por categoria/região via Places API e grava candidatos em `places` como não-parceiro por padrão, com `google_place_id`, coordenadas, nota, fotos.
- **Enriquecimento**: script casa os registros migrados da planilha (sem `google_place_id`) com resultados da Places API para preencher coordenadas/fotos/rating automaticamente.
- **Curadoria**: manual, direto no Supabase Studio — ajustar perfil-alvo/categoria/descrição, marcar `is_partner`, `partner_plan`, `partner_offer`.
- Nenhuma chamada à Places API acontece em tempo real durante a geração de um roteiro — mantém custo previsível e controle editorial total.

## Tratamento de erros e casos de borda

- **Poucos candidatos compatíveis**: a IA recebe instrução de preencher o slot com a opção mais próxima do perfil disponível em vez de deixar vazio; o backend loga a ocorrência como sinal para expandir o catálogo naquela combinação.
- **Falha na API do Claude**: retry automático simples; falha persistente mostra mensagem amigável pedindo nova tentativa, sem perder as respostas do quiz já salvas.
- **Google Places indisponível durante sync**: não afeta o usuário final, apenas atrasa a curadoria (processo assíncrono, offline do fluxo do usuário).

## Testes

- Testes automatizados para: lógica de filtragem/ranking/peso de parceiro (parte determinística mais crítica), parsing do JSON estruturado retornado pelo Claude, fluxo de navegação e validação do quiz (obrigatórias vs. opcionais).
- Qualidade da narrativa gerada pela IA é avaliada manualmente rodando perfis de exemplo antes de considerar a v1 pronta — não é algo testável automaticamente.

## Migração de dados existentes

- Planilha `floripa-me-banco-locais.xlsx` (abas "Banco de Locais", "Parceiros Floripa.me", "Eventos Anuais") é a semente inicial de `places`, `events` e dos campos de parceria — importada uma vez via script, depois mantida no Supabase Studio.
- Conteúdo/copy do quiz (perguntas, opções, textos) reaproveitado de `floripa-me-quiz_ULTIMO.html` sem alteração de substância, só de estilo visual.
- Lógica de categorias/gradientes por tipo de atividade do editor de roteiro anterior (`getCategoryGradient`) serve de referência para os ícones/cores de categoria no novo roteiro.
