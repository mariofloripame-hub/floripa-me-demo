import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DashboardView } from "./DashboardView";
import type { Dashboard } from "@/lib/parceiro/dashboard";

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    visitsThisMonth: 23, visitsLastMonth: 18,
    visitsPerDay: [{ dayKey: "2026-09-01", label: "1", count: 2 }],
    latestVisits: [{ redeemedAt: "2026-09-27T16:10:00Z", offerText: "Sobremesa cortesia" }],
    appearancesThisMonth: 142,
    appearancesPerDay: [{ dayKey: "2026-09-01", label: "1", count: 5 }],
    conversionRate: 23 / 142,
    visitorProfile: [{ group: "casal", label: "Casal", emoji: "💑", count: 12 }],
    recentRoteiros: [{ id: "r1", summary: "Casal · 3 a 4 dias · Gastronomia & Praia", when: "há 14 min", redeemed: true }],
    visitsMode: "full",
    ...overrides,
  };
}

const props = { plan: "Destaque", liveOffer: "Sobremesa cortesia", pendingOffer: null, hasPending: false };

describe("DashboardView", () => {
  it("shows confirmed visits with the month-over-month delta", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Visitas confirmadas")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("↑ 5 vs mês anterior")).toBeInTheDocument();
  });

  it("shows the conversion rate in Brazilian format", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("16,2%")).toBeInTheDocument();
  });

  it("keeps interest separate from visits", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Seu estabelecimento apareceu em 142 roteiros este mês")).toBeInTheDocument();
  });

  it("lists recent roteiros with the redeemed mark", () => {
    render(<DashboardView dashboard={dashboard()} {...props} />);
    expect(screen.getByText("Casal · 3 a 4 dias · Gastronomia & Praia")).toBeInTheDocument();
    expect(screen.getByText("✓ Cortesia resgatada")).toBeInTheDocument();
  });

  it("replaces the visits block with the upsell when there was never an offer", () => {
    render(<DashboardView dashboard={dashboard({ visitsMode: "upsell" })} {...props} liveOffer={null} />);
    expect(screen.queryByText("Visitas confirmadas")).not.toBeInTheDocument();
    expect(screen.getByText("Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My")).toBeInTheDocument();
  });

  it("keeps past visits and shows the upsell as a banner when the offer was removed", () => {
    render(<DashboardView dashboard={dashboard({ visitsMode: "banner" })} {...props} liveOffer={null} />);
    expect(screen.getByText("Visitas confirmadas")).toBeInTheDocument();
    expect(screen.getByText("Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My")).toBeInTheDocument();
  });

  it("shows a dash when there is no conversion rate yet", () => {
    render(<DashboardView dashboard={dashboard({ conversionRate: null })} {...props} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("hides the upgrade card for Premium partners", () => {
    render(<DashboardView dashboard={dashboard()} {...props} plan="Premium" />);
    expect(screen.queryByText(/plano premium/i)).not.toBeInTheDocument();
  });
});
