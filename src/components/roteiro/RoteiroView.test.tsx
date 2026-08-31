import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123" }));

import { RoteiroView } from "./RoteiroView";
import type { ItineraryRow } from "@/lib/supabase/types";

const itinerary: ItineraryRow = {
  id: "1", slug: "abc123", quiz_answers: {},
  welcome_message: "Oi! Preparamos 2 dias incríveis pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "p1", name: "Praia", time: "09:00", category: "Praia", price_range: "Gratuito", is_partner: false, address: "", lat: null, lng: null }] }],
  created_at: "2026-01-01T00:00:00Z",
};

describe("RoteiroView", () => {
  it("renders the welcome message and a DayCard per day, plus the bottom nav", () => {
    render(<RoteiroView itinerary={itinerary} />);
    expect(screen.getByText(/preparamos 2 dias/i)).toBeInTheDocument();
    expect(screen.getByText(/dia 1/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("href", "/roteiro/abc123/mapa");
  });
});
