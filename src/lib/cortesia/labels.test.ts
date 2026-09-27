import { describe, it, expect } from "vitest";
import { validityLabel, usedLabel, relativeTime } from "./labels";

describe("validityLabel", () => {
  const now = new Date("2026-09-27T17:30:00Z"); // 14h30 in São Paulo

  it("says amanhã for a code expiring the next São Paulo day", () => {
    expect(validityLabel("2026-09-28T17:30:00Z", now)).toBe("válido até amanhã, 14h30");
  });

  it("says hoje for a code expiring the same São Paulo day", () => {
    expect(validityLabel("2026-09-27T22:00:00Z", now)).toBe("válido até hoje, 19h00");
  });
});

describe("usedLabel", () => {
  it("shows the São Paulo day it was used", () => {
    expect(usedLabel("2026-09-28T01:00:00Z")).toBe("✓ Cortesia usada em 27/09");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  it.each([
    ["2026-09-27T14:59:40Z", "agora"],
    ["2026-09-27T14:46:00Z", "há 14 min"],
    ["2026-09-27T12:00:00Z", "há 3 h"],
    ["2026-09-26T15:00:00Z", "há 1 dia"],
    ["2026-09-24T15:00:00Z", "há 3 dias"],
  ])("formats %s as %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
