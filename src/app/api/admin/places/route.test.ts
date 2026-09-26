// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ listPlaces: vi.fn(), insertPlace: vi.fn() }));
vi.mock("@/lib/estabelecimentos/uploadPhotos", () => ({ uploadPhotos: vi.fn() }));

import { GET, POST } from "./route";
import { listPlaces, insertPlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

beforeEach(() => {
  vi.mocked(listPlaces).mockReset();
  vi.mocked(insertPlace).mockReset();
  vi.mocked(uploadPhotos).mockReset().mockResolvedValue([]);
});

const FIELDS = {
  name: "JJR Surfe Coach", category: "Esporte", point_type: "Aula de Surf",
  short_description: "Aulas particulares e em grupo de surf no Campeche.",
  region: "Sul", neighborhood: "Campeche", address: "Servidão A Caminho das Dunas",
  price_range: "R$", opening_hours: "Seg a Seg", phone: "(48) 99828-2601",
  instagram: "@surfcoachjjr", partner_status: "cortesia",
};

function formRequest(fields: Record<string, string>, extra: Record<string, string> = {}, photos: File[] = []) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...extra })) formData.append(key, value);
  for (const photo of photos) formData.append("photos", photo);
  return new Request("http://localhost/api/admin/places", { method: "POST", body: formData }) as never;
}

describe("GET /api/admin/places", () => {
  it("returns the full list of places", async () => {
    vi.mocked(listPlaces).mockResolvedValue([{ id: "1" } as never]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "1" }]);
  });
});

describe("POST /api/admin/places", () => {
  it("creates a place with is_verified/is_partner coerced from form strings", async () => {
    vi.mocked(insertPlace).mockResolvedValue({ id: "new-1" } as never);
    const response = await POST(formRequest(FIELDS, { is_verified: "true", is_partner: "false" }));
    expect(response.status).toBe(201);
    expect(insertPlace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_verified: true, is_partner: false, submission_source: "admin" }),
    );
  });

  it("stores is_partner as false when the form sends the literal string \"false\", not just any non-empty string", async () => {
    vi.mocked(insertPlace).mockResolvedValue({ id: "new-1" } as never);
    await POST(formRequest(FIELDS, { is_verified: "false", is_partner: "false" }));
    expect(insertPlace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_verified: false, is_partner: false }),
    );
  });

  it("returns 400 with field errors when a required field is missing, without inserting", async () => {
    const incomplete: Record<string, string> = { ...FIELDS };
    delete incomplete.name;
    const response = await POST(formRequest(incomplete, { is_verified: "true", is_partner: "false" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.name).toBeDefined();
    expect(insertPlace).not.toHaveBeenCalled();
  });

  it("returns 400 when there are too many photos, without uploading any", async () => {
    const photos = Array.from(
      { length: 7 },
      (_, i) => new File([new Uint8Array(10)], `p${i}.jpg`, { type: "image/jpeg" }),
    );
    const response = await POST(formRequest(FIELDS, { is_verified: "true", is_partner: "false" }, photos));
    expect(response.status).toBe(400);
    expect(uploadPhotos).not.toHaveBeenCalled();
  });
});
