import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LodgingDashboardView } from "./LodgingDashboardView";
import type { LodgingDashboard } from "@/lib/hospedagem/dashboard";

const dashboard: LodgingDashboard = {
  requestsThisMonth: 7, requestsLastMonth: 4, whatsappThisMonth: 5, siteThisMonth: 2,
  requestsPerDay: [{ dayKey: "2026-10-01", label: "1", count: 3 }],
  suggestedThisMonth: 31,
  latestRequests: [{ createdAt: "2026-10-05T17:30:00Z", channel: "whatsapp", stay: "12/01 → 15/01", guests: 2 }],
};

describe("LodgingDashboardView", () => {
  it("shows availability requests with the monthly delta and channel split", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText("Pedidos de disponibilidade")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("↑ 3 vs mês anterior")).toBeInTheDocument();
    expect(screen.getByText("💬 5 pelo WhatsApp · 🔗 2 pelo site")).toBeInTheDocument();
  });

  it("shows how often the lodging was suggested", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText("Sua hospedagem foi sugerida em 31 roteiros este mês")).toBeInTheDocument();
  });

  it("lists the latest requests", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.getByText(/12\/01 → 15\/01 · 2 hóspedes/)).toBeInTheDocument();
  });

  it("has no courtesy blocks", () => {
    render(<LodgingDashboardView dashboard={dashboard} />);
    expect(screen.queryByText(/cortesia/i)).toBeNull();
  });
});
