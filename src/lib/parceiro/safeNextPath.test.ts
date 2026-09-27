import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it.each([
    ["/parceiro", "/parceiro"],
    ["/parceiro/validar", "/parceiro/validar"],
  ])("keeps %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([null, undefined, "", "https://evil.com", "//evil.com", "/admin", "/parceiros/cadastro", "/parceiro/../admin", "/parceiro\\..\\admin"])(
    "falls back to /parceiro for %s",
    (input) => {
      expect(safeNextPath(input)).toBe("/parceiro");
    },
  );
});
