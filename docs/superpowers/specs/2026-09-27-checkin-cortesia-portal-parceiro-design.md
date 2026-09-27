# Check-in por cortesia + Portal do Parceiro — Fase 1 (design)

## Purpose

Give a paying partner (persona: Carlos, cautious restaurant owner who wants proof of ROI) **first-hand proof that customers came through Floripa.my**. The proof is created by the partner's own hands: a tourist generates a courtesy code in their roteiro, shows it at the counter, and the partner's staff validates it in a partner portal. Each validation counts as one confirmed visit. The portal also shows cheaper "interest" metrics so partners without an offer still see value — and are nudged to add one.

Decisions made during brainstorming (2026-09-27):

- Main goal is ROI proof for the partner (not coupon control, gamification or product analytics).
- **No tourist signup.** The tourist gets a code anonymously; the partner validates it.
- **Offer is optional but allowed on every plan** (Essencial, Destaque, Premium). Partners without an offer only see interest metrics plus an upsell block. Sales pitch should treat the courtesy as the default.
- **Partner login = one account per establishment via magic link** (Supabase Auth), recognized by the place's existing `contact_email`. Session lasts months on the counter device.
- **Partner edits their own offer; the founder approves it in `/admin`** before it goes live.
- Tourist can generate the code **any time from the roteiro** (no geolocation).
- A physical counter display (acrylic stand) is part of the go-to-market: front side for customers ("Tem cortesia Floripa.my aqui"), back side for staff with a QR to `/parceiro/validar`. The QR is a **shortcut, not a key** — it never logs anyone in by itself.

## Non-goals (Fase 1)

- **Clube Local** — shelved for the MVP; its coupons are not integrated.
- **Click/view tracking** ("Ver no Maps", "Ligar", "Reservar", roteiro opens) — Fase 2, needs an events table and instrumentation.
- **Segment benchmark / "acima da média" alert** — meaningless (and leaks competitor numbers) until ~15–20 partners per segment.
- **Export, Plano & Fatura, Configurações, period selector (7/30/90)** — panel uses "este mês vs mês anterior".
- **Geolocation, NFC** (NFC is just printed material, no system change), **monthly email report**, **multiple accounts or multiple places per email** (chains).
- **Offer start/end dates** — "offer is live" means `partner_offer` is non-empty.

## Tourist flow (roteiro)

- On the activity card (`DayCard.tsx`), a button **"Resgate sua cortesia"** appears **only if the place currently has a live offer**. Visibility must use the *live* `places.partner_offer`, not the `partner_offer` snapshot copied into the itinerary's `days` JSON at creation — so the roteiro page loads live offers for the itinerary's place ids.
- The hardcoded `EXCLUSIVE_OFFER_PLACES` set in `DayCard.tsx` is replaced by the live-offer check.
- Tapping opens a sheet showing: the offer text, the code in large type (e.g. `FMY-4K7P`), "Mostre este código no balcão", and validity ("válido até amanhã, 14h30 · uso único").
- **Code format:** `FMY-` + 4 characters from an alphabet without ambiguous characters (no `0 O 1 I L`). Unique among non-expired codes.
- **Validity:** 24h from creation, single use.
- **Idempotent per device/place/day:** tapping again while a non-expired, unused code exists for the same device + place returns the same code.
- **Anonymous device id:** random id generated and kept in `localStorage`, sent when generating a code. Used only for the rule above.
- The generated code is cached in `localStorage` so it still shows with bad signal at the venue.
- After validation, the sheet shows "✓ Cortesia usada em DD/MM".

## Partner portal

