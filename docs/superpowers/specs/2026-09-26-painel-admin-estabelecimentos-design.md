# Painel de administração de estabelecimentos (design)

## Purpose

Give the team a visual way to manage every row in `places` — approve or reject pending self-signups (`/parceiros/cadastro`), create a listing directly, edit any field, manage photos, and delete a listing — instead of doing all of that through the Supabase Table Editor. This closes the loop opened by the establishment self-signup feature (`2026-09-25-cadastro-estabelecimento-design.md`): that feature deliberately left review/approval to the Table Editor as a stopgap; this feature replaces that stopgap with a real internal tool.

## Non-goals

- **No per-user accounts.** A single shared password protects the whole panel — there's no way to tell which team member (Mario, Gabriel, Lucas) made a given change. Real per-user login is a bigger feature (see below) and isn't needed yet for a two-to-three-person team.
- **No partner-facing self-service portal.** The business owner cannot log in themselves to edit their own listing. That would need real per-user authentication (Supabase Auth) plus an `owner_id` column linking a `places` row to a specific account — a distinct, larger feature. This panel's data model and edit form are designed so that future feature can reuse both, but building it is explicitly out of scope here.
- **No analytics (views/clicks).** Tracking how often a listing is shown or clicked requires a new events table and instrumenting every place of the app that renders a place card — unrelated in shape to this CRUD/approval panel. Deliberately deferred to its own future spec.
- **No soft-delete / recovery.** Deleting a listing in the panel removes the row from `places` permanently. No "trash" or undo.
- **No Storage cleanup.** Removing a photo from a listing (in the edit form) only drops its URL from `photos[]`; the file stays in the `establishment-photos` bucket. Same call already made for the self-signup feature — storage is cheap at this volume, and building cleanup isn't worth it yet.
- **No changes to the public site's rendering** beyond what's needed to expose the `partner_offer` field for editing (the column and its consumption in `selectPartners`/UI already exist from the self-signup feature and earlier "simulated partners" work).

## Access control

The app has no authentication anywhere. A panel that can edit and delete real data cannot be left open, so this feature adds the app's first access gate — deliberately the smallest one that actually protects the data, not a full account system:

