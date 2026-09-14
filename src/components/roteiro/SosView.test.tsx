import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/sos" }));

import { SosView } from "./SosView";
import type { SosPlace } from "@/lib/supabase/types";

const places: SosPlace[] = [
  { id: "1", category: "saude", tag: "publico", name: "Hospital Universitário", meta: "Trindade · 24h · Público", lat: null, lng: null, phone: "(48) 3721-9100", created_at: "2026-01-01T00:00:00Z" },
  { id: "2", category: "seguranca", tag: "publico", name: "Delegacia do Turista", meta: "Centro · en/es", lat: null, lng: null, phone: null, created_at: "2026-01-01T00:00:00Z" },
];

describe("SosView", () => {
  it("shows every place by default", () => {
    render(<SosView slug="abc123" places={places} />);
    expect(screen.getByText("Hospital Universitário")).toBeInTheDocument();
    expect(screen.getByText("Delegacia do Turista")).toBeInTheDocument();
  });

  it("filters to a single category when its chip is clicked", () => {
    render(<SosView slug="abc123" places={places} />);
    fireEvent.click(screen.getByRole("button", { name: /saúde/i }));
    expect(screen.getByText("Hospital Universitário")).toBeInTheDocument();
    expect(screen.queryByText("Delegacia do Turista")).not.toBeInTheDocument();
  });

  it("shows an empty state when a category has no matches", () => {
    render(<SosView slug="abc123" places={[]} />);
    expect(screen.getByText(/nenhum serviço/i)).toBeInTheDocument();
  });

  it("renders a tel: link for a place with a phone number", () => {
    render(<SosView slug="abc123" places={places} />);
    const link = screen.getByRole("link", { name: /\(48\) 3721-9100/ });
    expect(link).toHaveAttribute("href", "tel:+554837219100");
  });

  it("does not render a phone link for a place without a phone number", () => {
    render(<SosView slug="abc123" places={places} />);
    expect(screen.queryByRole("link", { name: /delegacia do turista/i })).not.toBeInTheDocument();
  });
});
