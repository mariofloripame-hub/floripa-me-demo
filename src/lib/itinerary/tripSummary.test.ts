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
      timing: "agora",
      region: "semhospedagem",
      group: "amigos",
      budget: 200,
      days: "3-4",
    });
    expect(chips).toEqual([
      { icon: "📍", label: "Já em Floripa" },
      { icon: "🏨", label: "Sem hospedagem" },
      { icon: "👥", label: "Com amigos" },
      { icon: "💰", label: "R$200/dia" },
      { icon: "📅", label: "3 a 4 dias" },
    ]);
  });

  it("skips answers that are missing or not recognized", () => {
    expect(getTripChips({})).toEqual([]);
    expect(getTripChips({ region: "nao" })).toEqual([]);
  });
});
