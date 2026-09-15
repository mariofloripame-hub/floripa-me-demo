import type { Place } from "@/lib/supabase/types";

// TEMPORARY, UI-preview only: these places are NOT real Floripa.me partners
// (is_partner stays false in the database). Lets us preview the "Outras
// opções parceiras" / "Estabelecimentos parceiros" sections with a realistic
// number of entries before actual partnerships are onboarded. Remove this
// file and the filter below once there are enough real partners.
const SIMULATED_PARTNER_NAMES = new Set([
  "Bar do Arantes",
  "Trilha do Saquinho",
  "Ilha Formosa Restaurante e Pastelaria",
  "Makai Lagoa Café",
  "Mercado Público",
  "Parque da Luz",
  "Posh Club",
  "P12 Parador Internacional",
  "Bistrô da Orla",
  "Praia de Itaguaçu",
]);

// Also UI-preview only: a subset of the simulated partners get a
// "Promoção exclusiva" badge (via the real `partner_offer` field, already
// wired into the partner UI) so the preview shows both cases. Never applied
// to a real partner — their `partner_offer` reflects whatever is actually
// in the database.
const EXCLUSIVE_PROMO_NAMES = new Set([
  "Bar do Arantes",
  "Trilha do Saquinho",
  "Ilha Formosa Restaurante e Pastelaria",
  "Makai Lagoa Café",
  "Mercado Público",
  "Posh Club",
  "P12 Parador Internacional",
  "Bistrô da Orla",
]);

export function selectPartners(places: Place[]): Place[] {
  return places
    .filter((p) => p.is_partner || SIMULATED_PARTNER_NAMES.has(p.name))
    .map((p) => (!p.is_partner && EXCLUSIVE_PROMO_NAMES.has(p.name) ? { ...p, partner_offer: "Promoção exclusiva" } : p));
}