### `/parceiro/entrar`
- Email field → "Enviamos um link de acesso para seu e-mail."
- Same message whether or not the email belongs to a partner (don't reveal who is a partner), plus "Não recebeu? Fale com a gente no WhatsApp".
- Magic link only sent if the email matches a partner place's `contact_email` (checked server-side).
- A logged-in session maps to exactly one place: the partner place whose `contact_email` equals the session email. Email match is case-insensitive.

### `/parceiro/validar` (target of the display QR)
- Not logged in → redirect to `/parceiro/entrar`, returning to `/parceiro/validar` after login.
- Large input; accepts lowercase and with or without `FMY-`.
- **Two steps:** (1) check → "✅ Código válido: **<offer text>**"; (2) **Confirmar entrega** → marks the code redeemed; only then does the visit count.

| Situation | Message |
|---|---|
| Not found / typo | "Código não encontrado. Confira as letras com o cliente." |
| Already used | "Este código já foi usado em DD/MM às HHhMM." |
| Expired | "Código expirado. Peça ao cliente para gerar um novo no app." |
| Belongs to another place | "Este código é de outro estabelecimento." |
| Offer removed after code was generated | Code **still valid** until it expires. |
| Offer text changed after code was generated | The snapshot text from generation time is shown and honored. |

Confirming must be atomic (a code can't be redeemed twice by concurrent requests).

### `/parceiro` (painel)
- Header: place name + plan badge (from `partner_plan`), upgrade card (static copy).
- **Visitas confirmadas:** count this month, delta vs last month, visits per day chart, list of latest visits (date, time, offer).
- **Taxa de conversão:** confirmed visits ÷ roteiros the place appeared in (this month).
- **Perfil dos visitantes:** breakdown by `quiz_answers.group` (casal/família/amigos/solo) of roteiros whose codes were validated — i.e. who actually came.
- **Interesse:** "Seu estabelecimento apareceu em X roteiros este mês" + appearances per day.
- **Roteiros recentes:** latest roteiros containing the place, shown anonymously from `quiz_answers` ("Casal · 3 dias · Gastronomia & Praia · há 14 min"), with "✓ Cortesia resgatada" when a code from that roteiro was redeemed at this place.
- **Minha cortesia:** shows the live offer and a pending one if any ("Aguardando aprovação"); partner can submit a new offer text (max 120 chars) or request removal.
- **No live offer and no redeemed codes ever:** the visits block is replaced by the upsell — "Ative uma cortesia e veja quantos clientes vieram pelo Floripa.my" — leading to the offer form. If there is no live offer but past visits exist, the visits block stays and the upsell shows as a banner above it.
- Logout button.

"Month" means calendar month in `America/Sao_Paulo`.

## Offer approval (admin)

- Partner submission writes `pending_offer` (+ `pending_offer_submitted_at`); the live `partner_offer` is untouched.
- An empty submission means "remove my offer" (pending removal).
- `/admin` shows places with a pending offer (badge/filter on the partners tab) and, in the place form, the pending text with **Aprovar** (copies to `partner_offer`, clears pending) and **Recusar** (clears pending).

## Data model

Migration `0005_checkin_cortesia.sql`:

- `places`: add `pending_offer text`, `pending_offer_submitted_at timestamptz`.
- New table `courtesy_codes`:
  - `id uuid pk`, `code text not null`, `place_id uuid not null references places(id) on delete cascade`, `itinerary_id uuid references itineraries(id) on delete set null`, `device_id text not null`, `offer_text text not null` (snapshot), `created_at timestamptz default now()`, `expires_at timestamptz not null`, `redeemed_at timestamptz`, `redeemed_by uuid` (auth user id).
  - Indexes: unique `code`; `(place_id, redeemed_at)`; `(device_id, place_id, created_at)`.
  - Codes are never reused (unique across all rows) — the 4-char space (~810k with a 30-char alphabet) is ample at this volume; generation retries on collision.
- RLS enabled, no policies (same pattern as `0002_enable_rls.sql`); all access through the server with the service-role client.

**Appearances in roteiros** are computed from `itineraries.days` JSON (activities carry `place_id`) with a Postgres function, e.g. `place_appearances(place_id, from, to)`, returning roteiros containing the place in their **current** state (if the tourist swapped the place out, it no longer counts). No sync table; revisit only if it gets slow.

## Server endpoints

- `POST /api/cortesia` — `{ placeId, itinerarySlug, deviceId }` → `{ code, offerText, expiresAt }`. Fails if the place has no live offer. Returns the existing code when the idempotency rule applies.
- `GET /api/cortesia/[code]?deviceId=` — status for the tourist sheet (active / used + date / expired).
- `POST /api/parceiro/login` — sends the magic link (Supabase Auth OTP) when the email is a partner's.
- `GET /parceiro/auth/callback` — completes the Supabase session.
- `POST /api/parceiro/validar` — `{ code }` → check result (no side effects).
- `POST /api/parceiro/confirmar` — `{ code }` → atomic redeem (`update … where redeemed_at is null and expires_at > now() and place_id = <session place>`).
- `POST /api/parceiro/oferta` — `{ text }` → sets pending offer.
- `POST /api/admin/places/[id]/oferta` — `{ action: "aprovar" | "recusar" }` (behind existing admin middleware).
- Middleware protects `/parceiro/*` (except `/parceiro/entrar` and the callback) and `/api/parceiro/*` (except login) with the Supabase session.

Dependency: `@supabase/ssr` for cookie-based Supabase Auth sessions in Next.js.

## Setup the founder does (click-by-click guide to be provided)

- Supabase dashboard: enable Email (magic link) provider, set Site URL and redirect URL (`/parceiro/auth/callback`) for local and Vercel domains, set a long session lifetime.
- Before real rollout: custom SMTP (e.g. Resend) because Supabase's default email sender is heavily rate-limited.
- Each partner place needs its `contact_email` filled in `/admin`.

## Testing

- **Unit (Vitest):** code generation (format, alphabet, collision retry); normalization of typed input; validation states (valid, used, expired, other place, offer removed/changed); atomic confirm; idempotent generation; dashboard aggregations (month in São Paulo timezone, deltas, conversion, group breakdown); offer approval transitions; button visibility only with a live offer.
- **Route tests** following existing `route.test.ts` patterns, including auth rejection for `/api/parceiro/*`.
- **Visual verification with screenshots** (mobile + desktop): card button, code sheet, validar screen (each state), painel with and without offer, admin approval UI.
- **Manual end-to-end with the founder:** generate a code in a real roteiro → log in to the portal via magic link → validate → see the visit in the painel.

## Fase 2 (future spec)

Event tracking for views and clicks ("Ver no Maps", "Ligar", "Reservar") to enrich **Interesse**, "Clicou no Maps" status in Roteiros recentes; later benchmark, period selector, export.
