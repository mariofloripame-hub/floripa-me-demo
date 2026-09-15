import type { Place } from "@/lib/supabase/types";

// TEMPORARY, UI-preview only: these places are NOT real Floripa.me partners
// (is_partner stays false in the database). Lets us preview the "Outras
// opções parceiras" / "Estabelecimentos parceiros" sections with a realistic
// number of entries before actual partnerships are onboarded. Remove this
// file and the filter below once there are enough real partners.
//
// Kept to actual businesses (restaurants, bars, beach clubs) — a public
// beach or park can't run a "partner promotion", so tourist points are
// deliberately excluded even when a real place happens to be flagged
// is_partner (see EXCLUDED_NAMES below).
const SIMULATED_PARTNER_NAMES = new Set([
  "Bar do Arantes",
  "Ilha Formosa Restaurante e Pastelaria",
  "Makai Lagoa Café",
  "Posh Club",
  "P12 Parador Internacional",
  "Bistrô da Orla",
  "Restaurante do Moraes",
  "Artusi Ristorante",
  "Osli Restaurante",
  "Restaurante Lindacap",
]);

// Excluded even if is_partner is true in the database — tourist points, not
// businesses that could run a partner promotion.
const EXCLUDED_NAMES = new Set(["Praia do Campeche"]);

// Also UI-preview only: a subset of the simulated partners get a
// "Promoção exclusiva" badge (via the real `partner_offer` field, already
// wired into the partner UI) so the preview shows both cases. Never applied
// to a real partner — their `partner_offer` reflects whatever is actually
// in the database.
const EXCLUSIVE_PROMO_NAMES = new Set([
  "Bar do Arantes",
  "Ilha Formosa Restaurante e Pastelaria",
  "Makai Lagoa Café",
  "Posh Club",
  "P12 Parador Internacional",
  "Bistrô da Orla",
  "Artusi Ristorante",
  "Restaurante Lindacap",
]);

export function selectPartners(places: Place[]): Place[] {
  return places
    .filter((p) => !EXCLUDED_NAMES.has(p.name))
    .filter((p) => p.is_partner || SIMULATED_PARTNER_NAMES.has(p.name))
    .map((p) => (!p.is_partner && EXCLUSIVE_PROMO_NAMES.has(p.name) ? { ...p, partner_offer: "Promoção exclusiva" } : p));
}
