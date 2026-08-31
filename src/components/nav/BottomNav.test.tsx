import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mapa" }));

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("renders all 5 tabs pointing at the given slug", () => {
    render(<BottomNav slug="abc123" />);
    expect(screen.getByRole("link", { name: /roteiro/i })).toHaveAttribute("href", "/roteiro/abc123");
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("href", "/roteiro/abc123/mapa");
    expect(screen.getByRole("link", { name: /sos/i })).toHaveAttribute("href", "/roteiro/abc123/sos");
    expect(screen.getByRole("link", { name: /dicas/i })).toHaveAttribute("href", "/roteiro/abc123/dicas");
    expect(screen.getByRole("link", { name: /mais/i })).toHaveAttribute("href", "/roteiro/abc123/mais");
  });

  it("marks the tab matching the current pathname as active", () => {
    render(<BottomNav slug="abc123" />);
    expect(screen.getByRole("link", { name: /mapa/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /roteiro/i })).not.toHaveAttribute("aria-current");
  });
});
