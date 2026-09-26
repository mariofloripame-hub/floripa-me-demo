import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlacesTabs } from "./PlacesTabs";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar", category: "Praia",
    target_profiles: [], price_range: "Gratuito", point_type: "Ponto Turístico", short_description: "",
    address: "", opening_hours: null, phone: null, instagram: null, notes: null, google_place_id: null,
    lat: null, lng: null, rating: null, photos: [], is_partner: false, partner_plan: null,
    partner_offer: null, partner_status: null, special_needs_tags: [], is_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
});

describe("PlacesTabs", () => {
  it("defaults to the Pendentes tab, showing only unverified places", () => {
    const places = [
      place({ id: "a", name: "Pendente", is_verified: false }),
      place({ id: "b", name: "Aprovado", is_verified: true }),
    ];
    render(<PlacesTabs initialPlaces={places} />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.queryByText("Aprovado")).not.toBeInTheDocument();
  });

  it("switches tabs on click", () => {
    const places = [
      place({ id: "a", name: "Pendente", is_verified: false }),
      place({ id: "b", name: "Aprovado", is_verified: true }),
    ];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
  });

  it("approving a pending place moves it out of the Pendentes tab", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Pendente", is_verified: false })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /^aprovar$/i }));
    await waitFor(() => expect(screen.queryByText("Pendente")).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/admin/places/a", expect.objectContaining({ method: "PATCH" }));
  });

  it("deleting a place removes it from the list after confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Aprovado", is_verified: true })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    await waitFor(() => expect(screen.queryByText("Aprovado")).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/admin/places/a", expect.objectContaining({ method: "DELETE" }));
  });

  it("does not delete when the confirmation is declined", async () => {
    vi.mocked(confirm).mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Aprovado", is_verified: true })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });
});
