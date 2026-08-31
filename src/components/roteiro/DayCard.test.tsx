import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DayCard } from "./DayCard";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

const day: ItineraryDay = {
  day_number: 1,
  theme: "Sul & pôr do sol",
  activities: [
    { place_id: "p1", name: "Praia do Campeche", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null },
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
    expect(screen.getAllByText(/parceiro/i)).toHaveLength(1);
  });

  it("renders a remove button per activity when onRemove is provided, and calls it with the place_id", () => {
    const onRemove = vi.fn();
    render(<DayCard day={day} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("p1");
  });
});
