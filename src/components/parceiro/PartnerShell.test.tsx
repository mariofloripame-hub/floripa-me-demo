import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PartnerShell } from "./PartnerShell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("PartnerShell", () => {
  it("offers code validation by default", () => {
    render(<PartnerShell placeName="Bar" plan={null} active="painel">x</PartnerShell>);
    expect(screen.getByRole("link", { name: /Validar código/ })).toBeInTheDocument();
  });

  it("hides code validation for partners without courtesy (lodgings)", () => {
    render(<PartnerShell placeName="Pousada" plan={null} active="painel" showValidate={false}>x</PartnerShell>);
    expect(screen.queryByRole("link", { name: /Validar código/ })).toBeNull();
  });
});
