import { describe, it, expect } from "vitest";
import { ItineraryGenerationSchema } from "./schema";

describe("ItineraryGenerationSchema", () => {
  it("accepts a well-formed generation result", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi! Preparamos 2 dias incríveis pra você.",
      days: [{ day_number: 1, theme: "Sul & pôr do sol", activities: [{ place_id: "p1", time: "09:00" }] }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a day with zero activities", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi!",
      days: [{ day_number: 1, theme: "Vazio", activities: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive day_number", () => {
    const result = ItineraryGenerationSchema.safeParse({
      welcome_message: "Oi!",
      days: [{ day_number: 0, theme: "x", activities: [{ place_id: "p1", time: "09:00" }] }],
    });
    expect(result.success).toBe(false);
  });
});
