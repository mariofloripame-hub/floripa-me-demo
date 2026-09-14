import { describe, it, expect } from "vitest";
import { getPlaceImage } from "./placeImages";

describe("getPlaceImage", () => {
  it("routes a stored Google photo reference through the server-side proxy, never as a raw Google URL", () => {
    expect(getPlaceImage("Praia do Campeche", "places/ChIJ-fake/photos/abc")).toBe(
      "/api/place-photo?ref=places%2FChIJ-fake%2Fphotos%2Fabc",
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
