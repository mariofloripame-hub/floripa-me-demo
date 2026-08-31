import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/dicas" }));

import { DicasView } from "./DicasView";
import type { EventRow } from "@/lib/supabase/types";

const events: EventRow[] = [
  { id: "1", name: "Fenaostra", start_month: 7, end_month: 7, location: "CentroSul", target_profiles: ["Todos"], is_free: "Parcial", active: true, notes: "Festa Nacional da Ostra.", created_at: "2026-01-01T00:00:00Z" },
];

describe("DicasView", () => {
  it("renders each event's name, location, and notes", () => {
    render(<DicasView slug="abc123" events={events} />);
    expect(screen.getByText("Fenaostra")).toBeInTheDocument();
    expect(screen.getByText("CentroSul")).toBeInTheDocument();
    expect(screen.getByText(/festa nacional da ostra/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no events in season", () => {
    render(<DicasView slug="abc123" events={[]} />);
    expect(screen.getByText(/nenhum evento em cartaz/i)).toBeInTheDocument();
  });
});
