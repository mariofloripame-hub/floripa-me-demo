import { describe, it, expect } from "vitest";
import { isEligibleLodging, isLodging, LODGING_CATEGORY } from "./eligibility";
import { makePlace } from "./fixtures";
import { CATEGORY_OPTIONS } from "@/lib/estabelecimentos/schema";

describe("eligibility", () => {
  it("offers Hospedagem as a category", () => {
    expect(CATEGORY_OPTIONS).toContain(LODGING_CATEGORY);
  });

  it("recognizes lodgings by category", () => {
    expect(isLodging({ category: "Hospedagem" })).toBe(true);
    expect(isLodging({ category: "Gastronomia" })).toBe(false);
  });

  it("accepts a verified partner lodging with WhatsApp", () => {
    expect(isEligibleLodging(makePlace())).toBe(true);
  });

  it("accepts a lodging with only a booking link", () => {
    expect(isEligibleLodging(makePlace({ booking_whatsapp: null, booking_url: "https://x.com" }))).toBe(true);
  });

  it.each([
    ["not a partner", { is_partner: false }],
    ["not verified", { is_verified: false }],
    ["not a lodging", { category: "Gastronomia" }],
    ["no contact", { booking_whatsapp: "  ", booking_url: null }],
    ["only an unreadable WhatsApp", { booking_whatsapp: "9999-0000", booking_url: null }],
  ])("rejects a lodging that is %s", (_label, overrides) => {
    expect(isEligibleLodging(makePlace(overrides))).toBe(false);
  });
});
