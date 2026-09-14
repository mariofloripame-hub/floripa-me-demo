// scripts/lib/placesApi.ts
export interface DiscoverySeed {
  query: string;
  region: string;
  category: string;
}

export interface PlacesApiPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  photos?: { name: string }[];
}

export interface NewPlaceCandidate {
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: string;
  point_type: string;
  short_description: string;
  address: string;
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
  is_partner: boolean;
  special_needs_tags: string[];
}

const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos";

export function buildTextSearchRequest(seed: DiscoverySeed, apiKey: string) {
  return {
    url: "https://places.googleapis.com/v1/places:searchText",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: seed.query, languageCode: "pt-BR" }),
  };
}

export function mapDiscoveryResult(apiPlace: PlacesApiPlace, seed: DiscoverySeed): NewPlaceCandidate {
  return {
    region: seed.region,
    neighborhood: seed.region,
    name: apiPlace.displayName?.text ?? "Sem nome",
    category: seed.category,
    target_profiles: ["Todos"],
    price_range: "R$$",
    point_type: seed.category,
    short_description: "",
    address: apiPlace.formattedAddress ?? "",
    google_place_id: apiPlace.id,
    lat: apiPlace.location?.latitude ?? null,
    lng: apiPlace.location?.longitude ?? null,
    rating: apiPlace.rating ?? null,
    // Store the bare Google photo reference, never a URL with the API key
    // baked in — that URL is served straight to the public via the roteiro,
    // and place-photo/route.ts resolves it into an actual image server-side.
    photos: (apiPlace.photos ?? []).slice(0, 3).map((p) => p.name),
    is_partner: false,
    special_needs_tags: [],
  };
}

export interface PlaceEnrichmentPatch {
  google_place_id: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
}

export function mapEnrichmentUpdate(apiPlace: PlacesApiPlace): PlaceEnrichmentPatch {
  return {
    google_place_id: apiPlace.id,
    lat: apiPlace.location?.latitude ?? null,
    lng: apiPlace.location?.longitude ?? null,
    rating: apiPlace.rating ?? null,
    photos: (apiPlace.photos ?? []).slice(0, 3).map((p) => p.name),
  };
}
