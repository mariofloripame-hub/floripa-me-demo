import { describe, it, expect } from "vitest";
import { adminPlaceFieldsSchema, adminPlacePatchSchema, normalizeLodgingFields, PARTNER_STATUS_OPTIONS, type AdminPlacePatch } from "./adminSchema";

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

  it("accepts a partner_status outside the fixed option list, so a legacy value survives an unrelated edit", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ partner_status: "vip-legado" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.partner_status).toBe("vip-legado");
  });

  it("accepts a region outside REGION_OPTIONS, so a place from before this list existed can still be saved", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ region: "Continente" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.region).toBe("Continente");
  });

  it("accepts a category outside CATEGORY_OPTIONS, so a place from before this list existed can still be saved", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ category: "Cultura / Gastrô" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBe("Cultura / Gastrô");
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
    const result = adminPlacePatchSchema.safeParse({ is_verified: "not-a-boolean" });
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

describe("lodging booking fields", () => {
  it("accepts an http(s) booking link", () => {
    expect(adminPlaceFieldsSchema.safeParse(validPayload({ booking_url: "https://pousada.com/reservas" })).success).toBe(true);
  });

  it("rejects a booking link that is not a URL", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ booking_url: "pousada.com" }));
    expect(result.success).toBe(false);
  });

  it("rejects a reservations WhatsApp that can't become a wa.me number", () => {
    expect(adminPlaceFieldsSchema.safeParse(validPayload({ booking_whatsapp: "9999-0000" })).success).toBe(false);
  });

  it("accepts a masked reservations WhatsApp", () => {
    expect(adminPlaceFieldsSchema.safeParse(validPayload({ booking_whatsapp: "(48) 99999-0000" })).success).toBe(true);
  });

  it("rejects more than 3 highlights", () => {
    expect(adminPlaceFieldsSchema.safeParse(validPayload({ highlights: "A, B, C, D" })).success).toBe(false);
  });

  it("stores highlights as a list for Hospedagem", () => {
    expect(normalizeLodgingFields({ category: "Hospedagem", highlights: "🌊 Vista para o mar, ☕ Café da manhã" }))
      .toMatchObject({ highlights: ["🌊 Vista para o mar", "☕ Café da manhã"] });
  });

  it("stores no highlights when the field is blank or the place is not a lodging", () => {
    expect(normalizeLodgingFields({ category: "Hospedagem", highlights: "" })).toMatchObject({ highlights: null });
    expect(normalizeLodgingFields({ category: "Gastronomia", highlights: "Piscina" })).toMatchObject({ highlights: null });
  });

  it("nulls booking fields for other categories", () => {
    expect(normalizeLodgingFields({ category: "Gastronomia", booking_whatsapp: "48999990000", booking_url: "https://x.com" }))
      .toMatchObject({ booking_whatsapp: null, booking_url: null });
  });

  it("keeps booking fields for Hospedagem and turns blanks into null", () => {
    expect(normalizeLodgingFields({ category: "Hospedagem", booking_whatsapp: "48999990000", booking_url: "" }))
      .toMatchObject({ booking_whatsapp: "48999990000", booking_url: null });
  });

  it("leaves a patch without category or booking keys untouched", () => {
    const patch: AdminPlacePatch = { name: "X" };
    expect(normalizeLodgingFields(patch)).toEqual({ name: "X" });
  });
});
