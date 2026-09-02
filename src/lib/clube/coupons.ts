export type ClubePlanId = "local" | "local+";

export interface ClubePlan {
  id: ClubePlanId;
  name: string;
  priceLabel: string;
  couponsPerMonth: number;
  description: string;
}

export type CouponRegion = "Sul" | "Leste" | "Norte" | "Centro" | "Universitário";
export type CouponCategory = "Gastronomia" | "Passeios" | "Bares" | "Compras" | "Bem-estar";

export interface Coupon {
  id: string;
  name: string;
  neighborhood: string;
  region: CouponRegion;
  category: CouponCategory;
  offer: string;
  icon: string;
}

export const PLANS: ClubePlan[] = [
  { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" },
  { id: "local+", name: "Local+", priceLabel: "R$34,90", couponsPerMonth: 6, description: "6 cupons por mês" },
];

export const COUPONS: Coupon[] = [
  { id: "ostradamus", name: "Ostradamus", neighborhood: "Ribeirão da Ilha", region: "Sul", category: "Gastronomia", offer: "30% off no prato principal", icon: "🦪" },
  { id: "bar-do-arantes", name: "Bar do Arantes", neighborhood: "Pântano do Sul", region: "Sul", category: "Gastronomia", offer: "Entrada grátis a cada 2 pratos", icon: "🐟" },
  { id: "surfoco", name: "Surfoco", neighborhood: "Campeche", region: "Sul", category: "Passeios", offer: "15% off na conta", icon: "🏄" },
  { id: "paradoxo-fermentacao", name: "Paradoxo de Fermentação", neighborhood: "Campeche", region: "Sul", category: "Bares", offer: "2ª cerveja por R$1", icon: "🍺" },
  { id: "via-gastronomica-coqueiros", name: "Via Gastronômica Coqueiros", neighborhood: "Continente", region: "Centro", category: "Gastronomia", offer: "Petisco cortesia", icon: "🌊" },
  { id: "shopping-iguatemi", name: "Shopping Iguatemi", neighborhood: "Santa Mônica", region: "Centro", category: "Compras", offer: "10% off em loja parceira", icon: "🛍️" },
  { id: "studio-bem-estar-trindade", name: "Studio Bem-Estar Trindade", neighborhood: "Trindade", region: "Universitário", category: "Bem-estar", offer: "1ª sessão com 30% off", icon: "🧘" },
  { id: "spa-carvoeira", name: "Spa Carvoeira", neighborhood: "Carvoeira", region: "Universitário", category: "Bem-estar", offer: "20% off em massagem", icon: "💆" },
];

export interface FilterOption {
  value: string;
  label: string;
  icon: string;
  count: number;
}

const REGION_ICONS: Record<CouponRegion, string> = {
  Sul: "🌴",
  Leste: "🌊",
  Norte: "🌴",
  Centro: "🏛️",
  Universitário: "🎓",
};

const CATEGORY_ICONS: Record<CouponCategory, string> = {
  Gastronomia: "🍽️",
  Passeios: "🎢",
  Bares: "🍹",
  Compras: "🛍️",
  "Bem-estar": "💆",
};

export function regionOptions(coupons: Coupon[]): FilterOption[] {
  const regions = [...new Set(coupons.map((c) => c.region))];
  return regions.map((region) => ({
    value: region,
    label: region,
    icon: REGION_ICONS[region],
    count: coupons.filter((c) => c.region === region).length,
  }));
}

export function categoryOptions(coupons: Coupon[]): FilterOption[] {
  const categories = [...new Set(coupons.map((c) => c.category))];
  return categories.map((category) => ({
    value: category,
    label: category,
    icon: CATEGORY_ICONS[category],
    count: coupons.filter((c) => c.category === category).length,
  }));
}
