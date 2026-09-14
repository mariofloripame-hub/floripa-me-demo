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
    fireEvent.click(screen.getByRole("button", { name: /assinar local\+/i }));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByText(/plano local\+ · r\$34,90/i)).toBeInTheDocument();
  });

  it("persists the subscription and advances to the portal on signup", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByRole("button", { name: "Assinar Local" }));
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

  it("shows the Local+ upsell card only when subscribed to Local, with the coupon count derived from the plan", () => {
    seedSubscription({ planId: "local" });
    const { unmount } = render(<ClubePage />);
    expect(screen.getByText(/quer mais cupons/i)).toBeInTheDocument();
    expect(screen.getByText(/até 6 por mês/i)).toBeInTheDocument();
    unmount();

    window.localStorage.clear();
    seedSubscription({ planId: "local+" });
    render(<ClubePage />);
    expect(screen.queryByText(/quer mais cupons/i)).not.toBeInTheDocument();
  });

  it("shows an empty state when the region and category filters combine to zero results", () => {
    seedSubscription();
    render(<ClubePage />);

    fireEvent.click(screen.getByText("Sul"));
    fireEvent.click(screen.getByText("Compras"));

    expect(screen.getByText(/nenhum cupom/i)).toBeInTheDocument();
    expect(screen.queryByText("Shopping Iguatemi")).not.toBeInTheDocument();
    expect(screen.queryByText("Ostradamus")).not.toBeInTheDocument();
  });

  it("shows the brand wordmark, value proposition, and social proof on the plans step", () => {
    render(<ClubePage />);
    expect(screen.getByText("Floripa")).toBeInTheDocument();
    expect(screen.getByText(".my")).toBeInTheDocument();
    expect(screen.getByText(/já pode pagar sua mensalidade/i)).toBeInTheDocument();
    expect(screen.getByText(/cancele quando quiser/i)).toBeInTheDocument();
    expect(screen.getByText(/8 parceiros/i)).toBeInTheDocument();
  });

  it("shows featured partner previews on the plans step and starts Local+ signup when one is clicked", () => {
    render(<ClubePage />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText("Shopping Iguatemi")).toBeInTheDocument();
    expect(screen.getByText("Studio Bem-Estar Trindade")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ostradamus"));

    expect(screen.getByText(/plano local\+ · r\$34,90/i)).toBeInTheDocument();
  });

  it("returns to the plans step when Voltar is clicked on the signup form", () => {
    render(<ClubePage />);
    fireEvent.click(screen.getByRole("button", { name: /assinar local\+/i }));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Local+")).toBeInTheDocument();
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
  });

  it("clears the subscription and returns to the plans step when Sair do clube is clicked", () => {
    seedSubscription();
    render(<ClubePage />);
    expect(screen.getByText(/cupons usados este mês/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sair do clube/i }));

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Local+")).toBeInTheDocument();
    expect(window.localStorage.getItem("floripa_clube_subscription")).toBeNull();
  });

  it("clicking the Local+ upsell button clears the subscription and returns to the plans step", () => {
    seedSubscription({ planId: "local" });
    render(<ClubePage />);

    fireEvent.click(screen.getByRole("button", { name: /assinar local\+/i }));

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Local+")).toBeInTheDocument();
    expect(window.localStorage.getItem("floripa_clube_subscription")).toBeNull();
  });
});
