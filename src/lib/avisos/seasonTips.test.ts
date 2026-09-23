import { describe, it, expect } from "vitest";
import { seasonTipForMonth } from "./seasonTips";

describe("seasonTipForMonth", () => {
  it("returns the alta temporada tip for December through March", () => {
    for (const month of [12, 1, 2, 3]) {
      expect(seasonTipForMonth(month)?.label).toBe("Alta temporada");
    }
  });

  it("returns the friagem/inverno tip for June through August", () => {
    for (const month of [6, 7, 8]) {
      expect(seasonTipForMonth(month)?.label).toBe("Inverno");
    }
  });

  it("returns a tip for every valid month (1-12)", () => {
    for (let month = 1; month <= 12; month++) {
      expect(seasonTipForMonth(month)).not.toBeNull();
    }
  });

  it("returns null for an out-of-range month", () => {
    expect(seasonTipForMonth(0)).toBeNull();
    expect(seasonTipForMonth(13)).toBeNull();
  });
});
