import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

const markerInstance = { addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() };
const tileLayerInstance = { addTo: vi.fn() };
const mapInstance = { remove: vi.fn(), setView: vi.fn().mockReturnThis() };

const mapFn = vi.fn(() => mapInstance);
const tileLayerFn = vi.fn(() => tileLayerInstance);
const markerFn = vi.fn(() => markerInstance);
const divIconFn = vi.fn((opts: unknown) => opts);

vi.mock("leaflet", () => ({
  map: mapFn,
  tileLayer: tileLayerFn,
  marker: markerFn,
  divIcon: divIconFn,
}));

import { MapaView } from "./MapaView";

function activity(overrides: Partial<ItineraryDay["activities"][number]> = {}): ItineraryDay["activities"][number] {
  return {
    place_id: "1", time: "09:00", name: "Praia do Campeche", category: "Praia", price_range: "Gratuito",
    lat: -27.68, lng: -48.49, is_partner: false, address: "", short_description: "",
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

  it("centers on the first activity with coordinates and adds a tile layer", async () => {
    const days: ItineraryDay[] = [{ day_number: 1, theme: "Dia 1", activities: [activity({ lat: -27.6, lng: -48.5 })] }];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapFn).toHaveBeenCalledTimes(1));
    expect(tileLayerFn).toHaveBeenCalledWith(expect.stringContaining("tile.openstreetmap.org"), expect.any(Object));
    expect(tileLayerInstance.addTo).toHaveBeenCalledWith(mapInstance);
  });

  it("uses the Florianópolis default center when no activity has coordinates", async () => {
    const days: ItineraryDay[] = [{ day_number: 1, theme: "Dia 1", activities: [activity({ lat: null, lng: null })] }];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(mapFn).toHaveBeenCalledTimes(1));
    expect(markerFn).not.toHaveBeenCalled();
  });

  it("adds a marker with a popup for each activity with coordinates", async () => {
    const days: ItineraryDay[] = [{ day_number: 1, theme: "Dia 1", activities: [activity({ name: "Lagoa da Conceição", lat: -27.6, lng: -48.5 })] }];
    render(<MapaView slug="abc123" days={days} nearby={[]} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
    expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance);
    expect(markerInstance.bindPopup).toHaveBeenCalledWith("Lagoa da Conceição");
  });

  it("adds a marker for each nearby place with coordinates, skipping ones without", async () => {
    const nearby: NearbyPlace[] = [
      { id: "n1", name: "Restaurante X", lat: -27.6, lng: -48.5 },
      { id: "n2", name: "Sem coordenada", lat: null, lng: null },
    ];
    render(<MapaView slug="abc123" days={[]} nearby={nearby} />);

    await waitFor(() => expect(markerFn).toHaveBeenCalledTimes(1));
    expect(markerFn).toHaveBeenCalledWith([-27.6, -48.5], expect.any(Object));
  });
});
