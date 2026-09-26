import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the primary variant with the gradient class by default", () => {
    render(<Button>Continuar</Button>);
    expect(screen.getByRole("button", { name: "Continuar" }).className).toContain("from-turquoise");
  });

  it("renders the ghost variant without the gradient class", () => {
    render(<Button variant="ghost">Voltar</Button>);
    expect(screen.getByRole("button", { name: "Voltar" }).className).not.toContain("from-turquoise");
  });

  it("uses tighter padding and smaller text for size sm", () => {
    render(<Button size="sm">Entrar</Button>);
    const className = screen.getByRole("button", { name: "Entrar" }).className;
    expect(className).toContain("py-2");
    expect(className).toContain("text-sm");
    expect(className).not.toContain("py-3");
  });
});