- A new environment variable `ADMIN_PASSWORD` holds a single shared password (never committed; added to `.env.local` and `.env.local.example` as a blank placeholder like the existing keys).
- `POST /api/admin/login` takes `{ password }`, compares it to `ADMIN_PASSWORD` (constant-time comparison via `crypto.timingSafeEqual`, so response timing can't leak the password character-by-character), and on match sets a cookie `floripa_admin_session` whose value is `sha256(ADMIN_PASSWORD)` hex digest — a token any legitimate visitor's browser can hold, but that nobody can forge without knowing the password, since only the server can compute what the correct hash is. The cookie is `httpOnly`, `sameSite: "lax"`, and expires after 30 days.
- `POST /api/admin/logout` clears the cookie.
- `src/middleware.ts` intercepts every request to `/admin/*` (except `/admin/login`) and `/api/admin/*` (except `/api/admin/login`), recomputes `sha256(ADMIN_PASSWORD)`, and compares it to the request's cookie. A page request without a valid cookie redirects to `/admin/login`; an API request without one gets `401 { error: "Não autenticado" }`.
- This is not the mechanism a future partner self-service portal would use (that needs real per-owner accounts) — it only proves "this browser knows the team's shared password."

## Data model

No new tables. Two additions to the existing `places` table's usage:

- `partner_offer` (already exists, currently only written by the "simulated partners" demo hack in `src/lib/itinerary/simulatedPartners.ts`) becomes a real, admin-editable field — free text like "Chopp em dobro até as 20h".
- `partner_status` (already exists as free text) becomes a fixed set of choices in the admin form, to keep it consistent over time:

```ts
export const PARTNER_STATUS_OPTIONS = [
  { value: "", label: "Nenhum" },
  { value: "cortesia", label: "Cortesia" },
  { value: "pago", label: "Pago" },
] as const;
```

(The column itself stays a plain `text` — no migration needed. The fixed choices are enforced only in the form, same way `price_range`'s enum is enforced by Zod rather than a DB constraint change.)

`partner_plan` stays free text (e.g. "Mensal", "Anual") — no fixed list, since plan names will likely change before this needs tightening.

## Admin field set vs. the public form's schema

The public signup form's schema (`establishmentFieldsSchema`, from the self-signup feature) requires `contact_name`/`contact_email`/`contact_phone` — those exist so the team can reach whoever submitted the form. When the admin creates or edits a listing directly, that contact is optional (there may be no separate "submitter" at all). A new `src/lib/estabelecimentos/adminSchema.ts` defines `adminPlaceFieldsSchema`: the same business fields as the public schema (reusing its `CATEGORY_OPTIONS`/`REGION_OPTIONS`/`PRICE_RANGE_OPTIONS` constants so the two never drift apart), with `contact_name`/`contact_email`/`contact_phone` optional, plus the admin-only fields: `partner_offer` (optional text), `is_verified` (boolean), `is_partner` (boolean), `partner_status` (one of `PARTNER_STATUS_OPTIONS`), `partner_plan` (optional text).

## API

All routes below live under `/api/admin/` and require the session cookie (enforced by middleware, so route handlers don't re-check it).

- **`GET /api/admin/places`** — returns every row (reuses `listPlaces`), for the list page.
- **`POST /api/admin/places`** — creates a listing. Accepts `multipart/form-data` (fields per `adminPlaceFieldsSchema`, plus 0–6 photo files under `photos`, validated with the same `validatePhotos`/`MAX_PHOTOS`/`MAX_PHOTO_SIZE_BYTES` rules as the public form) — a single-step submission, matching how the public form already works, so an admin doesn't have to save once to get an id and then add photos in a second step. Inserts with `submission_source: "admin"`, `target_profiles: []`, `special_needs_tags: []`, `lat/lng/google_place_id/rating/notes: null` (same as self-signup) but `is_verified`/`is_partner`/`partner_status`/`partner_offer`/`partner_plan` taken directly from the form instead of hardcoded.
- **`GET /api/admin/places/[id]`** — fetch one (reuses `getPlaceById`), to prefill the edit form.
- **`PATCH /api/admin/places/[id]`** — JSON body, partial update of any `adminPlaceFieldsSchema` field plus `photos` (a plain `string[]` — the *complete* desired list, so removing a photo is just omitting its URL here). Used both by the full edit form's "Salvar" button and by the list page's one-click "Aprovar" action (`{ is_verified: true }` alone).
- **`DELETE /api/admin/places/[id]`** — deletes the row. New `deletePlace(client, id)` query helper (mirrors the existing `getPlaceById`/`updatePlaceEnrichment` shape in `src/lib/supabase/queries.ts`).
- **`POST /api/admin/places/[id]/photos`** — multipart, 1+ files under `photos`; uploads each (reusing the upload logic factored out of `submitEstablishment.ts` into a shared `src/lib/estabelecimentos/uploadPhotos.ts`, so the public and admin paths can't drift), appends the resulting URLs to the row's existing `photos[]`, returns the updated array. The edit form calls this immediately when the admin picks new files, rather than staging them client-side — so a page refresh mid-edit never loses an upload.

Removing a photo in the edit form is purely a client-side array filter followed by the normal `PATCH .../[id]` save (sending the reduced `photos` array) — no separate delete-photo endpoint.

## Frontend

- **`src/app/admin/login/page.tsx`** — a password field and a submit button, styled like the rest of the site (`bg-sand`, `text-teal-ink`, reusing `Button`). Posts to `/api/admin/login`; on success, redirects to `/admin`; on `401`, shows "Senha incorreta."
- **`src/app/admin/page.tsx`** — server component. Fetches all places via `getSupabaseAdminClient()` + `listPlaces`, splits them into four tabs (client component `<PlacesTabs>` holding the active-tab state): **Pendentes** (`!is_verified`), **Aprovados** (`is_verified && !is_partner`), **Parceiros** (`is_partner`), **Todos**. Each row shows name, category, region/neighborhood, and status badges, plus: an "Aprovar" button (pending rows only — `PATCH { is_verified: true }`, optimistically updates the list), an "Editar" link to `/admin/estabelecimentos/[id]`, and an "Excluir" button (confirms via a native `confirm()` before calling `DELETE`).
- **`src/app/admin/estabelecimentos/novo/page.tsx`** — renders `<AdminPlaceForm mode="create">`.
- **`src/app/admin/estabelecimentos/[id]/page.tsx`** — server component, fetches the place via `getPlaceById`, renders `<AdminPlaceForm mode="edit" place={place}>`; `notFound()` if missing.
- **`src/components/admin/AdminPlaceForm.tsx`** — the shared form (client component), `react-hook-form` + `zodResolver(adminPlaceFieldsSchema)`, mirroring the public form's field layout (same sections: Sobre o negócio, Localização e contato, Horário) plus new sections **Parceria** (is_partner toggle, partner_status select, partner_plan text, partner_offer textarea — shown only when `is_partner` is checked) and **Fotos** (existing thumbnails with a "×" to remove each, a file input that immediately `POST`s to `.../photos` and appends the returned URLs to the thumbnail list) and an **Aprovação** toggle (`is_verified`). In create mode, photos are attached to the same multipart submission instead of the immediate-upload flow (there's no id to upload against yet).
- **`src/middleware.ts`** — the cookie check described above. The actual "is this cookie valid" comparison is a plain exported function (`isValidAdminSession(cookieValue: string | undefined): boolean`) in `src/lib/adminAuth.ts`, so it can be unit-tested directly instead of only through the Next.js middleware runtime.

## Testing

- `src/lib/adminAuth.ts` — unit tests for `isValidAdminSession` (correct hash passes, wrong/missing/empty value fails) and the login route's password comparison.
- `src/lib/estabelecimentos/adminSchema.ts` — unit tests mirroring `schema.test.ts`'s coverage, focused on what differs: contact fields optional, `partner_status` enum, `is_verified`/`is_partner` booleans.
- `src/lib/estabelecimentos/uploadPhotos.ts` — unit test (extracted from the existing `submitEstablishment.test.ts` coverage of upload success/failure/partial-batch-failure, now shared).
- Each new API route (`/api/admin/login`, `/api/admin/places`, `/api/admin/places/[id]`, `/api/admin/places/[id]/photos`) gets a `route.test.ts` mirroring the existing `/api/estabelecimentos/route.test.ts` conventions: mocked Supabase client, success/validation-failure/not-found/unexpected-error cases. Route tests assume the request already carries a valid session cookie — middleware's own gating is tested separately (below) — except the login route, which is the one route that legitimately handles the no-cookie case itself.
- Middleware: since `isValidAdminSession` is a plain function, `middleware.ts` itself stays thin enough that its own test just checks it calls that function and redirects/401s correctly for a fake `NextRequest` — mirroring how `route.test.ts` files mock away lower-level logic to test only the glue.
- `src/app/admin/page.tsx` / `PlacesTabs` component tests: renders the four tabs with correct counts, "Aprovar" calls the PATCH endpoint and removes the row from Pendentes, "Excluir" calls DELETE after confirmation.
- `src/components/admin/AdminPlaceForm.tsx` tests: create mode submits multipart with photos; edit mode prefills from `place`, removing a photo drops it from the save payload, the Parceria section only shows its sub-fields when `is_partner` is checked.
