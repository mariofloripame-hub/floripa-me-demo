import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DayCard } from "./DayCard";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { Place } from "@/lib/supabase/types";

function partner(overrides: Partial<Place>): Place {
  return {
    id: "partner-1", region: "Sul", neighborhood: "Campeche", name: "Lugar Parceiro",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: true, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], is_verified: true, created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const day: ItineraryDay = {
  day_number: 1,
  theme: "Sul & pôr do sol",
  activities: [
    {
      place_id: "p1", name: "Praia do Campeche", time: "09:00", category: "Praia", price_range: "Gratuito",
      is_partner: false, address: "", lat: null, lng: null,
      short_description: "Mar pra quem busca aventura. Ótima para surf e para relaxar.",
    },
    { place_id: "p2", name: "Ostradamus", time: "13:00", category: "Gastronomia", price_range: "R$$$", is_partner: true, address: "", lat: null, lng: null },
  ],
};

describe("DayCard", () => {
  it("renders the day number, theme, and each activity's time and name", () => {
    render(<DayCard day={day} />);
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(screen.getByText(/sul & pôr do sol/i)).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("Praia do Campeche")).toBeInTheDocument();
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
  });

  it("shows the partner badge only for partner activities", () => {
    render(<DayCard day={day} />);
    expect(screen.getAllByTitle(/parceiro/i)).toHaveLength(1);
  });

  it("shows the category pill and description for each activity", () => {
    render(<DayCard day={day} />);
    expect(screen.getByText("Praia")).toBeInTheDocument();
    expect(screen.getByText(/mar pra quem busca aventura/i)).toBeInTheDocument();
    expect(screen.getByText(/🎟️ Grátis/)).toBeInTheDocument();
    expect(screen.getByText(/💰 R\$\$\$/)).toBeInTheDocument();
  });

  it("shows a Mapa link built from lat/lng when available, and from name+address otherwise", () => {
    const withCoords: ItineraryDay = {
      day_number: 1,
      theme: "Leste",
      activities: [
        { place_id: "p6", name: "Praia Mole", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "Rod. Wanderley Junior", lat: -27.63, lng: -48.45 },
      ],
    };
    render(<DayCard day={withCoords} />);
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("-27.63,-48.45")),
    );
  });

  it("falls back to a name+address Maps query when there are no coordinates", () => {
    render(<DayCard day={day} />);
    const mapLinks = screen.getAllByRole("link", { name: /mapa/i });
    expect(mapLinks[0]).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("Praia do Campeche")));
  });

  it("shows the Reservar badge only for Gastronomia activities", () => {
    render(<DayCard day={day} />);
    expect(screen.getByText(/reservar/i)).toBeInTheDocument();
    expect(screen.getAllByText(/reservar/i)).toHaveLength(1);
  });

  it("renders the known local image for a mapped place, and a generic fallback photo otherwise (never empty)", () => {
    render(<DayCard day={day} />);
    expect(screen.getByRole("img", { name: "Praia do Campeche" })).toHaveAttribute(
      "src",
      expect.stringContaining("praia-campeche.jpg"),
    );
    expect(screen.getByRole("img", { name: "Ostradamus" })).toHaveAttribute(
      "src",
      expect.stringMatching(/\.(jpg|png)/),
    );
  });

  it("shortens the display name for a known long place name, without affecting its image lookup", () => {
    const longNameDay: ItineraryDay = {
      day_number: 1,
      theme: "Leste",
      activities: [
        { place_id: "p3", name: "Passeio Barco Costa Lagoa", time: "16:00", category: "Passeio", price_range: "R$$", is_partner: false, address: "", lat: null, lng: null },
      ],
    };
    render(<DayCard day={longNameDay} />);
    expect(screen.getByText("Barco Costa da Lagoa")).toBeInTheDocument();
    expect(screen.queryByText("Passeio Barco Costa Lagoa")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Passeio Barco Costa Lagoa" })).toHaveAttribute(
      "src",
      expect.stringContaining("costa-lagoa.jpg"),
    );
  });

  it("shows the exclusive offer ribbon only for places on the offer list", () => {
    const offerDay: ItineraryDay = {
      day_number: 1,
      theme: "Leste",
      activities: [
        { place_id: "p4", name: "Zilá", time: "12:30", category: "Gastronomia", price_range: "R$$", is_partner: false, address: "", lat: null, lng: null },
        { place_id: "p5", name: "Tia Jú", time: "09:00", category: "Gastronomia", price_range: "R$", is_partner: false, address: "", lat: null, lng: null },
      ],
    };
    render(<DayCard day={offerDay} />);
    expect(screen.getByText(/oferta exclusiva/i)).toBeInTheDocument();
  });

  it("renders real partner places passed in, with their photo and name", () => {
    const partners = [
      partner({ id: "x1", name: "Krone Café", photos: ["places/abc/photos/1"] }),
      partner({ id: "x2", name: "Nacanoa Oyster Bar" }),
    ];
    render(<DayCard day={day} partners={partners} />);
    expect(screen.getByText("Krone Café")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Krone Café" })).toHaveAttribute(
      "src",
      expect.stringContaining("place-photo"),
    );
    expect(screen.getByText("Nacanoa Oyster Bar")).toBeInTheDocument();
  });

  it("excludes partners that are already part of the day's activities", () => {
    const partners = [
      partner({ id: "p2", name: "Ostradamus" }), // already in `day`
      partner({ id: "x3", name: "Krone Café" }),
    ];
    render(<DayCard day={day} partners={partners} />);
    expect(screen.getByText("Krone Café")).toBeInTheDocument();
    expect(screen.getAllByText("Ostradamus")).toHaveLength(1); // only the activity card, not a duplicate suggestion
  });

  it("shows a promo badge only on partner suggestions that have an offer, with the full offer as its title", () => {
    const partners = [
      partner({ id: "x1", name: "Krone Café", partner_offer: "Promoção exclusiva" }),
      partner({ id: "x2", name: "Nacanoa Oyster Bar", partner_offer: null }),
    ];
    render(<DayCard day={day} partners={partners} />);
    expect(screen.getByTitle("Promoção exclusiva")).toBeInTheDocument();
  });

  it("hides the partner suggestions section when there are none to suggest", () => {
    render(<DayCard day={day} />);
    expect(screen.queryByText(/outras opções parceiras/i)).not.toBeInTheDocument();
  });

  it("asks for confirmation before removing, and only calls onRemove when confirmed", () => {
    const onRemove = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DayCard day={day} onRemove={onRemove} />);

    fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
    expect(confirmSpy).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("p1");

    confirmSpy.mockRestore();
  });

  it("disables the remove button for the last remaining activity of a day", () => {
    const onRemove = vi.fn();
    const lastActivityDay: ItineraryDay = {
      day_number: 1,
      theme: "Só um lugar",
      activities: [day.activities[0]],
    };
    render(<DayCard day={lastActivityDay} onRemove={onRemove} />);
    expect(screen.getByRole("button", { name: /remover/i })).toBeDisabled();
  });

  it("does not show an add-activity control when onAddActivity is not provided", () => {
    render(<DayCard day={day} />);
    expect(screen.queryByText(/adicionar programação/i)).not.toBeInTheDocument();
  });

  it("opens a form and calls onAddActivity with the entered name and time", () => {
    const onAddActivity = vi.fn();
    render(<DayCard day={day} onAddActivity={onAddActivity} />);

    fireEvent.click(screen.getByText(/adicionar programação/i));
    fireEvent.change(screen.getByLabelText(/horário/i), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText(/nome da programação/i), { target: { value: "Jantar" } });
    fireEvent.click(screen.getByRole("button", { name: /^adicionar$/i }));

    expect(onAddActivity).toHaveBeenCalledWith({ name: "Jantar", time: "18:00" });
  });
});
