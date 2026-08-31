import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("generates an 8-character lowercase alphanumeric slug", () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z0-9]{8}$/);
  });

  it("is deterministic given a fixed randomFn", () => {
    expect(generateSlug(() => 0)).toBe("aaaaaaaa");
  });

  it("produces different slugs across calls with the default random source", () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateSlug()));
    expect(slugs.size).toBeGreaterThan(1);
  });
});
