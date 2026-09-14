export interface Place {
  id: string;
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: "Gratuito" | "R$" | "R$$" | "R$$$";
  point_type: string;
  short_description: string;
  address: string;
  opening_hours: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
  is_partner: boolean;
  partner_plan: string | null;
  partner_offer: string | null;
  partner_status: string | null;
  special_needs_tags: string[];
  is_verified: boolean;
  created_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  start_month: number;
  end_month: number;
  location: string;
  target_profiles: string[];
  is_free: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SosPlace {
  id: string;
  category: "saude" | "veiculo" | "seguranca" | "financeiro";
  tag: "publico" | "parceiro";
  name: string;
  meta: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  created_at: string;
}

export interface ItineraryRow {
  id: string;
  slug: string;
  quiz_answers: Record<string, unknown>;
  welcome_message: string;
  days: unknown;
  created_at: string;
}
