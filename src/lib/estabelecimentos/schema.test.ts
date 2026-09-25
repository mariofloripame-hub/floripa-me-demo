import { describe, it, expect } from "vitest";
import { establishmentFieldsSchema, validatePhotos, MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES } from "./schema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Bar do Zé",
    category: "Bar / Noturno",
    point_type: "Bar",
    short_description: "Bar de esquina com música ao vivo às sextas.",
    region: "Sul",
    neighborhood: "Campeche",
    address: "Rua das Gaivotas, 123",
    price_range: "R$$",
    opening_hours: "Ter a Dom, 18h às 0h",
    phone: "(48) 99999-0000",
    instagram: "@bardoze",
    contact_name: "José Silva",
    contact_email: "jose@example.com",
    contact_phone: "(48) 99999-0001",
    ...overrides,
  };
}

function photo(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("establishmentFieldsSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("trims whitespace and rejects a whitespace-only required field", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ name: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).address;
    const result = establishmentFieldsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category value", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ category: "Não existe" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid region value", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ region: "Oeste" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid contact email", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ contact_email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("defaults instagram to an empty string when omitted", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).instagram;
    const result = establishmentFieldsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.instagram).toBe("");
  });
});

describe("validatePhotos", () => {
  it("allows zero photos", () => {
    expect(validatePhotos([])).toBeNull();
  });

  it("allows up to the maximum number of valid photos", () => {
    const photos = Array.from({ length: MAX_PHOTOS }, (_, i) => photo(`p${i}.jpg`, "image/jpeg", 1024));
    expect(validatePhotos(photos)).toBeNull();
  });

  it("rejects more than the maximum number of photos", () => {
    const photos = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => photo(`p${i}.jpg`, "image/jpeg", 1024));
    expect(validatePhotos(photos)).not.toBeNull();
  });

  it("rejects an oversized photo", () => {
    const photos = [photo("big.jpg", "image/jpeg", MAX_PHOTO_SIZE_BYTES + 1)];
    expect(validatePhotos(photos)).not.toBeNull();
  });

  it("rejects a disallowed file type", () => {
    const photos = [photo("doc.pdf", "application/pdf", 1024)];
    expect(validatePhotos(photos)).not.toBeNull();
  });
});
