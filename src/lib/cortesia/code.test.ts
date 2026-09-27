import { describe, it, expect } from "vitest";
import { generateCode, normalizeCode, CODE_ALPHABET, CODE_TTL_MS } from "./code";

describe("generateCode", () => {
  it("produces FMY- plus 4 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^FMY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    }
  });

  it("uses the injected random source", () => {
    expect(generateCode(() => 0)).toBe(`FMY-${CODE_ALPHABET[0].repeat(4)}`);
  });

  it("never contains ambiguous characters in the alphabet", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("lasts 24 hours", () => {
    expect(CODE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("normalizeCode", () => {
  it.each([
    ["FMY-4K7P", "FMY-4K7P"],
    ["fmy-4k7p", "FMY-4K7P"],
    ["4k7p", "FMY-4K7P"],
    [" fmy 4k7p ", "FMY-4K7P"],
    ["FMY4K7P", "FMY-4K7P"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeCode(input)).toBe(expected);
  });

  it.each(["", "FMY-", "4K7", "4K7PP", "FMY-4K0P", "FMY-4KOP", "ABC-4K7P"])("rejects %j", (input) => {
    expect(normalizeCode(input)).toBeNull();
  });
});
