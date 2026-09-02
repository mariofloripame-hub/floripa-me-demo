import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CouponCard } from "./CouponCard";
import type { Coupon } from "@/lib/clube/coupons";

const coupon: Coupon = {
  id: "ostradamus", name: "Ostradamus", neighborhood: "Ribeirão da Ilha",
  region: "Sul", category: "Gastronomia", offer: "30% off no prato principal", icon: "🦪",
};

describe("CouponCard", () => {
  it("shows the name, neighborhood, and offer", () => {
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={false} onRedeem={vi.fn()} />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText(/ribeirão da ilha/i)).toBeInTheDocument();
    expect(screen.getByText(/30% off no prato principal/i)).toBeInTheDocument();
  });

  it("calls onRedeem with the coupon id when the active Resgatar button is clicked", () => {
    const onRedeem = vi.fn();
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={false} onRedeem={onRedeem} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Resgatar" }));
    expect(onRedeem).toHaveBeenCalledWith("ostradamus");
  });

  it("shows a disabled Resgatado state when already redeemed", () => {
    render(<CouponCard coupon={coupon} redeemed={true} limitReached={false} onRedeem={vi.fn()} />);
    expect(screen.getByRole("button", { name: "✓ Resgatado" })).toBeDisabled();
  });

  it("shows a disabled Limite atingido state when the plan limit is reached and this coupon wasn't redeemed", () => {
    render(<CouponCard coupon={coupon} redeemed={false} limitReached={true} onRedeem={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Limite atingido" })).toBeDisabled();
  });
});
