import { describe, it, expect } from "vitest";
import { roteiroSummary } from "./roteiroSummary";

describe("roteiroSummary", () => {
  it("summarizes group, length and up to two styles", () => {
    expect(roteiroSummary({ group: "casal", days: "3-4", style: ["gastronomia", "praia", "noite"] })).toBe(
      "Casal · 3 a 4 dias · Gastronomia & Praia",
    );
  });

  it("skips missing or unknown pieces", () => {
    expect(roteiroSummary({ group: "familia" })).toBe("Família");
    expect(roteiroSummary({ group: "???", days: "1" })).toBe("1 dia");
  });

  it("falls back to a generic label", () => {
    expect(roteiroSummary({})).toBe("Roteiro");
  });
});
