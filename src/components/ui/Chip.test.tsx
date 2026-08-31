import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("calls onClick when clicked and reflects selection via aria-pressed", () => {
    const onClick = vi.fn();
    render(<Chip selected onClick={onClick}>Eventos</Chip>);
    const chip = screen.getByRole("button", { name: "Eventos" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it("reflects an unselected state", () => {
    render(<Chip selected={false} onClick={() => {}}>Programas</Chip>);
    expect(screen.getByRole("button", { name: "Programas" })).toHaveAttribute("aria-pressed", "false");
  });
});
