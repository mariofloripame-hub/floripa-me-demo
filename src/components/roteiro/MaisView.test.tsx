import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/roteiro/abc123/mais" }));

import { MaisView } from "./MaisView";

describe("MaisView", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal("location", { href: "https://floripa.me/roteiro/abc123" });
  });

  it("renders the action list including a link back to the quiz", () => {
    render(<MaisView slug="abc123" />);
    expect(screen.getByRole("link", { name: /refazer quiz/i })).toHaveAttribute("href", "/quiz");
  });

  it("copies the roteiro link to the clipboard and confirms it", async () => {
    render(<MaisView slug="abc123" />);
    fireEvent.click(screen.getByRole("button", { name: /compartilhar link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://floripa.me/roteiro/abc123");
    expect(await screen.findByText(/link copiado/i)).toBeInTheDocument();
  });

  it("triggers window.print for the PDF/print action", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<MaisView slug="abc123" />);
    fireEvent.click(screen.getByRole("button", { name: /salvar.*pdf/i }));
    expect(printSpy).toHaveBeenCalled();
  });
});
