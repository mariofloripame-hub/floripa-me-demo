import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123" }));

import { RoteiroView } from "./RoteiroView";
import type { ItineraryRow, Place } from "@/lib/supabase/types";

const itinerary: ItineraryRow = {
  id: "1", slug: "abc123", quiz_answers: {},
  welcome_message: "Oi! Preparamos 2 dias incríveis pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [
    { place_id: "p1", name: "Praia", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null },
    { place_id: "p2", name: "Trilha do Morro", time: "14:00", category: "Trilha", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null },
  ] }],
  created_at: "2026-01-01T00:00:00Z",
};

describe("RoteiroView", () => {
  it("renders the welcome message and a DayCard per day, plus the bottom nav", () => {
    render(<RoteiroView itinerary={itinerary} />);
    expect(screen.getByText(/preparamos 2 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: /mapa/i })).toHaveAttribute(
      "href",
      "/roteiro/abc123/mapa",
    );
  });

  it("removes an activity via PATCH and updates the view optimistically", async () => {
    const updatedDays = [{ ...itinerary.days[0], activities: [itinerary.days[0].activities[1]] }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...itinerary, days: updatedDays }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RoteiroView itinerary={itinerary} />);
    fireEvent.click(screen.getByRole("button", { name: /remover praia/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/itineraries/abc123",
      expect.objectContaining({ method: "PATCH" }),
    ));
    await waitFor(() => expect(screen.queryByText("Praia")).not.toBeInTheDocument());
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(screen.getByText("Trilha do Morro")).toBeInTheDocument();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("adds a custom activity via PATCH and updates the view", async () => {
    const updated = {
      ...itinerary,
      days: [
        {
          day_number: 1,
          theme: "Dia 1",
          activities: [
            itinerary.days[0].activities[0],
            { place_id: "custom-1", name: "Jantar", time: "20:00", category: "Personalizado", price_range: "—", is_partner: false, address: "", lat: null, lng: null },
          ],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) });
    vi.stubGlobal("fetch", fetchMock);

    render(<RoteiroView itinerary={itinerary} />);
    fireEvent.click(screen.getByText(/adicionar programação/i));
    fireEvent.change(screen.getByLabelText(/horário/i), { target: { value: "20:00" } });
    fireEvent.change(screen.getByLabelText(/nome da programação/i), { target: { value: "Jantar" } });
    fireEvent.click(screen.getByRole("button", { name: /^adicionar$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/itineraries/abc123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ day_number: 1, activity: { name: "Jantar", time: "20:00" } }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText("Jantar")).toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  function makePartner(overrides: Partial<Place>): Place {
    return {
      id: "p9", region: "Sul", neighborhood: "Campeche", name: "Bar do Campeche",
      category: "Bar / Noturno", target_profiles: [], price_range: "R$$",
      point_type: "Bar", short_description: "", address: "", opening_hours: null,
      phone: null, instagram: null, notes: null, google_place_id: null, lat: null, lng: null,
      rating: null, photos: [], is_partner: true, partner_plan: "básico",
      partner_offer: null, partner_status: "ativo",
      special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  it("shows the offer badge for a partner that has one, and lists partners without an offer plainly", () => {
    const partners = [
      makePartner({ id: "p9", name: "Bar do Campeche", partner_offer: "Chopp em dobro até as 20h" }),
      makePartner({ id: "p10", name: "Restaurante da Praia", partner_offer: null }),
    ];
    render(<RoteiroView itinerary={itinerary} partners={partners} />);
    expect(screen.getByText(/estabelecimentos parceiros/i)).toBeInTheDocument();
    expect(screen.getByText("Bar do Campeche")).toBeInTheDocument();
    expect(screen.getByText(/chopp em dobro até as 20h/i)).toBeInTheDocument();
    expect(screen.getByText("Restaurante da Praia")).toBeInTheDocument();
  });

  it("does not show the partners section when there are no partners", () => {
    render(<RoteiroView itinerary={itinerary} />);
    expect(screen.queryByText(/estabelecimentos parceiros/i)).not.toBeInTheDocument();
  });

  it("shows the família hero photos when the quiz profile is família", () => {
    const familiaItinerary = { ...itinerary, quiz_answers: { group: "familia" } };
    render(<RoteiroView itinerary={familiaItinerary} />);
    const [firstImage] = screen.getAllByRole("presentation", { hidden: true });
    expect(firstImage.getAttribute("src")).toContain("familia-01");
  });

  it("shows the default hero photos for other profiles", () => {
    const casalItinerary = { ...itinerary, quiz_answers: { group: "casal" } };
    render(<RoteiroView itinerary={casalItinerary} />);
    const [firstImage] = screen.getAllByRole("presentation", { hidden: true });
    expect(firstImage.getAttribute("src")).toContain("ponte-alto");
  });

  it("shows the amigos hero photos when the quiz profile is amigos", () => {
    const amigosItinerary = { ...itinerary, quiz_answers: { group: "amigos" } };
    render(<RoteiroView itinerary={amigosItinerary} />);
    const [firstImage] = screen.getAllByRole("presentation", { hidden: true });
    expect(firstImage.getAttribute("src")).toContain("amigos-01");
  });

  it("shows the solo hero photos whenever the quiz profile is solo, regardless of style", () => {
    const soloItinerary = { ...itinerary, quiz_answers: { group: "solo", style: ["praia"] } };
    render(<RoteiroView itinerary={soloItinerary} />);
    const [firstImage] = screen.getAllByRole("presentation", { hidden: true });
    expect(firstImage.getAttribute("src")).toContain("solo-negocios-01");
  });
});
