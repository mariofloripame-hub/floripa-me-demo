// scripts/lib/placesApi.test.ts
import { describe, it, expect } from "vitest";
import { buildTextSearchRequest, mapDiscoveryResult, mapEnrichmentUpdate } from "./placesApi";

describe("buildTextSearchRequest", () => {
  it("builds the Places API (New) Text Search request", () => {
    const req = buildTextSearchRequest({ query: "restaurante Lagoa da Conceição", region: "Leste", category: "Gastronomia" }, "fake-key");
    expect(req.url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(req.headers["X-Goog-Api-Key"]).toBe("fake-key");
    expect(req.headers["X-Goog-FieldMask"]).toContain("places.displayName");
    expect(JSON.parse(req.body)).toEqual({ textQuery: "restaurante Lagoa da Conceição", languageCode: "pt-BR" });
  });
});

describe("mapDiscoveryResult", () => {
  it("maps a Places API result into a new place candidate, not a partner by default", () => {
    const apiPlace = {
      id: "ChIJ-fake-id",
      displayName: { text: "Restaurante do Ceará" },
      formattedAddress: "Lagoa da Conceição, Florianópolis",
      location: { latitude: -27.6, longitude: -48.45 },
      rating: 4.5,
      photos: [{ name: "places/ChIJ-fake-id/photos/abc" }],
    };
    const seed = { query: "restaurante Lagoa da Conceição", region: "Leste", category: "Gastronomia" };

    const result = mapDiscoveryResult(apiPlace, seed, "fake-key");

    expect(result).toMatchObject({
      region: "Leste",
      name: "Restaurante do Ceará",
      category: "Gastronomia",
      address: "Lagoa da Conceição, Florianópolis",
      google_place_id: "ChIJ-fake-id",
      lat: -27.6,
      lng: -48.45,
      rating: 4.5,
      is_partner: false,
    });
    expect(result.photos[0]).toContain("places/ChIJ-fake-id/photos/abc/media");
  });

  it("falls back to safe defaults when optional fields are missing", () => {
    const apiPlace = { id: "ChIJ-2" };
    const seed = { query: "trilha Sul", region: "Sul", category: "Trilha" };
    const result = mapDiscoveryResult(apiPlace, seed, "fake-key");
    expect(result.name).toBe("Sem nome");
    expect(result.lat).toBeNull();
    expect(result.photos).toEqual([]);
  });
});

describe("mapEnrichmentUpdate", () => {
  it("maps a Places API result into an enrichment patch", () => {
    const apiPlace = {
      id: "ChIJ-fake-id",
      location: { latitude: -27.61, longitude: -48.46 },
      rating: 4.8,
      photos: [{ name: "places/ChIJ-fake-id/photos/xyz" }],
    };
    const result = mapEnrichmentUpdate(apiPlace, "fake-key");
    expect(result.google_place_id).toBe("ChIJ-fake-id");
    expect(result.lat).toBe(-27.61);
    expect(result.lng).toBe(-48.46);
    expect(result.rating).toBe(4.8);
    expect(result.photos[0]).toContain("places/ChIJ-fake-id/photos/xyz/media");
  });
});
