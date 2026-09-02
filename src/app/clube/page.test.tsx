import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import ClubePage from "./page";

function seedSubscription(overrides: Partial<{ planId: "local" | "local+"; redeemedCouponIds: string[] }> = {}) {
  window.localStorage.setItem(
    "floripa_clube_subscription",
    JSON.stringify({
      planId: "local",
      name: "Ana",
      email: "ana@example.com",
      redeemedCouponIds: [],
      ...overrides,
    }),
  );
}

describe("ClubePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the two plans by default", () => {
    render(<ClubePage />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Local+")).toBeInTheDocument();
  });

  it("advances to the signup form after picking a plan", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByText("Local+"));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByText(/plano local\+/i)).toBeInTheDocument();
  });

  it("persists the subscription and advances to the portal on signup", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByText("Local"));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "maria@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /assinar plano local →/i }));

    expect(screen.getByText(/cupons usados este mês/i)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("floripa_clube_subscription") ?? "{}");
    expect(saved.name).toBe("Maria");
    expect(saved.email).toBe("maria@example.com");
    expect(saved.planId).toBe("local");
    expect(saved.redeemedCouponIds).toEqual([]);
  });

  it("skips straight to the portal when a subscription already exists", () => {
    seedSubscription();
    render(<ClubePage />);
    expect(screen.getByText(/cupons usados este mês/i)).toBeInTheDocument();
    expect(screen.queryByText("Local+")).not.toBeInTheDocument();
  });

  it("filters the coupon list by region and by category", () => {
    seedSubscription();
    render(<ClubePage />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Centro"));
    expect(screen.queryByText("Ostradamus")).not.toBeInTheDocument();
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Todas"));
    fireEvent.click(screen.getByText("Compras"));
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();
    expect(screen.queryByText("Studio Bem-Estar Trindade")).not.toBeInTheDocument();
  });

  it("redeeming a coupon updates the usage bar and persists, and blocks further redemption once the limit is reached", () => {
    seedSubscription({ redeemedCouponIds: ["ostradamus", "bar-do-arantes"] });
    render(<ClubePage />);
    expect(screen.getByText(/2\/3 cupons usados/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "+ Resgatar" })[0]);

    expect(screen.getByText(/3\/3 cupons usados/i)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("floripa_clube_subscription") ?? "{}");
    expect(saved.redeemedCouponIds).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Limite atingido" }).length).toBeGreaterThan(0);
  });

  it("shows the Local+ upsell card only when subscribed to Local", () => {
    seedSubscription({ planId: "local" });
    const { unmount } = render(<ClubePage />);
    expect(screen.getByText(/quer mais cupons/i)).toBeInTheDocument();
    unmount();

    window.localStorage.clear();
    seedSubscription({ planId: "local+" });
    render(<ClubePage />);
    expect(screen.queryByText(/quer mais cupons/i)).not.toBeInTheDocument();
  });
});
