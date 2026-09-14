import { describe, it, expect } from "vitest";
import { getPlaceImage } from "./placeImages";

describe("getPlaceImage", () => {
  it("returns the real photo when one is provided, ignoring the local mapping", () => {
    expect(getPlaceImage("Praia do Campeche", "https://example.com/real.jpg")).toBe(
      "https://example.com/real.jpg",
    );
  });

  it("falls back to the local mapping for a known place name", () => {
    expect(getPlaceImage("Praia do Campeche")).toBe("/images/praia-campeche.jpg");
  });

  it("falls back to a generic local image for a place with no photo and no local mapping, so a card is never empty", () => {
    const image = getPlaceImage("Ostradamus");
    expect(image).toMatch(/^\/images\/.+\.(jpg|png)$/);
  });

  it("picks the same fallback image for the same unmapped place name every time (stable across renders)", () => {
    expect(getPlaceImage("Ostradamus")).toBe(getPlaceImage("Ostradamus"));
  });
});
