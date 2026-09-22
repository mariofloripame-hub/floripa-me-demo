import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

const markerInstance = {
  addTo: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  remove: vi.fn(),
};
const tileLayerInstance = { addTo: vi.fn() };
const mapInstance = { remove: vi.fn(), setView: vi.fn().mockReturnThis(), fitBounds: vi.fn() };

const mapFn = vi.fn(() => mapInstance);
const tileLayerFn = vi.fn(() => tileLayerInstance);
const markerFn = vi.fn(() => markerInstance);
const divIconFn = vi.fn((opts: unknown) => opts);
const latLngBoundsFn = vi.fn((coords: unknown) => coords);

vi.mock("leaflet", () => ({
  map: mapFn,
  tileLayer: tileLayerFn,
  marker: markerFn,
  divIcon: divIconFn,
  latLngBounds: latLngBoundsFn,
}));

import { MapaView } from "./MapaView";

function activity(overrides: Partial<ItineraryDay["activities"][number]> = {}): ItineraryDay["activities"][number] {
  return {
    place_id: "1",
    time: "09:00",
    name: "Praia do Campeche",
    category: "Praia",
    price_range: "Gratuito",
    lat: -27.68,
    lng: -48.49,
    is_partner: false,
    address: "",
    short_description: "",
    ...overrides,
  };
}

function nearbyPlace(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    id: "n1",
    name: "Restaurante X",
    category: "Gastronomia",
    price_range: "R$$",
    is_partner: false,
    address: "",
    short_description: "",
    photos: [],
    rating: null,
    google_place_id: null,
    partner_offer: null,
    lat: -27.6,
    lng: -48.5,
    ...overrides,
  };
}

describe("MapaView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the bottom nav with Mapa active", async () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    await waitFor(() => expect(mapFn).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
  });

  it("uses the Voyager tile layer", async () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    await waitFor(() => expect(tileLayerFn).toHaveBeenCalled());
    expect(tileLayerFn).toHaveBeenCalledWith(
      expect.stringContaining("basemaps.cartocdn.com/rastertiles/voyager"),
      expect.any(Object),
    );
    expect(tileLayerInstance.addTo).toHaveBeenCalledWith(mapInstance);
  });

  it("fits the map to the activities with coordinates", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ lat: -27.6, lng: -48.5 })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapInstance.fitBounds).toHaveBeenCalledTimes(1));
    expect(latLngBoundsFn).toHaveBeenCalledWith([[-27.6, -48.5]]);
  });

  it("falls back to the Florianópolis default center when no activity has coordinates", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ lat: null, lng: null })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapFn).toHaveBeenCalledTimes(1));
    expect(markerFn).not.toHaveBeenCalled();
    expect(mapInstance.setView).toHaveBeenLastCalledWith([-27.5954, -48.548], 12);
  });

  it("adds a category-styled marker with a popup for each activity with coordinates", async () => {
    const days: ItineraryDay[] = [
      {
        day_number: 1,
        theme: "Dia 1",
        activities: [activity({ name: "Lagoa da Conceição", category: "Cultura", lat: -27.6, lng: -48.5 })],
      },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
    const iconArg = (markerFn.mock.calls[0][1] as { icon: { html: string } }).icon;
    expect(iconArg.html).toContain("#007367");
    expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance);
    expect(markerInstance.bindPopup).toHaveBeenCalledWith("Lagoa da Conceição");
  });

  it("gives partner activities a gold-ring icon", async () => {
    const days: ItineraryDay[] = [
      { day_number: 1, theme: "Dia 1", activities: [activity({ is_partner: true, lat: -27.6, lng: -48.5 })] },
    ];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    const iconArg = (markerFn.mock.calls[0][1] as { icon: { html: string } }).icon;
    expect(iconArg.html).toContain("#F2B705");
  });

  it("adds a marker for each nearby suggestion with coordinates, skipping ones without", async () => {
    const nearby: NearbyPlace[] = [nearbyPlace({ id: "n1" }), nearbyPlace({ id: "n2", lat: null, lng: null })];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
  });
});
