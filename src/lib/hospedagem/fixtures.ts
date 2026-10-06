import type { Place } from "@/lib/supabase/types";

// Test-only factory: an eligible partner lodging unless overridden.
export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "lodge-1", region: "Norte", neighborhood: "Jurerê", name: "Pousada Teste",
    category: "Hospedagem", target_profiles: [], price_range: "R$$",
    point_type: "Pousada", short_description: "Pousada de teste", address: "Rua A, 1",
    opening_hours: null, phone: "48999990000", instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: 4.7, photos: [],
    is_partner: true, partner_plan: null, partner_offer: null, partner_status: "pago",
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    booking_whatsapp: "48999990000", booking_url: null,
    ...overrides,
  };
}
