# Hospedagem parceira no roteiro (design)

## Purpose

Add lodging (pousadas, hotéis, resorts) as a new kind of paying partner. Tourists who answer the quiz with **"Ainda não tenho hospedagem"** get, as the first card of their roteiro, one suggested partner lodging that fits their budget and the region of their roteiro, with a one-tap WhatsApp message asking for availability on their dates. Every tap is recorded so the lodging partner can see, in their panel, how many availability requests Floripa.My sent them — the number that sells the renewal.

Decisions made during brainstorming (2026-10-03 → 2026-10-06):

- **Curated, few and good:** the founder personally prospects ~10–12 lodgings across price tiers and regions (including high-end hotels/resorts). No bulk database, no OTA inventory.
- **No real-time availability in v1.** The lodging confirms availability itself over WhatsApp. iCal sync and the Booking.com affiliate fallback are later phases.
- **Lodging = new category `Hospedagem` in the existing `places` table** (approach A). Admin, photos, partner portal and billing are reused; no separate table.
- **Exact dates are asked on the card, not in the quiz.** The quiz keeps its length; only interested tourists fill dates.
- **Card shows 1 featured lodging + "Ver outras opções"** revealing up to 2 alternatives.
- **Region of the lodging follows the roteiro:** the roteiro is generated as today, then the lodging prefers the roteiro's dominant region.

## Non-goals (v1)

- Real availability by date (iCal from Booking/Airbnb) — later phase.
- Booking.com / Expedia affiliate links — later phase, after deciding with the accountant whose name the affiliate account goes under. Until then, no matching partner = no card.
- Courtesy code (cortesia) for lodgings — the courtesy flow is built for on-site consumption; hidden for `Hospedagem`.
- Lodging pin on the roteiro map.
- Using the lodging's location to shape the roteiro (roteiro is generated first, unchanged).
- Extra lodging fields in the public signup form (`/parceiros/cadastro`) — the category is selectable there, the admin fills the rest.
- Any change for tourists who answered another region, or for itineraries created before this feature.

## Quiz

No new questions. The existing option `region = "semhospedagem"` (`src/lib/quiz/questions.ts`, label "Ainda não tenho hospedagem") is the only trigger. Its copy stays ("Me indica uma pousada parceira!").

## Data model (migration `0006_hospedagem.sql`)

`places` — two nullable columns:

- `booking_whatsapp text` — WhatsApp number for reservations (often differs from the contact phone).
- `booking_url text` — the lodging's own booking page / booking engine / OTA listing.

`itineraries` — one nullable column:

- `lodging jsonb` — `{ "featured_id": uuid, "alternative_ids": uuid[] }`. Only ids are stored; the roteiro page loads the live rows (see "Rendering"). `null` = no lodging card (old itineraries, other quiz answers, or no eligible partner).

New table `lodging_leads`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `place_id` | uuid not null, fk `places(id)` on delete cascade | |
| `itinerary_slug` | text not null | |
| `channel` | text not null, check in (`'whatsapp'`, `'site'`) | |
| `check_in` | date null | |
| `check_out` | date null | |
| `guests` | int null | |
| `created_at` | timestamptz not null default `now()` | |

Index on `(place_id, created_at)`. RLS enabled with no public policies, same as the other tables: reads and writes go through server routes using the service-role client. No tourist personal data is stored.

`Hospedagem` is added to `CATEGORY_STYLES` (`src/lib/itinerary/mapIcons.ts`) with its own icon/color, which makes it appear in `CATEGORY_OPTIONS` for both the admin and the public signup form.

## Eligibility and selection

A place is an **eligible lodging** when: `category = 'Hospedagem'` **and** `is_partner` **and** `is_verified` **and** (`booking_whatsapp` or `booking_url` is non-empty). `target_profiles` is not used for lodgings.

Lodgings are **never** roteiro activities: `filterCandidates` excludes `category = 'Hospedagem'`, and so do the swap/add options (`src/lib/itinerary/swapOptions.ts`).

Selection runs in `createItinerary` **after** the days are assembled, only when `quiz_answers.region === "semhospedagem"`. It is a pure function `selectLodging(places, answers, days, random)`:

1. **Dominant region** = the most frequent `region` among the roteiro's activities (case-insensitive). Ties → no preference among the tied regions (any of them counts as a match). No activities with a region → no preference.
2. **Tier order by budget** (unanswered budget is treated as `medio`):

   | budget | 1st tier | 2nd tier |
   |---|---|---|
   | `economico` | `R$` | `R$$` |
   | `medio` | `R$$` | `R$` |
   | `alto` | `R$$$` | `R$$` |

   Lodgings with other price ranges (including `Gratuito` or empty) are never picked.
