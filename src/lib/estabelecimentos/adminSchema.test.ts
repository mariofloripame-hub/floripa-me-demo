import { describe, it, expect } from "vitest";
import { adminPlaceFieldsSchema, adminPlacePatchSchema, PARTNER_STATUS_OPTIONS } from "./adminSchema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "JJR Surfe Coach", category: "Esporte", point_type: "Aula de Surf",
    short_description: "Aulas particulares e em grupo de surf no Campeche.",
    region: "Sul", neighborhood: "Campeche", address: "Servidão A Caminho das Dunas",
    price_range: "R$", opening_hours: "Seg a Seg", phone: "(48) 99828-2601",
    instagram: "@surfcoachjjr", is_verified: true, is_partner: true,
    partner_status: "cortesia", partner_plan: "Mensal", partner_offer: "",
    ...overrides,
  };
}

describe("adminPlaceFieldsSchema", () => {
  it("accepts a full valid payload without any contact info", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejects an invalid partner_status", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ partner_status: "vip" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean is_verified", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ is_verified: "true" }));
    expect(result.success).toBe(false);
  });

  it("still requires the core business fields", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;
    const result = adminPlaceFieldsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("adminPlacePatchSchema", () => {
  it("accepts a partial payload with only is_verified, for the quick-approve action", () => {
    const result = adminPlacePatchSchema.safeParse({ is_verified: true });
    expect(result.success).toBe(true);
  });

  it("still validates a field's format when it is present", () => {
    const result = adminPlacePatchSchema.safeParse({ partner_status: "vip" });
    expect(result.success).toBe(false);
  });

  it("accepts a photos array", () => {
    const result = adminPlacePatchSchema.safeParse({ photos: ["https://cdn.test/a.jpg"] });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op patch)", () => {
    expect(adminPlacePatchSchema.safeParse({}).success).toBe(true);
  });
});

describe("PARTNER_STATUS_OPTIONS", () => {
  it("includes Nenhum, Cortesia, and Pago in that order", () => {
    expect(PARTNER_STATUS_OPTIONS.map((o) => o.label)).toEqual(["Nenhum", "Cortesia", "Pago"]);
  });
});
