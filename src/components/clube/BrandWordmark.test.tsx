import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandWordmark } from "./BrandWordmark";

describe("BrandWordmark", () => {
  it("renders the Floripa and .my segments", () => {
    render(<BrandWordmark />);
    expect(screen.getByText("Floripa")).toBeInTheDocument();
    expect(screen.getByText(".my")).toBeInTheDocument();
  });
});
