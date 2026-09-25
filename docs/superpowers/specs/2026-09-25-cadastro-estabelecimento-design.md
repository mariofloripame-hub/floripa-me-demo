# Cadastro de estabelecimento (design)

## Purpose

Give establishments a self-service way to submit their business to Floripa.me instead of requiring manual data entry into Supabase for every new listing. A new public page lets an owner fill in their business details and photos; the submission lands in the existing `places` table as unverified, and the team reviews and approves it directly in the Supabase Table Editor (flipping `is_verified` to `true`) — the same review surface already used today.

## Non-goals

- **No authentication.** There is no login system anywhere in the app today (confirmed: no Supabase Auth, no NextAuth, no roles). This feature does not introduce one. The establishment cannot log back in to edit their listing — any edits after submission are done by the team directly in Supabase.
- **No admin UI.** Review/approval happens in the Supabase Table Editor, not a new `/admin` page. The team already agreed this is the preferred workflow for now.
- **No payment/subscription flow.** `partner_plan`, `partner_offer`, `partner_status` are unrelated to this form and are left untouched (null) on insert — they get set later, manually, once a paid plan is agreed with the establishment.
- **No email notifications.** The team will check Supabase periodically; an email-on-submission alert can be added later without changing this design.
- **No geocoding.** `lat`/`lng` are left null on self-signup rows; they're already nullable and unused by anything that would break (map pins for unverified places simply don't render until an admin backfills coordinates, same as any place lacking them today).

## Data model

New migration `supabase/migrations/0004_add_establishment_signup_fields.sql` adds contact columns to the existing `places` table (all nullable — no existing row or code path breaks):

```sql
alter table places add column contact_name text;
alter table places add column contact_email text;
alter table places add column contact_phone text;
alter table places add column submission_source text not null default 'admin';
```

`submission_source` defaults to `'admin'` so existing rows (all entered manually or via the Google Places enrichment script) are labeled consistently; new self-signup rows explicitly set it to `'self_signup'`. This lets the team filter "what came in through the public form" in the Table Editor without guessing from `is_verified` alone (a place can be manually re-verified and re-checked over time).

