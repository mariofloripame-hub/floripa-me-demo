import { describe, it, expect } from "vitest";
import { GENERAL_TIPS } from "./generalTips";

describe("GENERAL_TIPS", () => {
  it("has exactly the 4 always-on tips, each with icon/label/text", () => {
    expect(GENERAL_TIPS).toHaveLength(4);
    expect(GENERAL_TIPS.map((t) => t.label)).toEqual(["Uber/99", "Estacionamento", "Trânsito", "Cuidados"]);
    for (const tip of GENERAL_TIPS) {
      expect(tip.icon.length).toBeGreaterThan(0);
      expect(tip.text.length).toBeGreaterThan(0);
    }
  });
});
