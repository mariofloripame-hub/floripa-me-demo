import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlanCard } from "./PlanCard";
import type { ClubePlan } from "@/lib/clube/coupons";

const plan: ClubePlan = { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" };
const plusPlan: ClubePlan = { id: "local+", name: "Local+", priceLabel: "R$34,90", couponsPerMonth: 6, description: "6 cupons por mês" };

describe("PlanCard", () => {
  it("shows the plan name, price, and description", () => {
    render(<PlanCard plan={plan} onSelect={vi.fn()} />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("R$19,90")).toBeInTheDocument();
    expect(screen.getByText("3 cupons por mês")).toBeInTheDocument();
  });

  it("shows an Assinar button with the plan name and calls onSelect with the plan id when clicked", () => {
    const onSelect = vi.fn();
    render(<PlanCard plan={plan} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /assinar local/i }));
    expect(onSelect).toHaveBeenCalledWith("local");
  });

  it("shows a 'Mais escolhido' badge on the Local+ plan but not on Local", () => {
    render(<PlanCard plan={plan} onSelect={vi.fn()} />);
    expect(screen.queryByText(/mais escolhido/i)).not.toBeInTheDocument();

    render(<PlanCard plan={plusPlan} onSelect={vi.fn()} />);
    expect(screen.getByText(/mais escolhido/i)).toBeInTheDocument();
  });
});