No other schema change is needed. Reused as-is from the current `places` schema: `name`, `category`, `price_range`, `point_type`, `short_description`, `address`, `neighborhood`, `region`, `opening_hours`, `phone`, `instagram`, `photos[]`, `is_verified` (explicitly set `false` on insert — note the column's own default is `true`, so the insert must set it, not rely on the default), `is_partner` (explicitly set `false`). `target_profiles[]` and `special_needs_tags[]` are left at their existing `'{}'` default; the team fills these in during review if relevant — they're curation metadata, not something a business owner can self-classify meaningfully.

`Place` TypeScript type (`src/lib/supabase/types.ts`) gains the three nullable contact fields and `submission_source: string`.

## Storage

New Supabase Storage bucket `establishment-photos`, created **private** (not public). Photos are uploaded to it only from the server (the API route below) using the existing service-role client — never directly from the browser — so a private bucket doesn't block the upload flow. After upload, the route generates a public URL for each stored file and saves those URLs into `photos[]`, matching how `photos[]` is already consumed by the rest of the app (rendered as plain `<img src>`).

No new environment variables are required — the API route reuses `getSupabaseAdminClient()` (`src/lib/supabase/client.ts`), which already holds `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, for both the Storage upload and the `places` insert.

## API route

New `POST /api/estabelecimentos/route.ts`, following the existing route pattern (`src/app/api/itineraries/route.ts`): parse the body, validate, call a small orchestrator function, map errors to status codes.

Request body: `multipart/form-data` (needed for file uploads) with the form fields below plus 0–6 image files under a `photos` field.

Steps performed server-side:

1. **Honeypot check** — a hidden field (e.g. `website`) that real users never fill in. If present and non-empty, respond `201` with a fake-success body but do nothing else (no insert, no upload) — indistinguishable from a real success to a bot, so it doesn't learn to adapt.
2. **Validate fields** with a Zod schema (`src/lib/estabelecimentos/schema.ts`), shared conceptually with the client-side form schema: `name`, `category` (enum from `CATEGORY_STYLES` keys in `src/lib/itinerary/mapIcons.ts`), `point_type`, `short_description`, `region` (enum: `Sul | Leste | Norte | Centro | Universitário`, matching `Coupon["region"]` in `src/lib/clube/coupons.ts`), `neighborhood`, `address`, `price_range` (enum: `Gratuito | R$ | R$$ | R$$$`), `opening_hours`, `phone`, `instagram` (optional), `contact_name`, `contact_email`, `contact_phone`. Invalid/missing required fields → `400` with a field-level error map the form can display inline.
3. **Validate photos** — up to 6 files, 5MB max each, MIME type must be `image/jpeg`, `image/png`, or `image/webp`. Violation → `400` before anything is uploaded.
4. **Upload photos** to `establishment-photos` (path `${randomUUID()}/${originalFilename}` to avoid collisions), collecting each public URL.
5. **Insert into `places`**: all validated fields plus `photos: uploadedUrls`, `is_verified: false`, `is_partner: false`, `submission_source: 'self_signup'`, `target_profiles: []`, `special_needs_tags: []`, `lat: null`, `lng: null`, `google_place_id: null`, `rating: null`, `notes: null`.
6. If the insert fails after photos were already uploaded, the route does **not** attempt to delete the orphaned files (Storage cleanup is not worth the added complexity for a low-volume form) — it just returns `502` and logs the error; an orphaned file with no matching `places` row is harmless and can be cleaned up later if it ever becomes worth doing.
7. Success → `201` with `{ ok: true }`. The form doesn't need the created row back — it just shows a confirmation screen.

## Frontend

New route `src/app/parceiros/cadastro/page.tsx`, a `"use client"` single page (no wizard/steps), styled with the project's existing Tailwind tokens (`graphite`/`turquoise`/`coral`), consistent with `/quiz` and `/clube`.

New dependency: `react-hook-form` + `@hookform/resolvers` (zod is already a dependency). This is the first form in the codebase to use a form library — justified here because the form has real client + server validation, file inputs with previews, and inline field errors, which plain `useState` handling (as in the `/quiz` wizard) would make noticeably messier.

Sections, in order, all on one scrollable page:

1. **Sobre o negócio** — `name`, `category` (select), `point_type` (text), `price_range` (select), `short_description` (textarea, short).
2. **Localização e contato público** — `region` (select), `neighborhood`, `address`, `phone`, `instagram`.
3. **Horário de funcionamento** — `opening_hours` (free text, same format already used elsewhere — no structured day/hour picker for v1).
4. **Fotos** — file input, up to 6 images, client-side preview thumbnails and client-side size/type check before submit (mirrors the server-side check, so users get instant feedback instead of waiting for a round trip).
5. **Seus dados de contato** — `contact_name`, `contact_email`, `contact_phone`. Labeled clearly as "not shown publicly — only for us to reach you during review."
6. Hidden honeypot field (visually hidden, not `display:none` alone — use an off-screen technique so screen readers/autofill don't flag it, but still name it something a bot script would plausibly autofill, e.g. `website`).

On submit: disable the button, show a loading state, `POST` as `FormData` to `/api/estabelecimentos`. On `400`, show field errors inline (map server error keys to form fields). On `201`, replace the form with a confirmation message ("Recebemos seu cadastro! Nossa equipe vai revisar e entrar em contato."). On network/`5xx` error, show a retryable error banner above the form (submitted data stays filled in, nothing is lost).

## Testing

- `src/lib/estabelecimentos/schema.ts` — unit tests for the Zod schema: valid payload passes; missing required field, invalid enum value, and malformed email each produce the expected error.
- `src/app/api/estabelecimentos/route.test.ts` (mirroring `src/app/api/itineraries/route.ts` conventions) — mocking `getSupabaseAdminClient()`:
  - valid submission uploads photos, inserts with `is_verified: false`/`is_partner: false`/`submission_source: 'self_signup'`, returns `201`.
  - honeypot filled → returns `201` but neither uploads nor inserts anything (assert the mocked client was never called).
  - invalid fields → `400` with error details, no upload/insert attempted.
  - oversized or wrong-MIME photo → `400`, no upload/insert attempted.
  - Storage upload failure → `502`, insert never attempted.
  - insert failure after successful upload → `502`.
- `src/app/parceiros/cadastro/page.test.tsx` (mirroring `src/app/quiz/page.test.tsx` conventions):
  - renders all sections with required fields.
  - submitting with missing required fields shows inline errors and does not call `fetch`.
  - successful submit (mocked `fetch` returning `201`) replaces the form with the confirmation message.
  - a `400` response surfaces the returned field errors inline.
  - a `5xx`/network error shows the retryable banner and preserves entered values.