3. **Order** the eligible lodgings: 1st tier region-match, 1st tier others, 2nd tier region-match, 2nd tier others; shuffled with `random` inside each group (fair rotation between partners).
4. `featured_id` = first; `alternative_ids` = next up to 2. Empty list → `lodging = null`.

The selection is done once at creation and saved, so reopening the link shows the same lodging.

## Rendering (roteiro page)

When `itinerary.lodging` is set, the roteiro page loads the live `places` rows for `featured_id` + `alternative_ids` and keeps only those still eligible. If the featured one is no longer eligible, the first surviving alternative becomes featured. None left → no card.

### Card "Onde ficar"

Placed at the top of the roteiro, before Day 1, with a visual distinct from activity cards:

- Photo, name, neighborhood, price range, Google rating, badge **"Indicado pelo Floripa.My"**.
- `partner_offer` shown highlighted when present (e.g. "10% off reservando pelo Floripa.My").
- Tapping the card body opens the existing `EstablishmentModal`.
- **Entrada / Saída:** native `<input type="date">`. `min` = today; Saída must be after Entrada. Both empty is valid; exactly one filled shows an inline error ("Preencha a data de saída" / "…de entrada") and blocks the buttons.
- **Hóspedes:** stepper 1–20, default from `group`: solo 1, casal 2, família 3, amigos 4 (unanswered → 2).
- **Primary button "Consultar disponibilidade"** (only if `booking_whatsapp`): opens `https://wa.me/<number>?text=<message>`.
  - Number: digits only; if it has 10–11 digits (BR without country code), prefix `55`.
  - With dates: `Olá! Encontrei vocês no Floripa.My. Vocês têm disponibilidade de 12/01 a 15/01 para 2 pessoas?`
  - Without dates: `Olá! Encontrei vocês no Floripa.My. Gostaria de saber sobre disponibilidade para 2 pessoas.`
  - 1 guest → "1 pessoa".
- **Secondary button "Reservar pelo site"** (only if `booking_url`). If there is no WhatsApp, it becomes the primary button.
- **"Ver outras opções"** (only if alternatives exist): expands compact rows (photo, name, neighborhood, price range). Tapping one makes it the featured card (client-side only; not persisted).
- **"Já resolvi minha hospedagem"**: hides the card on this device (`localStorage` key per slug, wrapped in try/catch; card shows if storage fails).
- No courtesy button on this card.

### Lead recording

Buttons are real `<a target="_blank">` links (so the WhatsApp/site opens even on slow networks and is not popup-blocked). On click, the client fires `POST /api/lodging-leads` with `fetch(..., { keepalive: true })`: `{ slug, place_id, channel, check_in, check_out, guests }`.

The route validates the body (zod), checks that `place_id` is the featured or an alternative of that itinerary's `lodging`, and inserts into `lodging_leads`. Invalid → 400, silently ignored by the client. Tracking failure never blocks the link.

## Admin

`AdminPlaceForm` (create and edit): when category is `Hospedagem`, show:

- **WhatsApp para reservas** — on create, pre-filled from the contact phone; editable.
- **Link de reserva (opcional)** — must be a valid `http(s)` URL when filled.
- Hint under price range: "Hospedagem: R$ até 300/diária · R$$ 300–700 · R$$$ acima de 700".

`adminPlaceFieldsSchema` and the admin POST/PATCH routes accept and save `booking_whatsapp` and `booking_url`. For other categories, the fields are hidden and saved as `null`.

## Partner panel

For a partner whose place is `Hospedagem`:

- New metric **"Pedidos de disponibilidade"**: count of `lodging_leads` this month vs last month (same period logic as the existing panel), with a split WhatsApp / site.
- Courtesy blocks (codes, offer upsell tied to courtesy) are hidden.

Other partners' panels are unchanged.

## Testing

Unit tests (vitest):

- `selectLodging`: tier order per budget, unanswered budget = médio, region preference and ties, never picks wrong tiers / `Gratuito`, ineligible places ignored (not partner, not verified, no contact), at most 1 + 2, empty → null, deterministic with an injected `random`.
- `filterCandidates` / swap options never return `Hospedagem`.
- WhatsApp link builder: number normalization, message with/without dates, date format `dd/MM`, singular/plural guests, URL encoding.
- Date validation (one date only, Saída ≤ Entrada, past dates).
- Lead route schema: rejects unknown channel, place not in the itinerary's lodging.
- Admin schema: invalid booking URL rejected; fields nulled for non-lodging categories.

Visual check with local demo data (no DB writes): card on mobile and desktop, light theme; "Ver outras opções" open; lodging without booking link; lodging without WhatsApp.

End-to-end in the founder's environment after the migration: create one test lodging in the admin, take the quiz with "Ainda não tenho hospedagem", tap the button, confirm the lead appears in that partner's panel, then delete the test data.
