import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));

import { MapaView } from "./MapaView";

describe("MapaView", () => {
  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("shows a setup message and still renders the bottom nav when no Maps API key is configured", () => {
    render(<MapaView slug="abc123" days={[]} nearby={[]} />);
    expect(screen.getByText(/configure.*google_maps_api_key/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
  });
});
