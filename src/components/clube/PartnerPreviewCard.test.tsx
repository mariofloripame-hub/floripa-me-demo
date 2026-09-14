import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PartnerPreviewCard } from "./PartnerPreviewCard";
import type { Coupon } from "@/lib/clube/coupons";

const coupon: Coupon = {
  id: "ostradamus", name: "Ostradamus", neighborhood: "Ribeirão da Ilha",
  region: "Sul", category: "Gastronomia", offer: "30% off no prato principal", icon: "🦪",
};

describe("PartnerPreviewCard", () => {
  it("shows the name, neighborhood, and offer", () => {
    render(<PartnerPreviewCard coupon={coupon} onSelect={vi.fn()} />);
    expect(screen.getByText("Ostradamus")).toBeInTheDocument();
    expect(screen.getByText(/ribeirão da ilha/i)).toBeInTheDocument();
    expect(screen.getByText(/30% off no prato principal/i)).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<PartnerPreviewCard coupon={coupon} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
