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
  "Bar do Vadinho",
  "Maré Pizzaria",
  "Entre Mares Sushi",
  "Marquês da Lagoa",
  "Freguesia Bar",
  "Donna Beach Club",
  "Atôa na Jôa",
  "Café Cultura - Lagoa",
  "Krone Café & Padaria",
  "Barco Pirata",
  "Sea Wolf Surf School - Campeche",
]);

// Excluded even if is_partner is true in the database — tourist points, not
// businesses that could run a partner promotion.
const EXCLUDED_NAMES = new Set(["Praia do Campeche"]);

// Also UI-preview only: a subset of the simulated partners get a specific,
// varied offer (via the real `partner_offer` field, already wired into the
// partner UI) so the preview shows both cases and doesn't repeat the same
// generic text for every card. Never applied to a real partner — their
// `partner_offer` reflects whatever is actually in the database.
const EXCLUSIVE_PROMO_OFFERS: Record<string, string> = {
  "Bar do Arantes": "Chopp em dobro até as 20h",
  "Ilha Formosa Restaurante e Pastelaria": "10% de desconto na conta",
  "Makai Lagoa Café": "Sobremesa grátis na compra de 2 pratos",
  "Posh Club": "Entrada grátis para casais até 23h",
  "P12 Parador Internacional": "15% de desconto em bebidas",
  "Bistrô da Orla": "Couvert grátis",
  "Artusi Ristorante": "Taça de vinho grátis na compra de um prato principal",
  "Restaurante Lindacap": "Batata frita grátis na compra de um prato selecionado",
  "Maré Pizzaria": "Pizza broto doce grátis na compra de uma grande",
  "Entre Mares Sushi": "Temaki em dobro às terças",
  "Donna Beach Club": "Welcome drink na chegada",
  "Café Cultura - Lagoa": "Pão de queijo grátis com qualquer café",
  "Barco Pirata": "Crianças até 10 anos não pagam",
  "Sea Wolf Surf School - Campeche": "20% de desconto na primeira aula",
};

function stripContactInfo(p: Place): Place {
  const { contact_name, contact_email, contact_phone, ...rest } = p;
  void contact_name;
  void contact_email;
  void contact_phone;
  return rest;
}

export function selectPartners(places: Place[]): Place[] {
  return places
    .filter((p) => p.is_verified)
    .filter((p) => !EXCLUDED_NAMES.has(p.name))
    .filter((p) => p.is_partner || SIMULATED_PARTNER_NAMES.has(p.name))
    .map((p) => (!p.is_partner && EXCLUSIVE_PROMO_OFFERS[p.name] ? { ...p, partner_offer: EXCLUSIVE_PROMO_OFFERS[p.name] } : p))
    .map(stripContactInfo);
}

// Every verified place, safe to send to the browser — feeds the "⇄ Trocar"
// sheet, which suggests alternatives from the whole catalogue, not just
// partners.
export function selectPublicPlaces(places: Place[]): Place[] {
  return places.filter((p) => p.is_verified).map(stripContactInfo);
}
