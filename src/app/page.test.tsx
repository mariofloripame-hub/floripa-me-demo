import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import WelcomePage from "./page";

describe("WelcomePage", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders the welcome headline and a link to the quiz", () => {
    render(<WelcomePage />);
    expect(screen.getByText(/sua ilha/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /começar/i })).toHaveAttribute("href", "/quiz");
  });

  it("does not show a 'continuar' link when there is no saved itinerary", () => {
    render(<WelcomePage />);
    expect(screen.queryByText(/continuar meu último roteiro/i)).not.toBeInTheDocument();
  });

  it("shows a 'continuar' link to the last saved itinerary when one exists", () => {
    window.localStorage.setItem("floripa_last_itinerary_slug", "abc123");
    render(<WelcomePage />);
    expect(screen.getByRole("link", { name: /continuar meu último roteiro/i })).toHaveAttribute(
      "href",
      "/roteiro/abc123",
    );
  });
});
