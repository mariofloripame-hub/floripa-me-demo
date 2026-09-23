import { describe, it, expect } from "vitest";
import { getTripTitle, getTripChips } from "./tripSummary";

describe("getTripTitle", () => {
  it("returns a group-specific title when group is answered", () => {
    expect(getTripTitle({ group: "casal" })).toBe("Floripa a dois");
    expect(getTripTitle({ group: "amigos" })).toBe("Floripa com amigos");
  });

  it("falls back to a generic title when group is missing or unknown", () => {
    expect(getTripTitle({})).toBe("Seu roteiro em Floripa");
    expect(getTripTitle({ group: "unknown" })).toBe("Seu roteiro em Floripa");
  });
});

describe("getTripChips", () => {
  it("builds one chip per recognized answer, in order", () => {
    const chips = getTripChips({
      region: "semhospedagem",
      group: "amigos",
      budget: "medio",
      days: "3-4",
    });
    expect(chips).toEqual([
      { icon: "🏨", label: "Sem hospedagem" },
      { icon: "👥", label: "Com amigos" },
      { icon: "💰", label: "Médio" },
      { icon: "📅", label: "3 a 4 dias" },
    ]);
  });

  it("skips answers that are missing or not recognized", () => {
    expect(getTripChips({})).toEqual([]);
    expect(getTripChips({ region: "nao" })).toEqual([]);
  });

  it("gracefully ignores a legacy numeric budget from itineraries created before this change", () => {
    // old rows have quiz_answers.budget as a number (e.g. 150) and quiz_answers.timing as a string —
    // neither should produce a chip anymore, and neither should throw.
    expect(getTripChips({ timing: "agora", budget: 150 })).toEqual([]);
  });
});
