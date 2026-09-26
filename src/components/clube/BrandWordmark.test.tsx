import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandWordmark } from "./BrandWordmark";

describe("BrandWordmark", () => {
  it("renders the Floripa and .My segments", () => {
    render(<BrandWordmark />);
    expect(screen.getByText("Floripa")).toBeInTheDocument();
    expect(screen.getByText(".My")).toBeInTheDocument();
  });
});
