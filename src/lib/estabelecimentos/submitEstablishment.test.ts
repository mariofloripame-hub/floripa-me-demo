import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "./submitEstablishment";

function validFields(overrides: Record<string, unknown> = {}) {
  return {
    name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
    short_description: "Bar de esquina com música ao vivo às sextas.",
    region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
    price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
    instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
    contact_phone: "(48) 99999-0001",
    ...overrides,
  };
}

function photo(name: string, type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function fakeSupabase(opts: {
  uploadErrorOnCall?: number;
  insertError?: Error;
  insertedRow?: Record<string, unknown>;
} = {}) {
  let uploadCallCount = 0;
  const upload = vi.fn().mockImplementation(() => {
    uploadCallCount += 1;
    if (opts.uploadErrorOnCall && uploadCallCount === opts.uploadErrorOnCall) {
      return Promise.resolve({ data: null, error: new Error("upload failed") });
    }
    return Promise.resolve({ data: { path: `path-${uploadCallCount}` }, error: null });
  });
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
  const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl });

  const insertSingle = vi.fn().mockResolvedValue(
    opts.insertError
      ? { data: null, error: opts.insertError }
      : { data: opts.insertedRow ?? { id: "p1" }, error: null },
  );
  const insertChain = { select: () => insertChain, single: insertSingle };
  const from = vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) });

  return { storage: { from: storageFrom }, from } as unknown as SupabaseClient;
}

describe("submitEstablishment", () => {
  it("skips silently when the honeypot field is filled, touching neither storage nor the database", async () => {
    const supabase = fakeSupabase();
    const result = await submitEstablishment(
      { fields: validFields(), photos: [], honeypot: "i-am-a-bot" },
      { supabase },
    );
    expect(result).toEqual({ skipped: true });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws InvalidFieldsError with a field map when required data is missing, without touching storage or the database", async () => {
    const supabase = fakeSupabase();
    const fields = validFields();
    delete (fields as Record<string, unknown>).address;
    await expect(
      submitEstablishment({ fields, photos: [], honeypot: "" }, { supabase }),
    ).rejects.toBeInstanceOf(InvalidFieldsError);
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws InvalidPhotosError before uploading anything when there are too many photos", async () => {
    const supabase = fakeSupabase();
    const photos = Array.from({ length: 7 }, (_, i) => photo(`p${i}.jpg`));
    await expect(
      submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase }),
    ).rejects.toBeInstanceOf(InvalidPhotosError);
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("succeeds with zero photos", async () => {
    const supabase = fakeSupabase();
    const result = await submitEstablishment(
      { fields: validFields(), photos: [], honeypot: "" },
      { supabase },
    );
    expect(result).toEqual({ skipped: false });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("places");
  });

  it("uploads each photo and inserts is_verified/is_partner false with the resulting URLs", async () => {
    const supabase = fakeSupabase();
    const photos = [photo("a.jpg"), photo("b.jpg")];
    await submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase });

    expect(supabase.storage.from).toHaveBeenCalledWith("establishment-photos");
    const fromReturn = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(fromReturn.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_verified: false,
        is_partner: false,
        submission_source: "self_signup",
        photos: ["https://cdn.test/path-1", "https://cdn.test/path-2"],
      }),
    );
  });

  it("stops after the second of three photos fails to upload, and never inserts", async () => {
    const supabase = fakeSupabase({ uploadErrorOnCall: 2 });
    const photos = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    await expect(
      submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase }),
    ).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("propagates an insert failure after photos already uploaded successfully", async () => {
    const supabase = fakeSupabase({ insertError: new Error("db down") });
    await expect(
      submitEstablishment({ fields: validFields(), photos: [photo("a.jpg")], honeypot: "" }, { supabase }),
    ).rejects.toThrow("db down");
  });
});
