# Floripa.me v2

Floripa.me is a tourism app for Florianópolis: the user answers an 8-question quiz and receives, in a
few seconds, a personalized AI-generated itinerary (a warm welcome message plus a day-by-day plan of
beaches, food, sports, trails, and activities), built from a curated catalog of real places enriched
via the Google Places API. Partner establishments are surfaced more often but never exclusively. No
login is required — each generated itinerary gets a shareable slug.

## Commands

```bash
npm install       # install dependencies
npm run dev        # start the Next.js dev server
npm run test        # run the vitest suite
npm run build        # production build (Next.js)
npm run lint         # eslint
```

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (service_role secret — server-side only, never expose to the browser) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud console](https://console.cloud.google.com) → enable the Places API (New), create an API key (server-side only) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud console → enable the Maps JavaScript API, create a browser-restricted API key |

## First-time data setup

These steps were deliberately left manual (no live credentials during implementation) — run them once
against a real Supabase project before the app has real data to work with:

1. **Apply migrations**: `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply
   everything in `supabase/migrations/` (schema + Row Level Security).
2. **Seed places/events from the spreadsheet**: `npm run migrate:excel -- "<path-to-floripa-me-banco-locais.xlsx>"`.
3. **Enrich the catalog via Google Places**: `npm run places:discover` (find new establishments), then
   `npm run places:enrich` (fill in coordinates, photos, rating, hours for existing rows).
4. **Seed `sos_places` manually** via Supabase Studio — there is no script for this table yet.
5. **Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** (see table above) so the Mapa screen can render.

## Manual verification

Automated tests cover the deterministic logic (filtering, ranking, schema, generation orchestration,
navigation, editing). For the parts that need a real end-to-end pass through the app (a full run of the
quiz, checking that the generated itinerary reads well and references real places), see the
"Final manual verification" section at the end of
[`docs/superpowers/plans/2026-08-31-floripa-me-v2.md`](docs/superpowers/plans/2026-08-31-floripa-me-v2.md).
